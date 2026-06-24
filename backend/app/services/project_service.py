import json
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.project import Project
from ..models.customer import ProjectMaterialItem
from ..models.income_record import IncomeRecord
from ..models.fuel_price import FuelPrice
from ..models.payroll import PayrollRecord
from ..models.expense import Expense
from ..models.vendor import VendorTopUp
from ..models.user import User
from ..models.employee import Employee
from ..core.exceptions import AuthorizationError, NotFoundError
from ..schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, MaterialItemResponse, UserBasicResponse, EmployeeBasicResponse

def _fmt(dt) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt)

def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

from ..models.surat_jalan import SuratJalan

def _build_project_response(proj: Project, db: Session) -> ProjectResponse:
    items = [MaterialItemResponse.model_validate(i) for i in proj.material_items]
    total_val = sum(
        (i.target_quantity * i.unit_price) for i in proj.material_items
        if i.unit_price is not None
    )
    realized = db.query(
        func.coalesce(func.sum(IncomeRecord.amount), 0)
    ).filter(IncomeRecord.project_id == proj.id).scalar()

    fuel_used = db.query(func.coalesce(func.sum(FuelPrice.total_price), 0)).filter(
        FuelPrice.project_id == proj.id,
        FuelPrice.payment_status == 'paid'
    ).scalar()

    payroll_used = db.query(func.coalesce(func.sum(PayrollRecord.net_salary), 0)).filter(
        PayrollRecord.project_id == proj.id,
        PayrollRecord.payment_status == 'paid'
    ).scalar()

    expense_used = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.project_id == proj.id,
        Expense.payment_status == 'paid'
    ).scalar()

    topup_used = db.query(func.coalesce(func.sum(VendorTopUp.amount), 0)).filter(
        VendorTopUp.project_id == proj.id,
        VendorTopUp.status == 'approved'
    ).scalar()

    budget_used = float(fuel_used or 0) + float(payroll_used or 0) + float(expense_used or 0) + float(topup_used or 0)
    remaining_budget = 0.0
    if proj.budget is not None:
        remaining_budget = float(proj.budget) - budget_used

    assigned_users = [UserBasicResponse.model_validate(u) for u in proj.assigned_users] if proj.assigned_users else []
    assigned_employees = [EmployeeBasicResponse.model_validate(e) for e in proj.assigned_employees] if proj.assigned_employees else []

    uninvoiced_count = db.query(func.count(SuratJalan.id)).filter(
        SuratJalan.project_id == proj.id,
        (SuratJalan.is_invoiced == False) | (SuratJalan.is_invoiced == None)
    ).scalar() or 0

    return ProjectResponse(
        id=proj.id,
        name=proj.name,
        client_name=proj.client_name,
        description=proj.description,
        location=proj.location,
        start_date=_fmt(proj.start_date),
        end_date=_fmt(proj.end_date),
        budget=proj.budget,
        progress=float(proj.progress or 0),
        status=proj.status or "ongoing",
        measurement_type=proj.measurement_type or "tonase",
        notes=proj.notes,
        created_at=_fmt(proj.created_at),
        material_items=items,
        assigned_users=assigned_users,
        assigned_employees=assigned_employees,
        total_material_value=round(float(total_val), 2),
        realized_amount=round(float(realized or 0), 2),
        budget_used=round(budget_used, 2),
        remaining_budget=round(remaining_budget, 2),
        uninvoiced_count=uninvoiced_count,
    )

class ProjectService:
    @staticmethod
    def _is_gm(user: User) -> bool:
        return (
            getattr(user, "is_admin", False)
            or getattr(user, "is_superuser", False)
            or getattr(user, "role", "") in ("gm", "admin")
        )

    @staticmethod
    def list_projects(db: Session, current_user: User, status: Optional[str] = None) -> List[ProjectResponse]:
        q = db.query(Project).filter(Project.is_active == True)
        if status:
            q = q.filter(Project.status == status)
            
        if current_user.role == "field" and current_user.assigned_projects:
            assigned_ids = [p.id for p in current_user.assigned_projects]
            q = q.filter(Project.id.in_(assigned_ids))
            
        projects = q.order_by(Project.created_at.desc()).all()
        return [_build_project_response(p, db) for p in projects]

    @staticmethod
    def get_project(db: Session, project_id: int) -> ProjectResponse:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise NotFoundError("Proyek tidak ditemukan")
        return _build_project_response(proj, db)

    @staticmethod
    def create_project(db: Session, current_user: User, data: ProjectCreate) -> ProjectResponse:
        if not ProjectService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat menambah proyek")

        proj = Project(
            name=data.name,
            client_name=data.client_name,
            description=data.description,
            location=data.location,
            start_date=_parse_dt(data.start_date),
            end_date=_parse_dt(data.end_date),
            budget=data.budget,
            status=data.status or "ongoing",
            measurement_type=data.measurement_type or "tonase",
            notes=data.notes,
            created_by=current_user.id,
        )
        db.add(proj)
        db.flush()

        if data.assigned_user_ids:
            users = db.query(User).filter(User.id.in_(data.assigned_user_ids)).all()
            proj.assigned_users = users
        if data.assigned_employee_ids:
            employees = db.query(Employee).filter(Employee.id.in_(data.assigned_employee_ids)).all()
            proj.assigned_employees = employees

        for item in data.material_items:
            db.add(ProjectMaterialItem(
                project_id=proj.id,
                material_type=item.material_type,
                unit=item.unit,
                target_quantity=item.target_quantity,
                unit_price=item.unit_price,
                notes=item.notes,
            ))

        db.commit()
        db.refresh(proj)
        return _build_project_response(proj, db)

    @staticmethod
    def update_project(db: Session, current_user: User, project_id: int, data: ProjectUpdate) -> ProjectResponse:
        if not ProjectService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat mengupdate proyek")

        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise NotFoundError("Proyek tidak ditemukan")

        fields = data.model_dump(exclude_unset=True, exclude={"material_items", "assigned_user_ids", "assigned_employee_ids"})
        for k, v in fields.items():
            if k in ("start_date", "end_date"):
                setattr(proj, k, _parse_dt(v))
            else:
                setattr(proj, k, v)

        if data.assigned_user_ids is not None:
            users = db.query(User).filter(User.id.in_(data.assigned_user_ids)).all()
            proj.assigned_users = users
        if data.assigned_employee_ids is not None:
            employees = db.query(Employee).filter(Employee.id.in_(data.assigned_employee_ids)).all()
            proj.assigned_employees = employees

        if data.material_items is not None:
            for old in proj.material_items:
                db.delete(old)
            db.flush()
            for item in data.material_items:
                db.add(ProjectMaterialItem(
                    project_id=proj.id,
                    material_type=item.material_type,
                    unit=item.unit,
                    target_quantity=item.target_quantity,
                    unit_price=item.unit_price,
                    notes=item.notes,
                ))

        db.commit()
        db.refresh(proj)
        return _build_project_response(proj, db)

    @staticmethod
    def delete_project(db: Session, current_user: User, project_id: int) -> None:
        if not ProjectService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat menghapus proyek")
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise NotFoundError("Proyek tidak ditemukan")
        proj.is_active = False
        db.commit()
