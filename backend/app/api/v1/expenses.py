from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user, require_role, require_admin
from ...core.database import get_db
from ...models.expense import Expense
from ...models.project import Project
from ...models.user import User
from ...schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate

router = APIRouter()


def _build_expense_response(expense: Expense, db: Session) -> ExpenseResponse:
    """Helper: bangun ExpenseResponse dengan project_name dari DB."""
    project_name: Optional[str] = None
    if expense.project_id:
        proj = db.query(Project).filter(Project.id == expense.project_id).first()
        project_name = proj.name if proj else None

    return ExpenseResponse(
        id=expense.id,
        expense_date=expense.expense_date,
        category=expense.category,
        description=expense.description,
        amount=expense.amount,
        project_id=expense.project_id,
        notes=expense.notes,
        created_by=expense.created_by,
        created_at=expense.created_at,
        project_name=project_name,
        approval_status=expense.approval_status,
        approved_by=expense.approved_by,
        approved_at=expense.approved_at,
        payment_status=expense.payment_status,
        paid_by=expense.paid_by,
        paid_at=expense.paid_at,
    )


@router.get("/", response_model=List[ExpenseResponse])
def get_expenses(
    expense_date: Optional[date] = Query(
        default=None, description="Filter by exact date"
    ),
    start_date: Optional[date] = Query(
        default=None, description="Filter start date (inklusif)"
    ),
    end_date: Optional[date] = Query(
        default=None, description="Filter end date (inklusif)"
    ),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from ...services.expense_service import ExpenseService
    return ExpenseService.get_expenses(db, expense_date, start_date, end_date, category)


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    from ...services.expense_service import ExpenseService
    return ExpenseService.create_expense(db, current_user, data)


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    from ...services.expense_service import ExpenseService
    return ExpenseService.update_expense(db, current_user, expense_id, data)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    from ...services.expense_service import ExpenseService
    ExpenseService.delete_expense(db, current_user, expense_id)
    return None

@router.put("/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from ...services.expense_service import ExpenseService
    return ExpenseService.approve_expense(db, current_user, expense_id)


@router.put("/{expense_id}/pay", response_model=ExpenseResponse)
def pay_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    from ...services.expense_service import ExpenseService
    return ExpenseService.pay_expense(db, current_user, expense_id)

@router.get("/export/pdf")
def export_expense_records_pdf(
    expense_date: Optional[date] = Query(
        default=None, description="Filter by exact date"
    ),
    start_date: Optional[date] = Query(
        default=None, description="Filter start date (inklusif)"
    ),
    end_date: Optional[date] = Query(
        default=None, description="Filter end date (inklusif)"
    ),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from fastapi import Response
    from ...services.expense_service import ExpenseService
    from ...services.pdf_service import generate_expense_records_pdf
    
    records = ExpenseService.get_expenses(db, expense_date, start_date, end_date, category)
    pdf_bytes = generate_expense_records_pdf(records, start_date, end_date)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=laporan_pengeluaran.pdf"}
    )
