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
    total_cost: float
    refuel_count: int


class WorkLogDetailItem(BaseModel):
    id: int
    equipment_name: str
    equipment_type: str
    operator_name: Optional[str]
    work_date: Optional[str]
    total_hours: float
    rental_discount_hours: float
    payable_rental_hours: float
    total_rental_cost: float
    work_description: Optional[str]


class WorkLogByEquipmentItem(BaseModel):
    equipment_id: int
    equipment_name: str
    equipment_type: str
    total_hours: float
    total_discount_hours: float
    total_payable_hours: float
    total_rental_cost: float
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
    operator_bonus: float
    estimated_salary: float  # present_days * daily_salary + bonus


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
    total_equipment_rental_expense: float
    total_payroll_expense: float
    total_material_sales: float
    net_balance: float
    total_present_days: int
    total_employees: int
    total_income_paid: float
    total_income_unpaid: float
    total_expense_paid: float
    total_expense_unpaid: float
    uninvoiced_material_total: Optional[float] = 0.0


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

    # ── 2. BBM per Alat & FIFO Calculation ──────────────────────────────────
    # FIFO Calculation over history
    all_fuel_purchases = db.query(FuelPrice).filter(
        FuelPrice.approval_status == "approved"
    ).order_by(FuelPrice.effective_date.asc()).all()
    all_fuel_logs = db.query(FuelLog).order_by(FuelLog.refuel_date.asc()).all()

    events = []
    for fp in all_fuel_purchases:
        events.append({"type": "purchase", "date": fp.effective_date, "data": fp})
    for fl in all_fuel_logs:
        events.append({"type": "consume", "date": fl.refuel_date, "data": fl})
        
    events.sort(key=lambda x: x["date"])
    
    inventory = []
    log_costs = {}
    
    for ev in events:
        if ev["type"] == "purchase":
            fp = ev["data"]
            if fp.liters and fp.liters > 0:
                inventory.append({
                    "price": float(fp.price_per_liter),
                    "remaining_liters": float(fp.liters)
                })
        else:
            fl = ev["data"]
            liters_needed = float(fl.liters_filled or 0)
            cost = 0.0
            
            while liters_needed > 0 and inventory:
                batch = inventory[0]
                if batch["remaining_liters"] <= liters_needed:
                    cost += batch["remaining_liters"] * batch["price"]
                    liters_needed -= batch["remaining_liters"]
                    inventory.pop(0)
                else:
                    cost += liters_needed * batch["price"]
                    batch["remaining_liters"] -= liters_needed
                    liters_needed = 0
                    
            if liters_needed > 0:
                fallback_price = all_fuel_purchases[-1].price_per_liter if all_fuel_purchases else 0
                cost += liters_needed * float(fallback_price)
                
            log_costs[fl.id] = cost

    fuel_log_rows = (
        db.query(FuelLog)
        .filter(
            cast(FuelLog.refuel_date, Date) >= start_date,
            cast(FuelLog.refuel_date, Date) <= end_date,
        )
        .all()
    )

    fuel_by_eq_dict = defaultdict(lambda: {"liters": 0.0, "count": 0, "cost": 0.0})
    eq_ids = set()
    for fl in fuel_log_rows:
        eq_id = fl.equipment_id
        if eq_id:
            eq_ids.add(eq_id)
            fuel_by_eq_dict[eq_id]["liters"] += float(fl.liters_filled or 0)
            fuel_by_eq_dict[eq_id]["count"] += 1
            fuel_by_eq_dict[eq_id]["cost"] += log_costs.get(fl.id, 0.0)

    if eq_ids:
        for e in db.query(Equipment).filter(Equipment.id.in_(list(eq_ids))).all():
            equipment_map[e.id] = e

    fuel_by_equipment: List[FuelByEquipmentItem] = []
    for eq_id, stats in fuel_by_eq_dict.items():
        eq = equipment_map.get(eq_id)
        fuel_by_equipment.append(FuelByEquipmentItem(
            equipment_id=eq_id,
            equipment_name=eq.name if eq else f"Alat #{eq_id}",
            equipment_type=eq.type if eq else "-",
            total_liters=round(stats["liters"], 2),
            total_cost=round(stats["cost"], 2),
            refuel_count=stats["count"],
        ))
    fuel_by_equipment.sort(key=lambda x: x.equipment_name)

    # ── 3. Jam Kerja Alat ────────────────────────────────────────────────────
    wl_detail_rows = (
        db.query(WorkLog)
        .join(Equipment, WorkLog.equipment_id == Equipment.id)
        .filter(
            cast(WorkLog.work_date, Date) >= start_date,
            cast(WorkLog.work_date, Date) <= end_date,
            Equipment.ownership_status == 'rental'
        )
        .order_by(WorkLog.work_date.asc())
        .all()
    )

    wl_eq_ids = list({wl.equipment_id for wl in wl_detail_rows if wl.equipment_id})
    if wl_eq_ids:
        for e in db.query(Equipment).filter(Equipment.id.in_(wl_eq_ids)).all():
            equipment_map[e.id] = e

    work_logs_detail: List[WorkLogDetailItem] = []
    wl_by_eq_dict = defaultdict(lambda: {"total_hours": 0.0, "discount_hours": 0.0, "payable_hours": 0.0, "rental_cost": 0.0, "count": 0})
    operator_bonus_dict = defaultdict(float)
    total_work_hours = 0.0

    for wl in wl_detail_rows:
        eq = equipment_map.get(wl.equipment_id)
        t_hours = float(wl.total_hours or 0)
        d_hours = float(wl.rental_discount_hours or 0)
        p_hours = t_hours - d_hours
        
        rental_rate = float(eq.rental_rate_per_hour or 0) if eq else 0
        rental_cost = p_hours * rental_rate
        
        eq_id = wl.equipment_id
        if eq_id:
            wl_by_eq_dict[eq_id]["total_hours"] += t_hours
            wl_by_eq_dict[eq_id]["discount_hours"] += d_hours
            wl_by_eq_dict[eq_id]["payable_hours"] += p_hours
            wl_by_eq_dict[eq_id]["rental_cost"] += rental_cost
            wl_by_eq_dict[eq_id]["count"] += 1
            total_work_hours += t_hours

        work_logs_detail.append(WorkLogDetailItem(
            id=wl.id,
            equipment_name=eq.name if eq else f"Alat #{wl.equipment_id}",
            equipment_type=eq.type if eq else "-",
            operator_name=wl.operator_name,
            work_date=_fmt_date(wl.work_date),
            total_hours=round(t_hours, 2),
            rental_discount_hours=round(d_hours, 2),
            payable_rental_hours=round(p_hours, 2),
            total_rental_cost=round(rental_cost, 2),
            work_description=wl.work_description,
        ))

        if wl.operator_name and d_hours > 0:
            operator_bonus_dict[wl.operator_name.strip().lower()] += d_hours * 150000.0

    work_logs_by_equipment: List[WorkLogByEquipmentItem] = []
    for eq_id, stats in wl_by_eq_dict.items():
        eq = equipment_map.get(eq_id)
        work_logs_by_equipment.append(WorkLogByEquipmentItem(
            equipment_id=eq_id,
            equipment_name=eq.name if eq else f"Alat #{eq_id}",
            equipment_type=eq.type if eq else "-",
            total_hours=round(stats["total_hours"], 2),
            total_discount_hours=round(stats["discount_hours"], 2),
            total_payable_hours=round(stats["payable_hours"], 2),
            total_rental_cost=round(stats["rental_cost"], 2),
            log_count=stats["count"],
        ))
    work_logs_by_equipment.sort(key=lambda x: x.equipment_name)

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
        
        emp_name_lower = emp.name.strip().lower() if emp else ""
        bonus = operator_bonus_dict.get(emp_name_lower, 0.0)
        
        estimated = (stats["present"] * daily) + bonus
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
            operator_bonus=round(bonus, 2),
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

    # Find uninvoiced material sales
    from ...models.invoice import Invoice
    invoices_all = db.query(Invoice).all() # Load all to check if invoiced
    uninvoiced_material_sales = []
    
    material_items: List[MaterialSaleItem] = []
    for ir in material_rows:
        is_invoiced = False
        for inv in invoices_all:
            if inv.customer_name == ir.customer_name and inv.start_date <= ir.income_date <= inv.end_date:
                is_invoiced = True
                break
        
        if not is_invoiced:
            uninvoiced_material_sales.append(ir)
            
        material_items.append(MaterialSaleItem(
            id=ir.id,
            tanggal=_fmt_date(ir.income_date),
            material_type=ir.material_type,
            quantity=ir.quantity,
            unit=ir.unit,
            unit_price=ir.unit_price,
            amount=float(ir.amount or 0),
            customer_name=ir.customer_name,
            payment_method=ir.payment_method,
            description=ir.description,
        ))

    # Pemasukan Material = Total nominal dari semua surat jalan (IncomeRecord) di range ini
    invoices_in_range = [inv for inv in invoices_all if start_date <= inv.invoice_date <= end_date]
    total_material_sales = sum(float(ir.amount or 0) for ir in material_rows)

    # ── Expense calculation (Paid vs Unpaid) ──
    from ...models.expense import Expense
    from ...models.payroll import PayrollRecord
    from ...models.invoice import Invoice
    
    # Other expenses
    other_expenses = db.query(Expense).filter(
        Expense.expense_date >= start_date,
        Expense.expense_date <= end_date,
        Expense.approval_status == "approved"
    ).all()
    expense_paid = sum(float(e.amount or 0) for e in other_expenses if e.payment_status == "paid")
    expense_unpaid = sum(float(e.amount or 0) for e in other_expenses if e.payment_status == "unpaid")
    
    # Fuel expenses
    # fuel_purchases_rows already fetched (approved)
    fuel_paid = sum(float(fp.total_price or 0) for fp in fuel_purchases_rows if getattr(fp, "payment_status", "unpaid") == "paid")
    fuel_unpaid = sum(float(fp.total_price or 0) for fp in fuel_purchases_rows if getattr(fp, "payment_status", "unpaid") == "unpaid")
    
    # Payroll expenses
    # Calculate for the period using PayrollRecord
    payroll_rows = db.query(PayrollRecord).filter(
        PayrollRecord.payment_date >= start_date,
        PayrollRecord.payment_date <= end_date
    ).all()
    payroll_paid = sum(float(r.net_salary or 0) for r in payroll_rows if r.payment_status == "paid")
    payroll_unpaid = sum(float(r.net_salary or 0) for r in payroll_rows if r.payment_status == "pending")
    
    # Rental cost expense
    total_equipment_rental_expense = sum(wb.total_rental_cost for wb in work_logs_by_equipment)
    
    total_expense_paid = expense_paid + fuel_paid + payroll_paid
    total_expense_unpaid = expense_unpaid + fuel_unpaid + payroll_unpaid + total_equipment_rental_expense
    total_expense_actual = total_expense_paid + total_expense_unpaid

    # ── Income calculation (Paid vs Unpaid) ──
    # Project payments (all paid)
    project_rows = db.query(IncomeRecord).filter(
        IncomeRecord.income_date >= start_date,
        IncomeRecord.income_date <= end_date,
        IncomeRecord.income_type == "project_payment",
    ).all()
    total_project_sales = sum(float(r.amount or 0) for r in project_rows)
    
    # Calculate unpaid material sales based on IncomeRecord
    material_unpaid = 0.0
    for ir in material_rows:
        ir_amount = float(ir.amount or 0)
        # Find covering invoice
        covering_inv = None
        for inv in invoices_all:
            if inv.customer_name == ir.customer_name and inv.start_date <= ir.income_date <= inv.end_date:
                covering_inv = inv
                break
        
        if not covering_inv:
            material_unpaid += ir_amount
        elif covering_inv.status == "unpaid":
            material_unpaid += ir_amount
            
    total_income_unpaid = material_unpaid
    
    total_income_all = total_material_sales + total_project_sales
    total_income_paid = total_income_all - total_income_unpaid
    if total_income_paid < 0:
        total_income_paid = 0

    net_balance = total_income_all - total_expense_actual

    return RangeReport(
        period_start=str(start_date),
        period_end=str(end_date),
        summary=ReportSummary(
            total_fuel_expense=round(total_fuel_expense, 2),
            total_fuel_liters=round(total_fuel_liters_purchased, 2),
            total_work_hours=round(total_work_hours, 2),
            total_equipment_rental_expense=round(total_equipment_rental_expense, 2),
            total_payroll_expense=round(total_payroll_expense, 2),
            total_material_sales=round(total_material_sales, 2),
            net_balance=round(net_balance, 2),
            total_present_days=total_present_global,
            total_employees=len(attendance_summary),
            total_income_paid=round(total_income_paid, 2),
            total_income_unpaid=round(total_income_unpaid, 2),
            total_expense_paid=round(total_expense_paid, 2),
            total_expense_unpaid=round(total_expense_unpaid, 2),
            uninvoiced_material_total=round(sum(float(ir.amount or 0) for ir in uninvoiced_material_sales), 2),
        ),
        fuel_purchases=fuel_purchases,
        fuel_by_equipment=fuel_by_equipment,
        work_logs_by_equipment=work_logs_by_equipment,
        work_logs_detail=work_logs_detail,
        attendance_summary=attendance_summary,
        material_sales=material_items,
    )
