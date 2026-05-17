from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.income_record import IncomeRecord
from ...models.project import Project
from ...schemas.income_record import (
    IncomeRecordCreate,
    IncomeRecordResponse,
    IncomeRecordUpdate,
)

router = APIRouter()


def _build_income_response(record: IncomeRecord, db: Session) -> IncomeRecordResponse:
    """Helper: bangun IncomeRecordResponse dengan project_name dari DB."""
    project_name: Optional[str] = None
    if record.project_id:
        proj = db.query(Project).filter(Project.id == record.project_id).first()
        project_name = proj.name if proj else None

    return IncomeRecordResponse(
        id=record.id,
        income_date=record.income_date,
        income_type=record.income_type,
        description=record.description,
        amount=record.amount,
        project_id=record.project_id,
        payment_term=record.payment_term,
        customer_name=record.customer_name,
        material_type=record.material_type,
        quantity=record.quantity,
        unit=record.unit,
        unit_price=record.unit_price,
        payment_method=record.payment_method,
        license_plate=record.license_plate,
        vehicle_type=record.vehicle_type,
        notes=record.notes,
        created_by=record.created_by,
        created_at=record.created_at,
        project_name=project_name,
    )


@router.get("", response_model=List[IncomeRecordResponse])
def get_income_records(
    income_date: Optional[date] = Query(
        default=None, description="Filter by exact date"
    ),
    start_date: Optional[date] = Query(
        default=None, description="Filter start date (inklusif)"
    ),
    end_date: Optional[date] = Query(
        default=None, description="Filter end date (inklusif)"
    ),
    income_type: Optional[str] = Query(
        default=None, description="Filter: project_payment | material_sale"
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Daftar pemasukan dengan filter tanggal dan tipe."""
    query = db.query(IncomeRecord)

    if income_date is not None:
        query = query.filter(IncomeRecord.income_date == income_date)
    if start_date is not None:
        query = query.filter(IncomeRecord.income_date >= start_date)
    if end_date is not None:
        query = query.filter(IncomeRecord.income_date <= end_date)
    if income_type is not None:
        query = query.filter(IncomeRecord.income_type == income_type)

    records = query.order_by(
        IncomeRecord.income_date.desc(), IncomeRecord.id.desc()
    ).all()
    return [_build_income_response(r, db) for r in records]


@router.post(
    "", response_model=IncomeRecordResponse, status_code=status.HTTP_201_CREATED
)
def create_income_record(
    data: IncomeRecordCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Buat catatan pemasukan baru."""
    record = IncomeRecord(
        income_date=data.income_date,
        income_type=data.income_type,
        description=data.description,
        amount=data.amount,
        project_id=data.project_id,
        payment_term=data.payment_term,
        customer_name=data.customer_name,
        material_type=data.material_type,
        quantity=data.quantity,
        unit=data.unit,
        unit_price=data.unit_price,
        payment_method=data.payment_method,
        license_plate=data.license_plate,
        vehicle_type=data.vehicle_type,
        notes=data.notes,
        created_by=current_user.id if current_user else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _build_income_response(record, db)


@router.put("/{record_id}", response_model=IncomeRecordResponse)
def update_income_record(
    record_id: int,
    data: IncomeRecordUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update catatan pemasukan. Hanya admin/GM atau pembuat yang bisa mengubah."""
    record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Income record not found")

    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if not is_admin_or_gm and record.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this record",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return _build_income_response(record, db)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Hapus catatan pemasukan. Hanya admin/GM/superuser."""
    record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Income record not found")

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

    db.delete(record)
    db.commit()
    return None
