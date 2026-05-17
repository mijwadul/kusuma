from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models import Equipment, User
from ...models.employee import Employee
from ...models.fuel_log import FuelLog
from ...models.fuel_price import FuelPrice
from ...models.income_record import IncomeRecord
from ...models.payroll import PayrollRecord
from ...models.work_log import WorkLog

router = APIRouter()


# ── Schema ──────────────────────────────────────────────────────────────────

class FuelPurchaseItem(BaseModel):
    id: int
    tanggal: Optional[str]
    jenis_bbm: str
    liter: Optional[float]
    harga_per_liter: float
    total_harga: Optional[float]
    catatan: Optional[str]

    class Config:
        from_attributes = True


class FuelByEquipmentItem(BaseModel):
    equipment_id: int
    equipment_name: str
    equipment_type: str
    total_liters: float
    refuel_count: int


class WorkLogDetailItem(BaseModel):
    id: int
    equipment_name: str
    equipment_type: str
    operator_name: Optional[str]
    work_date: Optional[str]
    total_hours: float
    work_description: Optional[str]


class WorkLogByEquipmentItem(BaseModel):
    equipment_id: int
    equipment_name: str
    equipment_type: str
    total_hours: float
    log_count: int


class PayrollItem(BaseModel):
    id: int
    employee_name: str
    position: Optional[str]
    period_start: Optional[str]
    period_end: Optional[str]
    basic_salary: float
    allowance: float
    overtime_amount: float
    total_deduction: float
    net_salary: float
    payment_status: str


class MaterialSaleItem(BaseModel):
    id: int
    tanggal: Optional[str]
    material_type: Optional[str]
    quantity: Optional[float]
    unit: Optional[str]
    unit_price: Optional[float]
    amount: float
    customer_name: Optional[str]
    payment_method: Optional[str]
    description: str


class ReportSummary(BaseModel):
    total_fuel_expense: float
    total_fuel_liters: float
    total_work_hours: float
    total_payroll_expense: float
    total_material_sales: float
    net_balance: float


class RangeReport(BaseModel):
    period_start: str
    period_end: str
    summary: ReportSummary
    fuel_purchases: List[FuelPurchaseItem]
    fuel_by_equipment: List[FuelByEquipmentItem]
    work_logs_by_equipment: List[WorkLogByEquipmentItem]
    work_logs_detail: List[WorkLogDetailItem]
    payroll: List[PayrollItem]
    material_sales: List[MaterialSaleItem]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _fmt_date(d) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y-%m-%d")
    return str(d)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/range", response_model=RangeReport)
