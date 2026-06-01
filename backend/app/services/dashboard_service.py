from datetime import date, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..models import Employee, Equipment, FuelLog, FuelPrice, PayrollRecord, Project, Vendor
from ..models.expense import Expense
from ..models.income_record import IncomeRecord
from ..models.invoice import Invoice
from ..models.work_log import WorkLog
from ..models.vendor import VendorTopUp
from ..models.payroll import Attendance
from ..api.v1.utils import calculate_fifo_fuel_costs, calculate_material_sales_income
from ..api.v1.work_logs import _calculate_rental_costs

class DashboardService:
    @staticmethod
    def get_dashboard_stats(db: Session) -> Dict[str, int]:
        equipment_count = db.query(Equipment).count()
        employee_count = db.query(Employee).filter(Employee.is_active == True).count()
        project_count = db.query(Project).count()
        return {
            "equipment_count": equipment_count,
            "employee_count": employee_count,
            "project_count": project_count,
        }

    @staticmethod
    def get_payroll_summary(db: Session) -> Dict[str, Any]:
        today = date.today()
        month_start = today.replace(day=1)

        pending_q = (
            db.query(
                func.count(PayrollRecord.id).label("count"),
                func.coalesce(func.sum(PayrollRecord.net_salary), 0).label("total"),
            )
            .filter(PayrollRecord.payment_status == "pending")
            .one()
        )

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

    @staticmethod
    def get_equipment(db: Session) -> List[Any]:
        return db.query(Equipment).all()

    @staticmethod
    def get_employees(db: Session) -> List[Any]:
        return db.query(Employee).filter(Employee.is_active == True).all()

    @staticmethod
    def get_projects(db: Session) -> List[Any]:
        return db.query(Project).all()

    @staticmethod
    def get_daily_report(db: Session, report_date: Optional[date] = None) -> Dict[str, Any]:
        if report_date is None:
            report_date = date.today()

        payroll_records = (
            db.query(PayrollRecord)
            .filter(
                PayrollRecord.payment_date == report_date,
                PayrollRecord.payment_status == "paid",
            )
            .all()
        )
        payroll_total = sum(float(r.net_salary or 0) for r in payroll_records)

        log_costs = calculate_fifo_fuel_costs(db)
        fuel_rows = (
            db.query(FuelLog, Equipment.name.label("equipment_name"))
            .join(Equipment, FuelLog.equipment_id == Equipment.id)
            .filter(func.date(FuelLog.refuel_date) == report_date)
            .all()
        )
        total_liters = sum(float(row.FuelLog.liters_filled or 0) for row in fuel_rows)
        fuel_total = sum(log_costs.get(row.FuelLog.id, 0.0) for row in fuel_rows)
        price_per_liter = fuel_total / total_liters if total_liters > 0 else 0.0

        other_expenses = db.query(Expense).filter(
            Expense.approval_status == "approved",
            Expense.category != "deposit",
            Expense.expense_date == report_date
        ).all()
        expenses_by_cat: Dict[str, float] = {}
        for exp in other_expenses:
            cat = exp.category or "lain-lain"
            expenses_by_cat[cat] = expenses_by_cat.get(cat, 0) + float(exp.amount or 0)
        other_expenses_total = sum(float(e.amount or 0) for e in other_expenses)

        income_records = (
            db.query(IncomeRecord).filter(IncomeRecord.income_date == report_date).all()
        )
        project_income = [r for r in income_records if r.income_type == "project_payment"]
        project_income_total = sum(float(r.amount or 0) for r in project_income)
        
        material_income_total, uninvoiced_material_sales = calculate_material_sales_income(db, report_date, report_date)
        uninvoiced_material_total = sum(float(r.amount or 0) for r in uninvoiced_material_sales)

        work_logs_today = (
            db.query(WorkLog, Equipment)
            .join(Equipment, WorkLog.equipment_id == Equipment.id)
            .filter(func.date(WorkLog.work_date) == report_date, Equipment.ownership_status == 'rental')
            .all()
        )
        
        rental_total = 0.0
        rental_items = []
        for wl, eq in work_logs_today:
            costs = _calculate_rental_costs(wl, eq)
            total_cost = float(costs["rental_cost_total"])
            rental_total += total_cost
            
            vendor_name = db.query(Vendor.name).filter(Vendor.id == eq.vendor_id).scalar() if eq.vendor_id else "Unknown"
            
            rental_items.append({
                "id": wl.id,
                "equipment_name": eq.name,
                "vendor_name": vendor_name,
                "total_hours": float(wl.total_hours or 0),
                "rental_rate_per_hour": float(costs["rental_rate_per_hour"]),
                "rental_cost_total": total_cost,
            })

        total_expense = payroll_total + fuel_total + other_expenses_total + rental_total
        total_income = project_income_total + material_income_total

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

        payroll_paid = payroll_total
        payroll_unpaid = 0 
        
        fuel_price_obj = (
            db.query(FuelPrice)
            .filter(func.date(FuelPrice.effective_date) <= report_date, FuelPrice.approval_status == 'approved')
            .order_by(FuelPrice.effective_date.desc())
            .first()
        )
        fuel_paid = float(fuel_price_obj.total_price or 0) if fuel_price_obj and getattr(fuel_price_obj, "payment_status", "unpaid") == "paid" else 0
        fuel_unpaid = fuel_total - fuel_paid if fuel_total > fuel_paid else fuel_total 
        
        expense_paid = sum(float(e.amount or 0) for e in other_expenses if e.payment_status == "paid")
        expense_unpaid = sum(float(e.amount or 0) for e in other_expenses if e.payment_status == "unpaid")
        
        rental_paid = rental_total
        rental_unpaid = 0

        total_expense_paid = payroll_paid + fuel_paid + expense_paid + rental_paid
        total_expense_unpaid = payroll_unpaid + fuel_unpaid + expense_unpaid + rental_unpaid

        project_paid = project_income_total
        
        invoices_today = db.query(Invoice).filter(Invoice.invoice_date == report_date).all()
        unpaid_invoices_today = [inv for inv in invoices_today if inv.status == "unpaid"]
        material_unpaid = sum(float(inv.final_amount if inv.final_amount is not None else (inv.total_amount or 0)) for inv in unpaid_invoices_today)
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
                "uninvoiced_material_total": round(uninvoiced_material_total, 2),
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
                            "cost": log_costs.get(row.FuelLog.id, 0.0),
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
                "equipment_rental": {
                    "total": round(rental_total, 2),
                    "count": len(rental_items),
                    "items": rental_items,
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
                    "count": len(invoices_today),
                    "items": [
                        {
                            "id": r.id,
                            "customer_name": r.customer_name,
                            "material_type": "Invoice Tagihan",
                            "quantity": "-",
                            "unit": "-",
                            "unit_price": 0,
                            "amount": float(r.final_amount if r.final_amount is not None else (r.total_amount or 0)),
                            "notes": r.notes,
                        }
                        for r in invoices_today
                    ],
                },
                "uninvoiced_material": {
                    "total": round(uninvoiced_material_total, 2),
                    "count": len(uninvoiced_material_sales),
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
                        for r in uninvoiced_material_sales
                    ],
                },
            },
        }

    @staticmethod
    def get_daily_report_history(db: Session, days: int) -> List[Dict[str, Any]]:
        today = date.today()
        result = []
        
        log_costs = calculate_fifo_fuel_costs(db)

        for i in range(days - 1, -1, -1):
            d = today - timedelta(days=i)

            p_total = (
                db.query(func.coalesce(func.sum(PayrollRecord.net_salary), 0))
                .filter(
                    PayrollRecord.payment_date == d,
                    PayrollRecord.payment_status == "paid",
                )
                .scalar()
            )

            fuel_rows = db.query(FuelLog).filter(func.date(FuelLog.refuel_date) == d).all()
            fuel_cost = sum(log_costs.get(fl.id, 0.0) for fl in fuel_rows)

            other = (
                db.query(func.coalesce(func.sum(Expense.amount), 0))
                .filter(
                    Expense.approval_status == "approved",
                    Expense.expense_date == d
                )
                .scalar()
            )

            project_income = (
                db.query(func.coalesce(func.sum(IncomeRecord.amount), 0))
                .filter(IncomeRecord.income_date == d, IncomeRecord.income_type == "project_payment")
                .scalar()
            )
            material_income, _ = calculate_material_sales_income(db, d, d)
            total_inc = float(project_income or 0) + material_income

            total_exp = float(p_total or 0) + fuel_cost + float(other or 0)

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

    @staticmethod
    def get_finance_summary(db: Session) -> Dict[str, Any]:
        unpaid_expenses_list = db.query(Expense).filter(
            Expense.approval_status == "approved",
            Expense.payment_status == "unpaid"
        ).order_by(Expense.expense_date.desc()).all()
        unpaid_expenses_amount = sum(float(e.amount or 0) for e in unpaid_expenses_list)
        unpaid_expenses = [
            {"id": e.id, "date": str(e.expense_date), "category": e.category, "description": e.description, "amount": float(e.amount or 0)}
            for e in unpaid_expenses_list
        ]

        unpaid_fuel_list = db.query(FuelPrice).filter(
            FuelPrice.approval_status == "approved",
            FuelPrice.payment_status == "unpaid"
        ).order_by(FuelPrice.effective_date.desc()).all()
        unpaid_fuel_amount = sum(float(f.total_price or 0) for f in unpaid_fuel_list)
        unpaid_fuel = [
            {"id": f.id, "date": str(f.effective_date), "liters": float(f.liters or 0), "amount": float(f.total_price or 0), "notes": f.notes, "vendor_name": f.vendor_name}
            for f in unpaid_fuel_list
        ]

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

        unpaid_invoices_list = db.query(Invoice).filter(
            Invoice.status == "unpaid"
        ).order_by(Invoice.invoice_date.desc()).all()
        unpaid_invoices_amount = sum(float(i.final_amount if i.final_amount is not None else (i.total_amount or 0)) for i in unpaid_invoices_list)
        unpaid_invoices = [
            {"id": i.id, "invoice_number": i.invoice_number, "customer_name": i.customer_name, "date": str(i.invoice_date), "amount": float(i.final_amount if i.final_amount is not None else (i.total_amount or 0))}
            for i in unpaid_invoices_list
        ]
        
        total_unpaid_bills_amount = unpaid_expenses_amount + unpaid_fuel_amount + unpaid_payroll_amount
        total_unpaid_bills_count = len(unpaid_expenses_list) + len(unpaid_fuel_list) + len(unpaid_payroll_list)

        pending_fuel_q = db.query(FuelPrice).filter(FuelPrice.approval_status == "pending")
        pending_fuel_purchases = pending_fuel_q.count()
        recent_pending_fuel_list = pending_fuel_q.order_by(FuelPrice.effective_date.desc()).limit(10).all()
        recent_pending_fuel = [
            {
                "id": f.id,
                "effective_date": str(f.effective_date),
                "liters": float(f.liters) if f.liters else 0,
                "total_price": float(f.total_price) if f.total_price else 0,
                "notes": f.notes,
                "vendor_name": f.vendor_name
            }
            for f in recent_pending_fuel_list
        ]

        pending_expenses = db.query(Expense).filter(Expense.approval_status == "pending").count()
        
        uninvoiced_sales_records = db.query(IncomeRecord).filter(
            IncomeRecord.income_type == "material_sale",
            (IncomeRecord.is_invoiced == False) | (IncomeRecord.is_invoiced == None)
        ).all()
        
        uninvoiced_sales = [
            {
                "id": ms.id, 
                "date": str(ms.income_date), 
                "customer_name": ms.customer_name, 
                "material_type": ms.material_type, 
                "amount": float(ms.amount or 0)
            }
            for ms in uninvoiced_sales_records
        ]
        
        unprocessed_attendance_records = db.query(
            Attendance.employee_id,
            func.count(Attendance.id).label("unprocessed_days")
        ).filter(
            Attendance.status.in_(["present", "late"]),
            (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None)
        ).group_by(Attendance.employee_id).all()
        
        unprocessed_attendances = []
        for rec in unprocessed_attendance_records:
            emp = db.query(Employee).filter(Employee.id == rec.employee_id).first()
            if emp:
                unprocessed_attendances.append({
                    "employee_id": emp.id,
                    "employee_name": emp.name,
                    "unprocessed_days": rec.unprocessed_days
                })
        
        rental_equipments = db.query(Equipment).filter(
            Equipment.vendor_id != None,
            Equipment.ownership_status == "rental"
        ).order_by(Equipment.name).all()
        
        equipment_balances = []
        for eq in rental_equipments:
            vendor_obj = db.query(Vendor).filter(Vendor.id == eq.vendor_id).first()
            
            topups_eq = db.query(VendorTopUp).filter(
                VendorTopUp.equipment_id == eq.id,
                VendorTopUp.status == "approved"
            ).all()
            from decimal import Decimal as D
            total_topup = sum((t.amount for t in topups_eq), D("0"))
            
            work_logs_eq = db.query(WorkLog).filter(WorkLog.equipment_id == eq.id).all()
            total_rental = D("0")
            for wl in work_logs_eq:
                costs = _calculate_rental_costs(wl, eq)
                total_rental += costs["rental_cost_total"]
            
            balance = float(total_topup - total_rental)
            equipment_balances.append({
                "equipment_id": eq.id,
                "equipment_name": eq.name,
                "equipment_type": eq.type,
                "vendor_id": eq.vendor_id,
                "vendor_name": vendor_obj.name if vendor_obj else "-",
                "total_topup": float(total_topup),
                "total_rental_cost": float(total_rental),
                "balance": balance,
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
            "unprocessed_attendances": unprocessed_attendances,
            "unprocessed_attendances_count": len(unprocessed_attendances),
            "pending_fuel_purchases": pending_fuel_purchases,
            "pending_expenses": pending_expenses,
            "recent_pending_fuel": recent_pending_fuel,
            "equipment_balances": equipment_balances,
            "vendor_deposits": equipment_balances,
        }
