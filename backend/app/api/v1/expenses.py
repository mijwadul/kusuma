from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user, require_role, require_admin
from ...core.database import get_db
from ...models.expense import Expense
from ...models.project import Project
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
    """Daftar pengeluaran dengan filter tanggal dan kategori."""
    query = db.query(Expense)

    if expense_date is not None:
        query = query.filter(Expense.expense_date == expense_date)
    if start_date is not None:
        query = query.filter(Expense.expense_date >= start_date)
    if end_date is not None:
        query = query.filter(Expense.expense_date <= end_date)
    if category is not None:
        query = query.filter(Expense.category == category)

    expenses = query.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()
    return [_build_expense_response(e, db) for e in expenses]


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    """Buat catatan pengeluaran baru."""
    expense = Expense(
        expense_date=data.expense_date,
        category=data.category,
        description=data.description,
        amount=data.amount,
        project_id=data.project_id,
        notes=data.notes,
        created_by=current_user.id if current_user else None,
    )

    is_admin_or_gm = current_user and (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if is_admin_or_gm:
        from datetime import datetime
        expense.approval_status = "approved"
        expense.approved_by = current_user.id
        expense.approved_at = datetime.now()
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _build_expense_response(expense, db)


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    """Update catatan pengeluaran. Hanya admin/GM atau pembuat yang bisa mengubah."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if not is_admin_or_gm and expense.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this expense",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)
    return _build_expense_response(expense, db)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    """Hapus catatan pengeluaran. Hanya admin/GM/superuser."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if not is_admin_or_gm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin/GM access required",
        )

    db.delete(expense)
    db.commit()
    return None

@router.put("/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Approve pengeluaran (Hanya untuk GM/Admin)."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if not is_admin_or_gm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin/GM access required to approve expenses",
        )

    if expense.approval_status != "approved":
        from datetime import datetime
        expense.approval_status = "approved"
        expense.approved_by = current_user.id
        expense.approved_at = datetime.now()
        db.commit()
        db.refresh(expense)

    return _build_expense_response(expense, db)


@router.put("/{expense_id}/pay", response_model=ExpenseResponse)
def pay_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    """Tandai pengeluaran sebagai telah dibayar (Finance atau GM/Admin)."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    is_authorized = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm", "finance")
    )
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access required to mark expenses as paid",
        )

    if expense.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot pay an unapproved expense",
        )

    if expense.payment_status != "paid":
        from datetime import datetime
        expense.payment_status = "paid"
        expense.paid_by = current_user.id
        expense.paid_at = datetime.now()
        db.commit()
        db.refresh(expense)

    return _build_expense_response(expense, db)
