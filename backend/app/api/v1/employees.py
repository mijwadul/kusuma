"""
Employee & Payroll API - System Kusuma

Role Access:
- GM: Full access (CRUD employee, view all financial data, approve payroll)
- Finance: View financial data, process payroll, view employee
- Admin/HR: CRUD employee (without financial data), view attendance
- Field: No access to employee menu
"""

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status
from sqlalchemy import and_, or_, between, func
from sqlalchemy.orm import Session

# Import pdf service at module level to avoid stale cache on hot-reload
from ...services.pdf_service import generate_payroll_pdf

from ...core.auth import get_current_user, require_admin, require_role
from ...core.database import get_db
from ...models import (
    Attendance,
    BonusDeduction,
    Employee,
    EmployeeLoan,
    Equipment,
    PayrollRecord,
    User,
    Project,
)
from ...models.work_log import WorkLog
from ...schemas import (
    AttendanceCreate,
    AttendanceResponse,
    AttendanceUpdate,
    BonusDeductionCreate,
    BonusDeductionResponse,
    BonusDeductionUpdate,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeLoanCreate,
    EmployeeLoanResponse,
    EmployeeLoanUpdate,
    EmployeePrivate,
    EmployeePublic,
    EmployeeUpdate,
    PayrollCalculate,
    PayrollCalculationResult,
    PayrollCreate,
    PayrollResponse,
    PayrollUpdate,
)
from ...schemas import Employee as EmployeeSchema

router = APIRouter()

# ============================================
# Helper Functions
# ============================================


def check_finance_access(user: User):
    """Check if user has Finance/GM access for financial data"""
    finance_roles = ["gm", "finance", "admin", "checker"]
    return user.role in finance_roles or user.is_admin or user.is_superuser


def check_admin_access(user: User):
    """Check if user has Admin/GM access for employee management"""
    admin_roles = ["gm", "admin", "helper"]
    return user.role in admin_roles or user.is_admin or user.is_superuser


