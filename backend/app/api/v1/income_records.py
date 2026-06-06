from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user, require_role
from ...core.database import get_db
from ...schemas.income_record import (
    IncomeRecordCreate,
    IncomeRecordResponse,
    IncomeRecordUpdate,
    BulkSuratJalanUpdate,
)
from ...services.income_record_service import IncomeRecordService

router = APIRouter()

@router.get("", response_model=List[IncomeRecordResponse])
def get_income_records(
    income_date: Optional[date] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    income_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return IncomeRecordService.get_income_records(db, income_date, start_date, end_date, income_type)


@router.post("", response_model=IncomeRecordResponse, status_code=status.HTTP_201_CREATED)
def create_income_record(
    data: IncomeRecordCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["field", "helper", "finance", "checker"])),
):
    return IncomeRecordService.create_income_record(db, current_user, data)


@router.put("/bulk-sj", response_model=dict)
def bulk_update_surat_jalan(
    data: BulkSuratJalanUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return IncomeRecordService.bulk_update_surat_jalan(db, data)


@router.get("/debug-price")
def debug_price(record_id: int, db: Session = Depends(get_db)):
    return IncomeRecordService.debug_price(db, record_id)


@router.put("/{record_id}", response_model=IncomeRecordResponse)
def update_income_record(
    record_id: int,
    data: IncomeRecordUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["finance", "checker"])),
):
    return IncomeRecordService.update_income_record(db, current_user, record_id, data)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["finance", "checker"])),
):
    IncomeRecordService.delete_income_record(db, current_user, record_id)
    return None

@router.get("/export/pdf")
def export_income_records_pdf(
    income_date: Optional[date] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    income_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from fastapi import Response
    from ...services.pdf_service import generate_income_records_pdf
    
    records = IncomeRecordService.get_income_records(db, income_date, start_date, end_date, income_type)
    pdf_bytes = generate_income_records_pdf(records, start_date, end_date)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=laporan_pemasukan.pdf"}
    )
