from collections import defaultdict
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
from ...models.payroll import Attendance
from ...models.work_log import WorkLog

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class FuelPurchaseItem(BaseModel):
    id: int
    tanggal: Optional[str]
    jenis_bbm: str
    liter: Optional[float]
    harga_per_liter: float
    total_harga: Optional[float]
    catatan: Optional[str]


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


class AttendanceEmployeeItem(BaseModel):
    employee_id: int
    employee_name: str
    position: Optional[str]
    present_days: int
    absent_days: int
    late_days: int
    total_work_hours: float
    total_overtime_hours: float
    daily_salary: float
    estimated_salary: float  # present_days * daily_salary


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
    total_present_days: int
    total_employees: int


class RangeReport(BaseModel):
    period_start: str
    period_end: str
    summary: ReportSummary
    fuel_purchases: List[FuelPurchaseItem]
    fuel_by_equipment: List[FuelByEquipmentItem]
    work_logs_by_equipment: List[WorkLogByEquipmentItem]
    work_logs_detail: List[WorkLogDetailItem]
    attendance_summary: List[AttendanceEmployeeItem]
    material_sales: List[MaterialSaleItem]


# ── Helper ───────────────────────────────────────────────────────────────────

def _fmt_date(d) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y-%m-%d")
    return str(d)


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/range", response_model=RangeReport)
def get_range_report(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Laporan operasional berdasarkan rentang tanggal:
    1. Pembelian BBM (approved)
    2. BBM per alat (catatan pengisian)
    3. Jam kerja alat
    4. Estimasi gaji berdasarkan absensi nyata
    5. Penjualan material
    """
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date tidak boleh lebih besar dari end_date")

    equipment_map: dict = {}

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
        fuel_purchases.append(FuelPurchaseItem(
            id=fp.id,
            tanggal=_fmt_date(fp.effective_date),
            jenis_bbm=fp.fuel_type,
            liter=liters if fp.liters else None,
            harga_per_liter=float(fp.price_per_liter),
            total_harga=total_price if fp.total_price else None,
            catatan=fp.notes,
        ))

    # ── 2. BBM per Alat ──────────────────────────────────────────────────────
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

    eq_ids = [r.equipment_id for r in fuel_log_rows if r.equipment_id]
    if eq_ids:
        for e in db.query(Equipment).filter(Equipment.id.in_(eq_ids)).all():
            equipment_map[e.id] = e

    fuel_by_equipment: List[FuelByEquipmentItem] = []
    for row in fuel_log_rows:
        eq = equipment_map.get(row.equipment_id)
        fuel_by_equipment.append(FuelByEquipmentItem(
            equipment_id=row.equipment_id or 0,
            equipment_name=eq.name if eq else f"Alat #{row.equipment_id}",
            equipment_type=eq.type if eq else "-",
            total_liters=round(float(row.total_liters), 2),
            refuel_count=int(row.refuel_count),
        ))
    fuel_by_equipment.sort(key=lambda x: x.equipment_name)

    # ── 3. Jam Kerja Alat ────────────────────────────────────────────────────
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

    wl_eq_ids = [r.equipment_id for r in wl_summary_rows if r.equipment_id]
    if wl_eq_ids:
        for e in db.query(Equipment).filter(Equipment.id.in_(wl_eq_ids)).all():
            equipment_map[e.id] = e

    work_logs_by_equipment: List[WorkLogByEquipmentItem] = []
    total_work_hours = 0.0
    for row in wl_summary_rows:
        eq = equipment_map.get(row.equipment_id)
        hrs = round(float(row.total_hours), 2)
        total_work_hours += hrs
        work_logs_by_equipment.append(WorkLogByEquipmentItem(
            equipment_id=row.equipment_id or 0,
            equipment_name=eq.name if eq else f"Alat #{row.equipment_id}",
            equipment_type=eq.type if eq else "-",
            total_hours=hrs,
            log_count=int(row.log_count),
        ))
    work_logs_by_equipment.sort(key=lambda x: x.equipment_name)

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
        work_logs_detail.append(WorkLogDetailItem(
            id=wl.id,
            equipment_name=eq.name if eq else f"Alat #{wl.equipment_id}",
            equipment_type=eq.type if eq else "-",
            operator_name=wl.operator_name,
            work_date=_fmt_date(wl.work_date),
            total_hours=round(float(wl.total_hours), 2),
            work_description=wl.work_description,
        ))

    # ── 4. Estimasi Gaji berdasarkan Absensi ─────────────────────────────────
    att_rows = (
        db.query(Attendance)
        .filter(
            Attendance.date >= start_date,
            Attendance.date <= end_date,
        )
        .all()
    )

    att_emp_ids = list({a.employee_id for a in att_rows})
    emp_map: dict = {}
    if att_emp_ids:
        emp_map = {e.id: e for e in db.query(Employee).filter(Employee.id.in_(att_emp_ids)).all()}

    agg: dict = defaultdict(lambda: {
        "present": 0, "absent": 0, "late": 0,
        "work_hours": 0.0, "ot_hours": 0.0
    })
    for a in att_rows:
        d = agg[a.employee_id]
        status = (a.status or "present").lower()
        if status in ("present", "late"):
            d["present"] += 1
            if status == "late":
                d["late"] += 1
        else:
            d["absent"] += 1
        d["work_hours"] += float(a.work_hours or 0)
        d["ot_hours"] += float(a.overtime_hours or 0)

    attendance_summary: List[AttendanceEmployeeItem] = []
    total_payroll_expense = 0.0
    total_present_global = 0

    for emp_id, stats in agg.items():
        emp = emp_map.get(emp_id)
        daily = float(emp.daily_salary if emp else 0)
        estimated = stats["present"] * daily
        total_payroll_expense += estimated
        total_present_global += stats["present"]
        attendance_summary.append(AttendanceEmployeeItem(
            employee_id=emp_id,
            employee_name=emp.name if emp else f"Karyawan #{emp_id}",
            position=emp.position if emp else None,
            present_days=stats["present"],
            absent_days=stats["absent"],
            late_days=stats["late"],
            total_work_hours=round(stats["work_hours"], 1),
            total_overtime_hours=round(stats["ot_hours"], 1),
            daily_salary=daily,
            estimated_salary=estimated,
        ))
    attendance_summary.sort(key=lambda x: x.employee_name)

    # ── 5. Penjualan Material ─────────────────────────────────────────────────
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
        material_items.append(MaterialSaleItem(
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
        ))

    # ── Summary ───────────────────────────────────────────────────────────────
    net_balance = total_material_sales - total_fuel_expense - total_payroll_expense

    return RangeReport(
        period_start=str(start_date),
        period_end=str(end_date),
        summary=ReportSummary(
            total_fuel_expense=round(total_fuel_expense, 2),
            total_fuel_liters=round(total_fuel_liters_purchased, 2),
            total_work_hours=round(total_work_hours, 2),
            total_payroll_expense=round(total_payroll_expense, 2),
            total_material_sales=round(total_material_sales, 2),
            net_balance=round(net_balance, 2),
            total_present_days=total_present_global,
            total_employees=len(attendance_summary),
        ),
        fuel_purchases=fuel_purchases,
        fuel_by_equipment=fuel_by_equipment,
        work_logs_by_equipment=work_logs_by_equipment,
        work_logs_detail=work_logs_detail,
        attendance_summary=attendance_summary,
        material_sales=material_items,
    )
