from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models import Attendance, Employee, Project, User
from ...schemas import AttendanceCreate, AttendanceResponse, AttendanceUpdate

router = APIRouter()


@router.post("/attendance", response_model=AttendanceResponse)
def create_attendance(
    attendance: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create attendance record.
    - Superuser/GM: Can create for any employee with selectable date
    - Helper (legacy): Can create for any employee, date is forced to today
    - Field Staff: Can create own attendance only
    - Admin/HR/Finance: Can create for any employee
    """
    # Check if employee exists
    employee = db.query(Employee).filter(Employee.id == attendance.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_operation = employee.department and employee.department.lower().startswith("operation")
    
    has_project_overlap = True
    if current_user.assigned_projects:
        user_proj_ids = {p.id for p in current_user.assigned_projects}
        emp_proj_ids = {p.id for p in employee.assigned_projects}
        has_project_overlap = bool(user_proj_ids & emp_proj_ids)

    if (
        current_user.role == "field"
        and not current_user.is_superuser
        and employee.user_id != current_user.id
        and (not is_operation or not has_project_overlap)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only create attendance for yourself or operation department employees assigned to your project",
        )

    attendance_data = attendance.model_dump(exclude_unset=True)

    # Legacy helper can create attendance for any employee,
    # but date must always be the current access date.
    if current_user.role == "helper" and not current_user.is_superuser:
        attendance_data["date"] = date.today()

    # Prevent double check-in for the same date
    target_date = attendance_data.get("date", attendance.date)
    existing_attendance = db.query(Attendance).filter(
        Attendance.employee_id == attendance.employee_id,
        Attendance.date == target_date
    ).first()
    if existing_attendance:
        raise HTTPException(status_code=400, detail="Employee already checked in for this date")

    # Calculate work hours if check_out provided
    work_hours = 0
    if attendance.check_in and attendance.check_out:
        cout = attendance.check_out.replace(tzinfo=None) if attendance.check_out.tzinfo else attendance.check_out
        cin = attendance.check_in.replace(tzinfo=None) if attendance.check_in.tzinfo else attendance.check_in
        work_hours = (cout - cin).total_seconds() / 3600

    db_attendance = Attendance(**attendance_data, work_hours=work_hours)

    db.add(db_attendance)
    db.commit()
    db.refresh(db_attendance)

    return db_attendance


@router.put("/attendance/{attendance_id}", response_model=AttendanceResponse)
def update_attendance(
    attendance_id: int,
    attendance_update: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update attendance record.
    - GM/Admin: Can edit any field
    - Field Staff: Can only update check_out for themselves or operation department for today's record
    """
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")

    is_admin = current_user.role in ["gm", "admin"] or current_user.is_admin or current_user.is_superuser
    
    if not is_admin:
        if current_user.role != "field":
            raise HTTPException(status_code=403, detail="Not enough permissions to edit attendance")
        
        employee = db.query(Employee).filter(Employee.id == attendance.employee_id).first()
        is_operation = employee and employee.department and employee.department.lower().startswith("operation")
        
        has_project_overlap = True
        if current_user.assigned_projects and employee:
            user_proj_ids = {p.id for p in current_user.assigned_projects}
            emp_proj_ids = {p.id for p in employee.assigned_projects}
            has_project_overlap = bool(user_proj_ids & emp_proj_ids)
        
        # Field staff validation
        if (not employee or employee.user_id != current_user.id) and (not is_operation or not has_project_overlap):
             raise HTTPException(status_code=403, detail="Cannot edit this employee's attendance")
             
        # Can only update check_out
        update_dict = attendance_update.model_dump(exclude_unset=True)
        allowed_keys = ["check_out"]
        if any(k not in allowed_keys for k in update_dict.keys()):
             raise HTTPException(status_code=403, detail="Field staff can only update check_out time")
             
        if attendance.date != date.today() and attendance.date != date.today() - timedelta(days=1):
             raise HTTPException(status_code=403, detail="Field staff can only check out for today's or yesterday's attendance")

    update_data = attendance_update.model_dump(exclude_unset=True)
    
    # Catat apakah ini adalah operasi checkout (check_out baru diisi)
    is_checkout = "check_out" in update_data and update_data["check_out"] is not None and not attendance.check_out

    for key, value in update_data.items():
        setattr(attendance, key, value)
        
    # Recalculate work_hours if check_in and check_out are present
    if attendance.check_in and attendance.check_out:
        cout = attendance.check_out.replace(tzinfo=None) if attendance.check_out.tzinfo else attendance.check_out
        cin = attendance.check_in.replace(tzinfo=None) if attendance.check_in.tzinfo else attendance.check_in
        attendance.work_hours = (cout - cin).total_seconds() / 3600

    db.commit()
    db.refresh(attendance)

    # Auto-generate payroll saat checkout
    if is_checkout:
        try:
            employee = db.query(Employee).filter(Employee.id == attendance.employee_id).first()
            if employee:
                from ...services.payroll_service import PayrollService
                # Trigger untuk OPERATOR: cek work log + buat payroll harian
                PayrollService.try_auto_generate_operator_payroll(
                    db=db,
                    employee=employee,
                    target_date=attendance.date,
                )
                # Trigger untuk NON-OPERATOR: buat payroll mingguan jika checkout Sabtu
                PayrollService.try_auto_generate_nonoperator_weekly_payroll(
                    db=db,
                    employee=employee,
                    attendance_date=attendance.date,
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(
                f"[AutoPayroll] Error saat trigger dari checkout attendance {attendance_id}: {e}"
            )

    return attendance


@router.delete("/attendance/{attendance_id}")
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete attendance record.
    - GM/Admin: Can delete any
    - Field Staff: Can only delete today's record for operation department
    """
    attendance = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")

    is_admin = current_user.role in ["gm", "admin"] or current_user.is_admin or current_user.is_superuser
    if not is_admin:
        if current_user.role != "field":
            raise HTTPException(status_code=403, detail="Not enough permissions to delete attendance")
        
        if attendance.date != date.today():
             raise HTTPException(status_code=403, detail="Field staff can only delete today's attendance")
             
        employee = db.query(Employee).filter(Employee.id == attendance.employee_id).first()
        is_operation = employee and employee.department and employee.department.lower().startswith("operation")
        
        has_project_overlap = True
        if current_user.assigned_projects and employee:
            user_proj_ids = {p.id for p in current_user.assigned_projects}
            emp_proj_ids = {p.id for p in employee.assigned_projects}
            has_project_overlap = bool(user_proj_ids & emp_proj_ids)
            
        if (not employee or employee.user_id != current_user.id) and (not is_operation or not has_project_overlap):
             raise HTTPException(status_code=403, detail="Cannot delete this employee's attendance")
             
    db.delete(attendance)
    db.commit()
    return {"message": "Attendance deleted successfully"}


@router.get("/attendance", response_model=List[AttendanceResponse])
def get_attendance(
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get attendance records.
    - Field Staff: See own attendance only
    - Admin/HR/Finance/GM: See all attendance
    """
    query = db.query(Attendance)

    # Field staff can see own attendance and operation department attendance
    if current_user.role == "field" and not current_user.is_superuser:
        employee = (
            db.query(Employee).filter(Employee.user_id == current_user.id).first()
        )
        employee_id_filter = employee.id if employee else -1
        
        query = query.join(Employee, Attendance.employee_id == Employee.id).filter(
            Employee.is_active == True  # only show attendance for active employees
        )
        
        if current_user.assigned_projects:
            assigned_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(
                or_(
                    Attendance.employee_id == employee_id_filter,
                    and_(
                        Employee.department.ilike("operation%"),
                        Employee.assigned_projects.any(Project.id.in_(assigned_project_ids))
                    )
                )
            )
        else:
            query = query.filter(
                or_(
                    Attendance.employee_id == employee_id_filter,
                    Employee.department.ilike("operation%")
                )
            )
    elif employee_id:
        query = query.filter(Attendance.employee_id == employee_id)

    if start_date and end_date:
        query = query.filter(
            and_(Attendance.date >= start_date, Attendance.date <= end_date)
        )

    records = query.order_by(Attendance.date.desc()).all()

    return records