def get_range_report(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate laporan operasional berdasarkan rentang tanggal.
    Mencakup:
    - Pembelian BBM yang sudah diapprove
    - BBM per alat (dari catatan pengisian)
    - Jam kerja alat
    - Pengeluaran gaji karyawan/operator
    - Penjualan material
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date tidak boleh lebih besar dari end_date",
        )

    # ── 1. Pembelian BBM (approved) ──────────────────────────────────────────
    fuel_purchases_rows = (
        db.query(FuelPrice)
        .filter(
            FuelPrice.approval_status == "approved",
            cast(FuelPrice.effective_date, Date) >= start_date,
            cast(FuelPrice.effective_date, Date) <= end_date,
        )
        .order_by(FuelPrice.effective_date.asc())
        .all()
    )

    fuel_purchases: List[FuelPurchaseItem] = []
    total_fuel_expense = 0.0
    total_fuel_liters_purchased = 0.0

    for fp in fuel_purchases_rows:
        total_price = float(fp.total_price or 0)
        liters = float(fp.liters or 0)
        total_fuel_expense += total_price
        total_fuel_liters_purchased += liters
        fuel_purchases.append(
            FuelPurchaseItem(
                id=fp.id,
                tanggal=_fmt_date(fp.effective_date),
                jenis_bbm=fp.fuel_type,
                liter=liters if fp.liters else None,
                harga_per_liter=float(fp.price_per_liter),
                total_harga=total_price if fp.total_price else None,
                catatan=fp.notes,
            )
        )

    # ── 2. BBM per Alat (dari fuel_logs) ────────────────────────────────────
    fuel_log_rows = (
        db.query(
            FuelLog.equipment_id,
            func.coalesce(func.sum(FuelLog.liters_filled), 0).label("total_liters"),
            func.count(FuelLog.id).label("refuel_count"),
        )
        .filter(
            cast(FuelLog.refuel_date, Date) >= start_date,
            cast(FuelLog.refuel_date, Date) <= end_date,
        )
        .group_by(FuelLog.equipment_id)
        .all()
    )

    eq_ids_fuel = [r.equipment_id for r in fuel_log_rows if r.equipment_id]
    equipment_map: dict = {}
    if eq_ids_fuel:
        equips = db.query(Equipment).filter(Equipment.id.in_(eq_ids_fuel)).all()
        equipment_map = {e.id: e for e in equips}

    fuel_by_equipment: List[FuelByEquipmentItem] = []
    for row in fuel_log_rows:
        eq = equipment_map.get(row.equipment_id)
        fuel_by_equipment.append(
            FuelByEquipmentItem(
                equipment_id=row.equipment_id or 0,
                equipment_name=eq.name if eq else f"Alat #{row.equipment_id}",
                equipment_type=eq.type if eq else "-",
                total_liters=round(float(row.total_liters), 2),
                refuel_count=int(row.refuel_count),
            )
        )
    fuel_by_equipment.sort(key=lambda x: x.equipment_name)

    # ── 3. Jam Kerja Alat ───────────────────────────────────────────────────
    # 3a. Ringkasan per alat
    wl_summary_rows = (
        db.query(
            WorkLog.equipment_id,
            func.coalesce(func.sum(WorkLog.total_hours), 0).label("total_hours"),
            func.count(WorkLog.id).label("log_count"),
        )
        .filter(
            cast(WorkLog.work_date, Date) >= start_date,
            cast(WorkLog.work_date, Date) <= end_date,
        )
        .group_by(WorkLog.equipment_id)
        .all()
    )

    eq_ids_work = [r.equipment_id for r in wl_summary_rows if r.equipment_id]
    if eq_ids_work:
        new_equips = db.query(Equipment).filter(Equipment.id.in_(eq_ids_work)).all()
        for e in new_equips:
            equipment_map[e.id] = e

    work_logs_by_equipment: List[WorkLogByEquipmentItem] = []
    total_work_hours = 0.0

    for row in wl_summary_rows:
        eq = equipment_map.get(row.equipment_id)
        hrs = round(float(row.total_hours), 2)
        total_work_hours += hrs
        work_logs_by_equipment.append(
            WorkLogByEquipmentItem(
                equipment_id=row.equipment_id or 0,
                equipment_name=eq.name if eq else f"Alat #{row.equipment_id}",
                equipment_type=eq.type if eq else "-",
                total_hours=hrs,
                log_count=int(row.log_count),
            )
        )
    work_logs_by_equipment.sort(key=lambda x: x.equipment_name)

    # 3b. Detail per baris
    wl_detail_rows = (
        db.query(WorkLog)
        .filter(
            cast(WorkLog.work_date, Date) >= start_date,
            cast(WorkLog.work_date, Date) <= end_date,
        )
        .order_by(WorkLog.work_date.asc())
        .all()
    )

    work_logs_detail: List[WorkLogDetailItem] = []
    for wl in wl_detail_rows:
        eq = equipment_map.get(wl.equipment_id)
        work_logs_detail.append(
            WorkLogDetailItem(
                id=wl.id,
                equipment_name=eq.name if eq else f"Alat #{wl.equipment_id}",
                equipment_type=eq.type if eq else "-",
                operator_name=wl.operator_name,
                work_date=_fmt_date(wl.work_date),
                total_hours=round(float(wl.total_hours), 2),
                work_description=wl.work_description,
            )
        )

    # ── 4. Gaji Karyawan ─────────────────────────────────────────────────────
    payroll_rows = (
        db.query(PayrollRecord)
        .filter(
            PayrollRecord.period_end >= start_date,
            PayrollRecord.period_end <= end_date,
            PayrollRecord.payment_status.in_(["approved", "paid"]),
        )
        .order_by(PayrollRecord.period_end.asc())
        .all()
    )

    emp_ids = list({pr.employee_id for pr in payroll_rows})
    emp_map: dict = {}
    if emp_ids:
        emps = db.query(Employee).filter(Employee.id.in_(emp_ids)).all()
        emp_map = {e.id: e for e in emps}

    payroll_items: List[PayrollItem] = []
    total_payroll_expense = 0.0

    for pr in payroll_rows:
        emp = emp_map.get(pr.employee_id)
        net = float(pr.net_salary or 0)
        total_payroll_expense += net
        payroll_items.append(
            PayrollItem(
                id=pr.id,
                employee_name=emp.name if emp else f"Karyawan #{pr.employee_id}",
                position=emp.position if emp else None,
                period_start=_fmt_date(pr.period_start),
                period_end=_fmt_date(pr.period_end),
                basic_salary=float(pr.basic_salary or 0),
                allowance=float(pr.allowance or 0),
                overtime_amount=float(pr.overtime_amount or 0),
                total_deduction=float(pr.total_deduction or 0),
                net_salary=net,
                payment_status=pr.payment_status or "pending",
            )
        )

    # ── 5. Penjualan Material ────────────────────────────────────────────────
    material_rows = (
        db.query(IncomeRecord)
        .filter(
            IncomeRecord.income_date >= start_date,
            IncomeRecord.income_date <= end_date,
            IncomeRecord.income_type == "material_sale",
        )
        .order_by(IncomeRecord.income_date.asc())
        .all()
    )

    material_items: List[MaterialSaleItem] = []
    total_material_sales = 0.0

    for ir in material_rows:
        amt = float(ir.amount or 0)
        total_material_sales += amt
        material_items.append(
            MaterialSaleItem(
                id=ir.id,
                tanggal=_fmt_date(ir.income_date),
                material_type=ir.material_type,
                quantity=ir.quantity,
                unit=ir.unit,
                unit_price=ir.unit_price,
                amount=amt,
                customer_name=ir.customer_name,
                payment_method=ir.payment_method,
                description=ir.description,
            )
        )

    # ── Summary ───────────────────────────────────────────────────────────────
    total_expenses = total_fuel_expense + total_payroll_expense
    net_balance = total_material_sales - total_expenses

    summary = ReportSummary(
        total_fuel_expense=round(total_fuel_expense, 2),
        total_fuel_liters=round(total_fuel_liters_purchased, 2),
        total_work_hours=round(total_work_hours, 2),
        total_payroll_expense=round(total_payroll_expense, 2),
        total_material_sales=round(total_material_sales, 2),
        net_balance=round(net_balance, 2),
    )

    return RangeReport(
        period_start=str(start_date),
        period_end=str(end_date),
        summary=summary,
        fuel_purchases=fuel_purchases,
        fuel_by_equipment=fuel_by_equipment,
        work_logs_by_equipment=work_logs_by_equipment,
        work_logs_detail=work_logs_detail,
        payroll=payroll_items,
        material_sales=material_items,
    )