def calculate_payroll(
    employee: Employee,
    period_start: date,
    period_end: date,
    overtime_hours: float = 0,
    bonus: float = 0,
    allowance: float = 0,
    loan_deduction: Optional[float] = None,
    other_deduction: float = 0,
    db: Session = None,
) -> PayrollCalculationResult:
    """
    Calculate payroll for an employee
    """
    # Get attendance data
    auto_overtime_hours = 0
    basic_salary = 0
    present_days = 0
    
    daily_salary = employee.daily_salary or 0
    hourly_overtime_rate = employee.hourly_overtime_rate or 0

    if db:
        attendances = (
            db.query(Attendance)
            .filter(
                and_(
                    Attendance.employee_id == employee.id,
                    between(Attendance.date, period_start, period_end),
                    Attendance.status.in_(["present", "late"]),
                    (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None) | (Attendance.payroll_id == None)
                )
            )
            .all()
        )
        present_days = len(attendances)
        
        for att in attendances:
            if att.check_in and att.check_out:
                work_hours = att.work_hours or 0
                if work_hours < 6:
                    # 50% salary if work hours < 6
                    basic_salary += (daily_salary * 0.5)
                else:
                    basic_salary += daily_salary
                    
                if work_hours > 12:
                    auto_overtime_hours += (work_hours - 12)
            else:
                # Jika absen manual tanpa jam check in/out, hitung full
                basic_salary += daily_salary
    else:
        # Default behavior without DB
        basic_salary = daily_salary * present_days

    # Combine manual overtime and auto overtime
    total_overtime_hours = overtime_hours + auto_overtime_hours

    # Calculate work days in period (exclude weekends)
    work_days = 0
    current = period_start
    while current <= period_end:
        if current.weekday() < 6:  # Monday = 0, Saturday = 5
            work_days += 1
        current += timedelta(days=1)

    absent_days = work_days - present_days

    # Calculate automatic operator bonus
    auto_operator_bonus = 0
    if employee.position and employee.position.lower() == "operator" and db:
        work_logs_with_eq = (
            db.query(WorkLog, Equipment)
            .join(Equipment, WorkLog.equipment_id == Equipment.id)
            .filter(
                func.lower(WorkLog.operator_name) == func.lower(employee.name),
                func.date(WorkLog.work_date) >= period_start,
                func.date(WorkLog.work_date) <= period_end,
            )
            .all()
        )
        
        for wl, equipment in work_logs_with_eq:
            discount_hours = float(wl.rental_discount_hours or 0)
            if discount_hours <= 0:
                continue
                
            eq_type = equipment.type.lower() if equipment.type else ""
            
            if "breaker" in eq_type:
                rate = float(equipment.rental_rate_per_hour or 0)
                auto_operator_bonus += discount_hours * (0.5 * rate)
            elif "bucket" in eq_type:
                capacity = equipment.capacity or 0
                if capacity >= 30:
                    auto_operator_bonus += discount_hours * 150000.0
                elif capacity >= 20:
                    auto_operator_bonus += discount_hours * 100000.0
                else:
                    auto_operator_bonus += discount_hours * 100000.0
            else:
                # Default for other types if any
                auto_operator_bonus += discount_hours * 100000.0

    # Combine manual bonus and auto operator bonus
    total_bonus = bonus + auto_operator_bonus

    # Calculate income
    overtime_amount = hourly_overtime_rate * total_overtime_hours

    total_income = basic_salary + overtime_amount + total_bonus + allowance

    # Calculate deductions
    if loan_deduction is not None:
        actual_loan_deduction = min(loan_deduction, employee.loan_balance or 0)
    else:
        total_deduction_setting = (
            db.query(func.sum(EmployeeLoan.deduction_per_period))
            .filter(
                EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
            )
            .scalar()
            or 0
        )
        total_balance = (
            db.query(func.sum(EmployeeLoan.remaining_balance))
            .filter(
                EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
            )
            .scalar()
            or 0
        )
        actual_loan_deduction = min(total_deduction_setting, total_balance)

    debt_deduction = min(employee.debt_to_company or 0, employee.debt_to_company or 0)

    total_deduction = actual_loan_deduction + debt_deduction + other_deduction

    # Calculate net salary
    net_salary = total_income - total_deduction

    # Calculate remaining balances
    loan_remaining = max(0, (employee.loan_balance or 0) - actual_loan_deduction)
    debt_remaining = max(0, (employee.debt_to_company or 0) - debt_deduction)

    return PayrollCalculationResult(
        employee_id=employee.id,
        employee_name=employee.name,
        period_start=period_start,
        period_end=period_end,
        work_days=work_days,
        present_days=present_days,
        absent_days=absent_days,
        basic_salary=basic_salary,
        overtime_hours=total_overtime_hours,
        overtime_amount=overtime_amount,
        bonus=total_bonus,
        allowance=allowance,
        total_income=total_income,
        loan_deduction=actual_loan_deduction,
        debt_deduction=debt_deduction,
        other_deduction=other_deduction,
        total_deduction=total_deduction,
        net_salary=net_salary,
        loan_remaining=loan_remaining,
        debt_remaining=debt_remaining,
    )


# ============================================
# Employee Endpoints
# ============================================


