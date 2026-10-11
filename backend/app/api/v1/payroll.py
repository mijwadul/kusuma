from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session

from ...core.auth import get_current_user, require_admin
from ...core.database import get_db
from ...models import Attendance, PayrollRecord, User
from ...schemas import (
    PayrollCalculate,
    PayrollCalculationResult,
    PayrollCreate,
    PayrollResponse,
    PayrollUpdate,
)
from ...services.pdf_service import generate_payroll_pdf
from ...services.payroll_service import PayrollService
from .employee_helpers import check_finance_access

router = APIRouter()


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
    return PayrollService.update_payroll(db, payroll_id, data)


@router.put("/payroll/{payroll_id}/approve", response_model=PayrollResponse)
def approve_payroll(
    payroll_id: int,
    approval_note: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),  # Only GM can approve
):
    return PayrollService.approve_payroll(db, current_user, payroll_id, approval_note)


@router.put("/payroll/{payroll_id}/pay", response_model=PayrollResponse)
def pay_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["finance", "gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to pay payroll")
    return PayrollService.pay_payroll(db, current_user, payroll_id)


@router.put("/payroll/{payroll_id}/unpay", response_model=PayrollResponse)
def unpay_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["finance", "gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to unpay payroll")
    return PayrollService.unpay_payroll(db, current_user, payroll_id)


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

    safe_name = (employee.name or "karyawan").replace(" ", "_")
    filename = f"slip_gaji_{safe_name}_{record.period_start}_{record.period_end}.pdf"

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


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
