from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models import Employee, Equipment, FuelLog, FuelPrice, PayrollRecord, Project
from ...schemas import Employee as EmployeeSchema
from ...schemas import Equipment as EquipmentSchema
from ...schemas import Project as ProjectSchema

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    equipment_count = db.query(Equipment).count()
    employee_count = db.query(Employee).filter(Employee.is_active == True).count()
    project_count = db.query(Project).count()

    return {
        "equipment_count": equipment_count,
        "employee_count": employee_count,
        "project_count": project_count,
    }


@router.get("/payroll-summary")
def get_payroll_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return payroll overview for the dashboard:
    - Pending approval count + total value
    - Approved (this month) count + total value
    - Paid (this month) count + total value
    - Total net_salary paid this month
    """
    today = date.today()
    month_start = today.replace(day=1)

    # --- Pending (all time – awaiting GM approval) ---
    pending_q = (
        db.query(
            func.count(PayrollRecord.id).label("count"),
            func.coalesce(func.sum(PayrollRecord.net_salary), 0).label("total"),
        )
        .filter(PayrollRecord.payment_status == "pending")
        .one()
    )

    # --- Approved this month ---
    approved_q = (
        db.query(
            func.count(PayrollRecord.id).label("count"),
            func.coalesce(func.sum(PayrollRecord.net_salary), 0).label("total"),
        )
        .filter(
            PayrollRecord.payment_status == "approved",
            PayrollRecord.period_start >= month_start,
        )
        .one()
    )

    # --- Paid this month ---
    paid_q = (
        db.query(
            func.count(PayrollRecord.id).label("count"),
            func.coalesce(func.sum(PayrollRecord.net_salary), 0).label("total"),
        )
        .filter(
            PayrollRecord.payment_status == "paid",
            PayrollRecord.period_start >= month_start,
        )
        .one()
    )

    # --- Recent pending records (for quick action list) ---
    recent_pending = (
        db.query(PayrollRecord)
        .filter(PayrollRecord.payment_status == "pending")
        .order_by(PayrollRecord.created_at.desc())
        .limit(5)
        .all()
    )
    pending_list = [
        {
            "id": r.id,
            "employee_name": r.employee.name if r.employee else "-",
            "period_start": str(r.period_start),
            "period_end": str(r.period_end),
            "net_salary": r.net_salary,
        }
        for r in recent_pending
    ]

    return {
        "pending_count": pending_q.count,
        "pending_total": float(pending_q.total),
        "approved_count": approved_q.count,
        "approved_total": float(approved_q.total),
        "paid_count": paid_q.count,
        "paid_total": float(paid_q.total),
        "recent_pending": pending_list,
        "month_label": today.strftime("%B %Y"),
    }


@router.get("/equipment")
def get_equipment(db: Session = Depends(get_db)):
    equipment = db.query(Equipment).all()
    return [EquipmentSchema.model_validate(eq) for eq in equipment]


@router.get("/employees")
def get_employees(db: Session = Depends(get_db)):
    employees = db.query(Employee).filter(Employee.is_active == True).all()
    return [EmployeeSchema.model_validate(emp) for emp in employees]


@router.get("/projects")
def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return [ProjectSchema.model_validate(proj) for proj in projects]


# ---------------------------------------------------------------------------
# Laporan Harian Keuangan GM
# ---------------------------------------------------------------------------


@router.get("/daily-report")
def get_daily_report(
    report_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Laporan harian keuangan untuk GM:
    - Pengeluaran: gaji (payroll paid hari itu), BBM (fuel_logs x harga BBM), expenses lain-lain
    - Pemasukan: pembayaran proyek, penjualan material
    """
    from datetime import date as date_type

    from ...models.expense import Expense
    from ...models.income_record import IncomeRecord

    if report_date is None:
        report_date = date_type.today()

    # 1. GAJI yang dibayar pada tanggal ini
    payroll_records = (
        db.query(PayrollRecord)
        .filter(
            PayrollRecord.payment_date == report_date,
            PayrollRecord.payment_status == "paid",
        )
        .all()
    )
    payroll_total = sum(float(r.net_salary or 0) for r in payroll_records)

    # 2. BBM — ambil harga BBM efektif pada tanggal itu (paling baru sebelum/pada tanggal itu) yang sudah diapprove
    fuel_price_obj = (
        db.query(FuelPrice)
        .filter(func.date(FuelPrice.effective_date) <= report_date, FuelPrice.approval_status == 'approved')
        .order_by(FuelPrice.effective_date.desc())
        .first()
    )
    price_per_liter = float(fuel_price_obj.price_per_liter) if fuel_price_obj else 0.0

    fuel_rows = (
        db.query(FuelLog, Equipment.name.label("equipment_name"))
        .join(Equipment, FuelLog.equipment_id == Equipment.id)
        .filter(func.date(FuelLog.refuel_date) == report_date)
        .all()
    )
    total_liters = sum(float(row.FuelLog.liters_filled or 0) for row in fuel_rows)
    fuel_total = total_liters * price_per_liter

    # 3. Pengeluaran lain-lain dari tabel expenses (hanya yang sudah diapprove)
    from sqlalchemy import or_
    other_expenses = db.query(Expense).filter(
        Expense.approval_status == "approved",
        or_(
            Expense.expense_date == report_date,
            func.date(Expense.paid_at) == report_date
        )
    ).all()
    expenses_by_cat: dict = {}
    for exp in other_expenses:
        cat = exp.category or "lain-lain"
        expenses_by_cat[cat] = expenses_by_cat.get(cat, 0) + float(exp.amount or 0)
    other_expenses_total = sum(float(e.amount or 0) for e in other_expenses)

    # 4. Pemasukan
    income_records = (
        db.query(IncomeRecord).filter(IncomeRecord.income_date == report_date).all()
    )
    project_income = [r for r in income_records if r.income_type == "project_payment"]
    material_income = [r for r in income_records if r.income_type == "material_sale"]
    project_income_total = sum(float(r.amount or 0) for r in project_income)
    material_income_total = sum(float(r.amount or 0) for r in material_income)

    total_expense = payroll_total + fuel_total + other_expenses_total
    total_income = project_income_total + material_income_total

    # Build payroll items (join employee name)
    payroll_items = []
    for r in payroll_records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        payroll_items.append(
            {
                "id": r.id,
                "employee_name": emp.name if emp else "-",
                "position": emp.position if emp else "-",
                "net_salary": float(r.net_salary or 0),
                "period_start": str(r.period_start),
                "period_end": str(r.period_end),
                "payment_method": r.payment_method,
            }
        )

    # 5. Split Paid vs Unpaid (For Daily Report)
    from ...models.invoice import Invoice
    # Paid Payroll
    payroll_paid = payroll_total
    # Unpaid Payroll (not computed in daily report natively, assuming 0 for daily snapshot or we can just fetch pending payroll for the date)
    payroll_unpaid = 0 
    
    # Fuel Paid/Unpaid (FuelPrice on this date)
    fuel_paid = float(fuel_price_obj.total_price or 0) if fuel_price_obj and getattr(fuel_price_obj, "payment_status", "unpaid") == "paid" else 0
    fuel_unpaid = fuel_total - fuel_paid if fuel_total > fuel_paid else fuel_total # simple fallback
    
    # Expense Paid/Unpaid
    expense_paid = sum(float(e.amount or 0) for e in other_expenses if e.payment_status == "paid")
    expense_unpaid = sum(float(e.amount or 0) for e in other_expenses if e.payment_status == "unpaid")

    total_expense_paid = payroll_paid + fuel_paid + expense_paid
    total_expense_unpaid = payroll_unpaid + fuel_unpaid + expense_unpaid

    # Income Paid/Unpaid
    # Project Payments are assumed paid
    project_paid = project_income_total
    # Unpaid material sales (Invoices created today)
    unpaid_invoices_today = db.query(Invoice).filter(
        Invoice.invoice_date == report_date,
        Invoice.status == "unpaid"
    ).all()
    material_unpaid = sum(float(inv.total_amount or 0) for inv in unpaid_invoices_today)
    material_paid = material_income_total - material_unpaid if material_income_total > material_unpaid else material_income_total

    total_income_paid = project_paid + material_paid
    total_income_unpaid = material_unpaid

    return {
        "date": str(report_date),
        "summary": {
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "net": round(total_income - total_expense, 2),
            "total_income_paid": round(total_income_paid, 2),
            "total_income_unpaid": round(total_income_unpaid, 2),
            "total_expense_paid": round(total_expense_paid, 2),
            "total_expense_unpaid": round(total_expense_unpaid, 2),
        },
        "expenses": {
            "payroll": {
                "total": round(payroll_total, 2),
                "count": len(payroll_records),
                "items": payroll_items,
            },
            "fuel": {
                "total": round(fuel_total, 2),
                "total_liters": round(total_liters, 2),
                "price_per_liter": price_per_liter,
                "count": len(fuel_rows),
                "items": [
                    {
                        "id": row.FuelLog.id,
                        "equipment_name": row.equipment_name,
                        "liters": float(row.FuelLog.liters_filled or 0),
                        "cost": float(row.FuelLog.liters_filled or 0) * price_per_liter,
                        "location": row.FuelLog.location,
                        "notes": row.FuelLog.notes,
                    }
                    for row in fuel_rows
                ],
            },
            "others": {
                "total": round(other_expenses_total, 2),
                "by_category": expenses_by_cat,
                "count": len(other_expenses),
                "items": [
                    {
                        "id": e.id,
                        "category": e.category,
                        "description": e.description,
                        "amount": float(e.amount or 0),
                        "notes": e.notes,
                    }
                    for e in other_expenses
                ],
            },
        },
        "income": {
            "project_payments": {
                "total": round(project_income_total, 2),
                "count": len(project_income),
                "items": [
                    {
                        "id": r.id,
                        "description": r.description,
                        "amount": float(r.amount or 0),
                        "payment_term": r.payment_term,
                        "payment_method": r.payment_method,
                        "notes": r.notes,
                    }
                    for r in project_income
                ],
            },
            "material_sales": {
                "total": round(material_income_total, 2),
                "count": len(material_income),
                "items": [
                    {
                        "id": r.id,
                        "customer_name": r.customer_name,
                        "material_type": r.material_type,
                        "quantity": r.quantity,
                        "unit": r.unit,
                        "unit_price": r.unit_price,
                        "amount": float(r.amount or 0),
                        "notes": r.notes,
                    }
                    for r in material_income
                ],
            },
        },
    }


