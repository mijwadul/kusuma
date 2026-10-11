from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models import BonusDeduction, Employee, EmployeeLoan, User
from ...schemas import (
    BonusDeductionCreate,
    BonusDeductionResponse,
    EmployeeLoanCreate,
    EmployeeLoanResponse,
    EmployeeLoanUpdate,
)
from .employee_helpers import check_finance_access

router = APIRouter()


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
