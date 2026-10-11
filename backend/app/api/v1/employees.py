"""
Employee & Payroll API - System Kusuma

Role Access:
- GM: Full access (CRUD employee, view all financial data, approve payroll)
- Finance: View financial data, process payroll, view employee
- Admin/HR: CRUD employee (without financial data), view attendance
- Field: No access to employee menu
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models import Employee, User
from ...schemas import (
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeUpdate,
)
from ...schemas import Employee as EmployeeSchema
from ...services.employee_service import EmployeeService
from .attendance import router as attendance_router
from .employee_helpers import check_admin_access, check_finance_access
from .employee_loans import router as employee_loans_router
from .payroll import router as payroll_router

router = APIRouter()

# Include sub-routers for attendance, loans, and payroll
router.include_router(attendance_router)
router.include_router(employee_loans_router)
router.include_router(payroll_router)


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
    return EmployeeService.get_employees(db, current_user, skip, limit, department, status, show_inactive)


@router.get("/employees/{employee_id}")
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    EmployeeService.delete_employee(db, employee_id)
    return {"message": "Employee deleted successfully"}


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