@router.get("/daily-report/history")
def get_daily_report_history(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Ringkasan laporan harian untuk N hari terakhir."""
    from datetime import date as date_type

    from ...models.expense import Expense
    from ...models.income_record import IncomeRecord

    today = date_type.today()
    result = []

    for i in range(days - 1, -1, -1):  # dari paling lama ke hari ini
        d = today - timedelta(days=i)

        # Payroll
        p_total = (
            db.query(func.coalesce(func.sum(PayrollRecord.net_salary), 0))
            .filter(
                PayrollRecord.payment_date == d,
                PayrollRecord.payment_status == "paid",
            )
            .scalar()
        )

        # Fuel cost
        fuel_price_obj = (
            db.query(FuelPrice)
            .filter(func.date(FuelPrice.effective_date) <= d, FuelPrice.approval_status == 'approved')
            .order_by(FuelPrice.effective_date.desc())
            .first()
        )
        ppl = float(fuel_price_obj.price_per_liter) if fuel_price_obj else 0.0
        liters = (
            db.query(func.coalesce(func.sum(FuelLog.liters_filled), 0))
            .filter(func.date(FuelLog.refuel_date) == d)
            .scalar()
        )
        fuel_cost = float(liters or 0) * ppl

        # Other expenses
        from sqlalchemy import or_
        other = (
            db.query(func.coalesce(func.sum(Expense.amount), 0))
            .filter(
                Expense.approval_status == "approved",
                or_(
                    Expense.expense_date == d,
                    func.date(Expense.paid_at) == d
                )
            )
            .scalar()
        )

        # Income
        income = (
            db.query(func.coalesce(func.sum(IncomeRecord.amount), 0))
            .filter(IncomeRecord.income_date == d)
            .scalar()
        )

        total_exp = float(p_total or 0) + fuel_cost + float(other or 0)
        total_inc = float(income or 0)

        result.append(
            {
                "date": str(d),
                "date_label": d.strftime("%d %b"),
                "total_expense": round(total_exp, 2),
                "total_income": round(total_inc, 2),
                "net": round(total_inc - total_exp, 2),
                "payroll": round(float(p_total or 0), 2),
                "fuel": round(fuel_cost, 2),
                "others": round(float(other or 0), 2),
            }
        )

    return result

@router.get("/finance-summary")
def get_finance_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Ringkasan khusus untuk dashboard Finance"""
    from ...models.expense import Expense
    from ...models.fuel_price import FuelPrice
    from ...models.invoice import Invoice
    from ...models.payroll import PayrollRecord
    from ...models.income_record import IncomeRecord
    from ...models.employee import Employee
    
    # 1. Unpaid Expenses
    unpaid_expenses_list = db.query(Expense).filter(
        Expense.approval_status == "approved",
        Expense.payment_status == "unpaid"
    ).order_by(Expense.expense_date.desc()).all()
    unpaid_expenses_amount = sum(float(e.amount or 0) for e in unpaid_expenses_list)
    unpaid_expenses = [
        {"id": e.id, "date": str(e.expense_date), "category": e.category, "description": e.description, "amount": float(e.amount or 0)}
        for e in unpaid_expenses_list
    ]

    # 2. Unpaid Fuel
    unpaid_fuel_list = db.query(FuelPrice).filter(
        FuelPrice.approval_status == "approved",
        FuelPrice.payment_status == "unpaid"
    ).order_by(FuelPrice.effective_date.desc()).all()
    unpaid_fuel_amount = sum(float(f.total_price or 0) for f in unpaid_fuel_list)
    unpaid_fuel = [
        {"id": f.id, "date": str(f.effective_date), "liters": float(f.liters or 0), "amount": float(f.total_price or 0), "notes": f.notes}
        for f in unpaid_fuel_list
    ]

    # 3. Unpaid Payroll
    unpaid_payroll_list = db.query(PayrollRecord).filter(
        PayrollRecord.payment_status == "approved"
    ).order_by(PayrollRecord.period_start.desc()).all()
    unpaid_payroll_amount = sum(float(p.net_salary or 0) for p in unpaid_payroll_list)
    unpaid_payroll = []
    for p in unpaid_payroll_list:
        emp = db.query(Employee).filter(Employee.id == p.employee_id).first()
        unpaid_payroll.append({
            "id": p.id, "employee_name": emp.name if emp else "-", "period_start": str(p.period_start), "period_end": str(p.period_end), "amount": float(p.net_salary or 0)
        })

    # 4. Unpaid Invoices
    unpaid_invoices_list = db.query(Invoice).filter(
        Invoice.status == "unpaid"
    ).order_by(Invoice.invoice_date.desc()).all()
    unpaid_invoices_amount = sum(float(i.total_amount or 0) for i in unpaid_invoices_list)
    unpaid_invoices = [
        {"id": i.id, "invoice_number": i.invoice_number, "customer_name": i.customer_name, "date": str(i.invoice_date), "amount": float(i.total_amount or 0)}
        for i in unpaid_invoices_list
    ]
    
    total_unpaid_bills_amount = unpaid_expenses_amount + unpaid_fuel_amount + unpaid_payroll_amount
    total_unpaid_bills_count = len(unpaid_expenses_list) + len(unpaid_fuel_list) + len(unpaid_payroll_list)

    # 5. Pending approvals
    pending_fuel_q = db.query(FuelPrice).filter(FuelPrice.approval_status == "pending")
    pending_fuel_purchases = pending_fuel_q.count()
    recent_pending_fuel_list = pending_fuel_q.order_by(FuelPrice.effective_date.desc()).limit(10).all()
    recent_pending_fuel = [
        {
            "id": f.id,
            "effective_date": str(f.effective_date),
            "liters": float(f.liters) if f.liters else 0,
            "total_price": float(f.total_price) if f.total_price else 0,
            "notes": f.notes
        }
        for f in recent_pending_fuel_list
    ]

    pending_expenses = db.query(Expense).filter(Expense.approval_status == "pending").count()
    
    # 6. Uninvoiced Material Sales (Notification)
    material_sales = db.query(IncomeRecord).filter(IncomeRecord.income_type == "material_sale").all()
    invoices_all = db.query(Invoice).all()
    uninvoiced_sales = []
    for ms in material_sales:
        is_invoiced = False
        for inv in invoices_all:
            if inv.customer_name == ms.customer_name and inv.start_date <= ms.income_date <= inv.end_date:
                is_invoiced = True
                break
        if not is_invoiced:
            uninvoiced_sales.append({
                "id": ms.id, 
                "date": str(ms.income_date), 
                "customer_name": ms.customer_name, 
                "material_type": ms.material_type, 
                "amount": float(ms.amount or 0)
            })
    
    return {
        "unpaid_bills_amount": total_unpaid_bills_amount,
        "unpaid_bills_count": total_unpaid_bills_count,
        "unpaid_invoices_amount": unpaid_invoices_amount,
        "unpaid_invoices_count": len(unpaid_invoices_list),
        "unpaid_expenses": unpaid_expenses,
        "unpaid_fuel": unpaid_fuel,
        "unpaid_payroll": unpaid_payroll,
        "unpaid_invoices": unpaid_invoices,
        "uninvoiced_material_sales": uninvoiced_sales,
        "uninvoiced_material_sales_count": len(uninvoiced_sales),
        "pending_fuel_purchases": pending_fuel_purchases,
        "pending_expenses": pending_expenses,
        "recent_pending_fuel": recent_pending_fuel
    }