@router.get("/employees", response_model=List[EmployeeListResponse])
def get_employees(
    skip: int = 0,
    limit: int = 100,
    department: Optional[str] = None,
    status: Optional[str] = None,
    show_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ...services.employee_service import EmployeeService
    return EmployeeService.get_employees(db, current_user, skip, limit, department, status, show_inactive)


@router.get("/employees/{employee_id}")
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ...services.employee_service import EmployeeService
    return EmployeeService.get_employee(db, current_user, employee_id)


@router.post("/employees", response_model=EmployeeSchema)
def create_employee(
    employee: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not check_admin_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin/HR can create employees",
        )
    from ...services.employee_service import EmployeeService
    return EmployeeService.create_employee(db, employee)


@router.put("/employees/{employee_id}", response_model=EmployeeSchema)
def update_employee(
    employee_id: int,
    employee_update: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not check_admin_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin/HR can update employees",
        )
    from ...services.employee_service import EmployeeService
    return EmployeeService.update_employee(db, current_user, employee_id, employee_update)


@router.delete("/employees/{employee_id}")
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (
        current_user.role not in ["gm", "admin"]
        and not current_user.is_admin
        and not current_user.is_superuser
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only GM can delete employees"
        )
    from ...services.employee_service import EmployeeService
    EmployeeService.delete_employee(db, employee_id)
    return {"message": "Employee deleted successfully"}


# ============================================
# Payroll Endpoints
# ============================================


@router.post("/payroll/calculate", response_model=PayrollCalculationResult)
def calculate_payroll_endpoint(
    calc_request: PayrollCalculate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can calculate payroll",
        )
    from ...services.payroll_service import PayrollService
    return PayrollService.calculate_payroll(
        db=db,
        employee_id=calc_request.employee_id,
        period_start=calc_request.period_start,
        period_end=calc_request.period_end,
        overtime_hours=calc_request.overtime_hours or 0,
        bonus=calc_request.bonus or 0,
        allowance=calc_request.allowance or 0,
        loan_deduction=calc_request.loan_deduction,
    )


@router.post("/payroll", response_model=PayrollResponse)
def create_payroll(
    payroll: PayrollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can create payroll",
        )
    from ...services.payroll_service import PayrollService
    return PayrollService.create_payroll(db, current_user, payroll)


@router.get("/payroll", response_model=List[PayrollResponse])
def get_payroll_records(
    employee_id: Optional[int] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only Finance/GM can view payroll",
        )
    from ...services.payroll_service import PayrollService
    return PayrollService.get_payroll_records(db, employee_id, period_start, period_end, payment_status)


@router.put("/payroll/{payroll_id}", response_model=PayrollResponse)
def update_payroll(
    payroll_id: int,
    data: PayrollUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only Finance/GM can update payroll",
        )
    from ...services.payroll_service import PayrollService
    return PayrollService.update_payroll(db, payroll_id, data)


@router.put("/payroll/{payroll_id}/approve", response_model=PayrollResponse)
def approve_payroll(
    payroll_id: int,
    approval_note: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),  # Only GM can approve
):
    from ...services.payroll_service import PayrollService
    return PayrollService.approve_payroll(db, current_user, payroll_id, approval_note)

@router.put("/payroll/{payroll_id}/pay", response_model=PayrollResponse)
def pay_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["finance", "gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to pay payroll")
    from ...services.payroll_service import PayrollService
    return PayrollService.pay_payroll(db, current_user, payroll_id)


# ============================================
# Attendance Endpoints
# ============================================


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

    # ── Auto-generate payroll saat checkout ──────────────────────────────────
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
    # ─────────────────────────────────────────────────────────────────────────

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
        # Find employee linked to user
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


# ============================================
# Bonus/Deduction Endpoints
# ============================================


@router.post("/bonus-deduction", response_model=BonusDeductionResponse)
def create_bonus_deduction(
    data: BonusDeductionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create bonus or deduction record.
    - Finance/GM can create bonus/deduction
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can create bonus/deduction",
        )

    employee = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    db_record = BonusDeduction(
        **data.model_dump(exclude_unset=True), created_by=current_user.id
    )

    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    return db_record


@router.get("/bonus-deduction", response_model=List[BonusDeductionResponse])
def get_bonus_deductions(
    employee_id: Optional[int] = None,
    type: Optional[str] = None,  # bonus or deduction
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get bonus/deduction records.
    - Finance/GM can see all
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can view bonus/deduction records",
        )

    query = db.query(BonusDeduction)

    if employee_id:
        query = query.filter(BonusDeduction.employee_id == employee_id)
    if type:
        query = query.filter(BonusDeduction.type == type)

    records = query.order_by(BonusDeduction.effective_date.desc()).all()

    return records


