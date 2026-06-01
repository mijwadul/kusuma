from datetime import date, datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from ..models.expense import Expense
from ..models.user import User
from ..core.exceptions import AuthorizationError, NotFoundError, ValidationError
from ..api.v1.expenses import ExpenseCreate, ExpenseUpdate, ExpenseResponse, _build_expense_response

class ExpenseService:
    @staticmethod
    def get_expenses(db: Session, expense_date: Optional[date] = None, start_date: Optional[date] = None, end_date: Optional[date] = None, category: Optional[str] = None) -> List[ExpenseResponse]:
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

    @staticmethod
    def create_expense(db: Session, current_user: User, data: ExpenseCreate) -> ExpenseResponse:
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
            expense.approval_status = "approved"
            expense.approved_by = current_user.id
            expense.approved_at = datetime.now()
            
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return _build_expense_response(expense, db)

    @staticmethod
    def update_expense(db: Session, current_user: User, expense_id: int, data: ExpenseUpdate) -> ExpenseResponse:
        expense = db.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise NotFoundError("Expense not found")

        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm")
        )
        if not is_admin_or_gm and expense.created_by != current_user.id:
            raise AuthorizationError("Not authorized to update this expense")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(expense, field, value)

        db.commit()
        db.refresh(expense)
        return _build_expense_response(expense, db)

    @staticmethod
    def delete_expense(db: Session, current_user: User, expense_id: int) -> None:
        expense = db.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise NotFoundError("Expense not found")

        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm")
        )
        if not is_admin_or_gm:
            raise AuthorizationError("Admin/GM access required")

        db.delete(expense)
        db.commit()

    @staticmethod
    def approve_expense(db: Session, current_user: User, expense_id: int) -> ExpenseResponse:
        expense = db.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise NotFoundError("Expense not found")

        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm")
        )
        if not is_admin_or_gm:
            raise AuthorizationError("Admin/GM access required to approve expenses")

        if expense.approval_status != "approved":
            expense.approval_status = "approved"
            expense.approved_by = current_user.id
            expense.approved_at = datetime.now()
            db.commit()
            db.refresh(expense)

        return _build_expense_response(expense, db)

    @staticmethod
    def pay_expense(db: Session, current_user: User, expense_id: int) -> ExpenseResponse:
        expense = db.query(Expense).filter(Expense.id == expense_id).first()
        if not expense:
            raise NotFoundError("Expense not found")

        is_authorized = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm", "finance")
        )
        if not is_authorized:
            raise AuthorizationError("Access required to mark expenses as paid")

        if expense.approval_status != "approved":
            raise ValidationError("Cannot pay an unapproved expense")

        if expense.payment_status != "paid":
            expense.payment_status = "paid"
            expense.paid_by = current_user.id
            expense.paid_at = datetime.now()
            db.commit()
            db.refresh(expense)

        return _build_expense_response(expense, db)