# ============================================
# Department & Summary Endpoints
# ============================================


@router.get("/departments")
def get_departments(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get list of unique departments"""
    departments = db.query(Employee.department).distinct().all()
    return [d[0] for d in departments if d[0]]


@router.get("/summary")
def get_employee_summary(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Get employee summary statistics.
    """
    total_employees = db.query(Employee).filter(Employee.is_active == True).count()

    # Count by status
    active_count = (
        db.query(Employee)
        .filter(Employee.is_active == True, Employee.status == "active")
        .count()
    )

    on_leave_count = db.query(Employee).filter(Employee.status == "on_leave").count()

    # Count with loans/debts
    with_loan = db.query(Employee).filter(Employee.loan_balance > 0).count()
    with_debt = db.query(Employee).filter(Employee.debt_to_company > 0).count()

    result = {
        "total_employees": total_employees,
        "active_employees": active_count,
        "on_leave_employees": on_leave_count,
        "with_loan": with_loan,
        "with_debt": with_debt,
    }

    # Add financial summary for Finance/GM
    if check_finance_access(current_user):
        total_loan = db.query(func.sum(Employee.loan_balance)).scalar() or 0
        total_debt = db.query(func.sum(Employee.debt_to_company)).scalar() or 0

        result["total_loan_amount"] = total_loan
        result["total_debt_amount"] = total_debt

    return result


# ============================================
# Employee Loan Endpoints
# ============================================


@router.post("/loans", response_model=EmployeeLoanResponse)
def create_loan(
    employee_id: int,
    loan_data: EmployeeLoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create employee loan record.
    - Only Finance/GM can create loans
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can manage loans",
        )

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Create loan
    db_loan = EmployeeLoan(
        employee_id=employee_id,
        nominal=loan_data.nominal,
        loan_date=loan_data.loan_date,
        remaining_balance=loan_data.nominal,
        deduction_per_period=loan_data.deduction_per_period or 0,
        notes=loan_data.notes,
        created_by=current_user.id,
    )
    db.add(db_loan)
    db.commit()

    # Recalculate employee loan_balance and deduction
    total_loan = (
        db.query(func.sum(EmployeeLoan.remaining_balance))
        .filter(EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True)
        .scalar()
        or 0
    )
    total_deduction = (
        db.query(func.sum(EmployeeLoan.deduction_per_period))
        .filter(EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True)
        .scalar()
        or 0
    )
    employee.loan_balance = total_loan
    employee.loan_deduction_per_period = total_deduction
    db.commit()

    db.refresh(db_loan)

    return db_loan


@router.get("/loans/employee/{employee_id}", response_model=List[EmployeeLoanResponse])
def get_employee_loans(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get loans for specific employee.
    - Only Finance/GM can view loan details
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can view loan details",
        )

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    loans = (
        db.query(EmployeeLoan)
        .filter(EmployeeLoan.employee_id == employee_id)
        .order_by(EmployeeLoan.loan_date.desc())
        .all()
    )
    return loans


@router.get("/loans", response_model=List[EmployeeLoanResponse])
def get_all_loans(
    skip: int = 0,
    limit: int = 100,
    employee_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all loans.
    - Only Finance/GM can view
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can view loan data",
        )

    query = db.query(EmployeeLoan)

    if employee_id:
        query = query.filter(EmployeeLoan.employee_id == employee_id)

    if is_active is not None:
        query = query.filter(EmployeeLoan.is_active == is_active)

    loans = (
        query.order_by(EmployeeLoan.loan_date.desc()).offset(skip).limit(limit).all()
    )
    return loans


@router.put("/loans/{loan_id}", response_model=EmployeeLoanResponse)
def update_loan(
    loan_id: int,
    loan_update: EmployeeLoanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update loan record.
    - Only Finance/GM can update
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can update loans",
        )

    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    update_data = loan_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(loan, key, value)

    # Recalculate if remaining_balance was modified
    if "nominal" in update_data and "remaining_balance" not in update_data:
        # Just an assumption that if nominal changes and not remaining_balance, we should probably update remaining_balance too.
        # Let's keep it simple and just do what the frontend sends.
        pass

    db.commit()

    # Recalculate employee loan_balance and deduction
    employee = db.query(Employee).filter(Employee.id == loan.employee_id).first()
    if employee:
        total_loan = (
            db.query(func.sum(EmployeeLoan.remaining_balance))
            .filter(
                EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
            )
            .scalar()
            or 0
        )
        total_deduction = (
            db.query(func.sum(EmployeeLoan.deduction_per_period))
            .filter(
                EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
            )
            .scalar()
            or 0
        )
        employee.loan_balance = total_loan
        employee.loan_deduction_per_period = total_deduction
        db.commit()

    db.refresh(loan)

    return loan


@router.delete("/loans/{loan_id}")
def delete_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete loan record.
    - Only Finance/GM can delete
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Finance/GM can delete loans",
        )

    loan = db.query(EmployeeLoan).filter(EmployeeLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    employee = db.query(Employee).filter(Employee.id == loan.employee_id).first()

    db.delete(loan)
    db.commit()

    if employee:
        total_loan = (
            db.query(func.sum(EmployeeLoan.remaining_balance))
            .filter(
                EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
            )
            .scalar()
            or 0
        )
        total_deduction = (
            db.query(func.sum(EmployeeLoan.deduction_per_period))
            .filter(
                EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
            )
            .scalar()
            or 0
        )
        employee.loan_balance = total_loan
        employee.loan_deduction_per_period = total_deduction
        db.commit()

    return {"message": "Loan deleted successfully"}


# ===== PDF GENERATION =====
@router.get("/payroll/{payroll_id}/pdf")
def download_payroll_pdf(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate dan download slip gaji dalam format PDF.
    - Finance/GM dapat mengunduh slip gaji karyawan manapun
    """
    if not check_finance_access(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only Finance/GM can download payroll PDF",
        )

    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    employee = record.employee
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    payroll_data = {
        "employee": employee,
        "payroll": record,
        "generated_at": datetime.now(timezone(timedelta(hours=7))),
    }

    try:
        pdf_bytes = generate_payroll_pdf(payroll_data)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gagal generate PDF: {str(e)}")

    # Mark as downloaded
    record.is_downloaded = True
    db.commit()

    from fastapi.responses import Response as FastAPIResponse

    safe_name = (employee.name or "karyawan").replace(" ", "_")
    filename = f"slip_gaji_{safe_name}_{record.period_start}_{record.period_end}.pdf"

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


# ===== DELETE PAYROLL =====
@router.delete("/payroll/{payroll_id}")
def delete_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Hapus record payroll.
    - Hanya GM/Admin yang bisa menghapus
    - Record dengan status 'paid' tidak bisa dihapus
    """
    record = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payroll record not found")

    if record.payment_status == "paid":
        raise HTTPException(
            status_code=400,
            detail="Slip gaji dengan status 'paid' tidak dapat dihapus. Hubungi superadmin.",
        )

    if record.payment_status == "approved" and record.employee:
        record.employee.loan_balance = (record.employee.loan_balance or 0) + (record.loan_deduction or 0)
        record.employee.debt_to_company = (record.employee.debt_to_company or 0) + (record.debt_deduction or 0)

    attendances_to_reset = db.query(Attendance).filter(Attendance.payroll_id == record.id).all()
    for att in attendances_to_reset:
        att.is_payroll_generated = False
        att.payroll_id = None

    db.delete(record)
    db.commit()
    return {"message": "Payroll record berhasil dihapus", "id": payroll_id}
