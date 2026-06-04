from collections import defaultdict
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from ..models import Equipment, User
from ..models.employee import Employee
from ..models.fuel_log import FuelLog
from ..models.fuel_price import FuelPrice
from ..models.income_record import IncomeRecord
from ..models.payroll import Attendance, PayrollRecord
from ..models.work_log import WorkLog
from ..models.project import Project
from ..models.expense import Expense
from ..core.exceptions import ValidationError

from ..schemas.report import (
    FuelPurchaseItem,
    FuelByEquipmentItem,
    WorkLogDetailItem,
    WorkLogByEquipmentItem,
    AttendanceEmployeeItem,
    MaterialSaleItem,
    ReportSummary,
    RangeReport,
    CashFlowIncome,
    CashFlowExpense,
    CashFlowReport,
)

def _fmt_date(d) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y-%m-%d")
    return str(d)

class ReportService:
    @staticmethod
    def get_range_report(db: Session, start_date: date, end_date: date) -> RangeReport:
        if start_date > end_date:
            raise ValidationError("start_date tidak boleh lebih besar dari end_date")

        equipment_map: dict = {}

        # 1. Fuel Purchases
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
        total_fuel_purchase_cost = 0.0
        total_fuel_liters_purchased = 0.0

        for fp in fuel_purchases_rows:
            total_price = float(fp.total_price or 0)
            liters = float(fp.liters or 0)
            total_fuel_purchase_cost += total_price
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

        from ..api.v1.utils import calculate_fifo_fuel_costs, calculate_material_sales_income
        
        # 2. Fuel Log & FIFO
        log_costs = calculate_fifo_fuel_costs(db)

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
        total_fuel_usage_cost = 0.0
        total_fuel_liters_used = 0.0
        
        for fl in fuel_log_rows:
            eq_id = fl.equipment_id
            cost = log_costs.get(fl.id, 0.0)
            liters = float(fl.liters_filled or 0)
            
            total_fuel_usage_cost += cost
            total_fuel_liters_used += liters
            
            if eq_id:
                eq_ids.add(eq_id)
                fuel_by_eq_dict[eq_id]["liters"] += liters
                fuel_by_eq_dict[eq_id]["count"] += 1
                fuel_by_eq_dict[eq_id]["cost"] += cost

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

        # 3. Work Logs
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
        wl_by_eq_dict = defaultdict(lambda: {"total_hours": 0.0, "discount_hours": 0.0, "payable_hours": 0.0, "rental_rate_per_hour": 0.0, "rental_cost": 0.0, "count": 0})
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
                wl_by_eq_dict[eq_id]["rental_rate_per_hour"] = rental_rate
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
                rental_rate_per_hour=rental_rate,
                total_rental_cost=round(rental_cost, 2),
                work_description=wl.work_description,
            ))

            if wl.operator_name and d_hours > 0:
                eq_type = eq.type.lower() if eq and eq.type else ""
                op_key = wl.operator_name.strip().lower()
                
                if "breaker" in eq_type:
                    rate = float(eq.rental_rate_per_hour or 0)
                    operator_bonus_dict[op_key] += d_hours * (0.5 * rate)
                elif "bucket" in eq_type:
                    capacity = eq.capacity or 0
                    if capacity >= 30:
                        operator_bonus_dict[op_key] += d_hours * 150000.0
                    elif capacity >= 20:
                        operator_bonus_dict[op_key] += d_hours * 100000.0
                    else:
                        operator_bonus_dict[op_key] += d_hours * 100000.0
                else:
                    operator_bonus_dict[op_key] += d_hours * 100000.0

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
                rental_rate_per_hour=stats["rental_rate_per_hour"],
                total_rental_cost=round(stats["rental_cost"], 2),
                log_count=stats["count"],
            ))
        work_logs_by_equipment.sort(key=lambda x: x.equipment_name)

        # 4. Attendance & Estimated Salary
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
            "work_hours": 0.0, "ot_hours": 0.0,
            "basic_salary_acc": 0.0
        })
        for a in att_rows:
            emp = emp_map.get(a.employee_id)
            daily_salary = float(emp.daily_salary) if emp and emp.daily_salary else 0.0
            
            d = agg[a.employee_id]
            status = (a.status or "present").lower()
            if status in ("present", "late"):
                d["present"] += 1
                if status == "late":
                    d["late"] += 1
                    
                w_hours = float(a.work_hours or 0)
                if w_hours < 6:
                    d["basic_salary_acc"] += (daily_salary * 0.5)
                else:
                    d["basic_salary_acc"] += daily_salary
            else:
                d["absent"] += 1
            d["work_hours"] += float(a.work_hours or 0)
            
            w_hours = float(a.work_hours or 0)
            ot_hours = float(a.overtime_hours or 0)
            if w_hours > 12:
                ot_hours += (w_hours - 12)
            d["ot_hours"] += ot_hours

        attendance_summary: List[AttendanceEmployeeItem] = []
        total_payroll_expense = 0.0
        total_present_global = 0

        for emp_id, stats in agg.items():
            emp = emp_map.get(emp_id)
            daily = float(emp.daily_salary if emp else 0)
            
            emp_name_lower = emp.name.strip().lower() if emp else ""
            bonus = operator_bonus_dict.get(emp_name_lower, 0.0)
            
            overtime_rate = float(emp.hourly_overtime_rate if emp and emp.hourly_overtime_rate else 0)
            overtime_amount = stats["ot_hours"] * overtime_rate
            
            estimated = stats["basic_salary_acc"] + bonus + overtime_amount
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

        # 5. Material Sales
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
        for ir in material_rows:
            amt = float(ir.amount or 0)
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
            
        total_material_sales, _ = calculate_material_sales_income(db, start_date, end_date)

        # Summary
        total_equipment_rental_expense = sum(wb.total_rental_cost for wb in work_logs_by_equipment)
        total_expense_actual = total_fuel_usage_cost + total_equipment_rental_expense + total_payroll_expense
        net_balance = total_material_sales - total_expense_actual

        return RangeReport(
            period_start=str(start_date),
            period_end=str(end_date),
            summary=ReportSummary(
                total_fuel_expense=round(total_fuel_usage_cost, 2),
                total_fuel_liters=round(total_fuel_liters_used, 2),
                total_work_hours=round(total_work_hours, 2),
                total_equipment_rental_expense=round(total_equipment_rental_expense, 2),
                total_payroll_expense=round(total_payroll_expense, 2),
                total_material_sales=round(total_material_sales, 2),
                net_balance=round(net_balance, 2),
                total_present_days=total_present_global,
                total_employees=len(attendance_summary),
                total_income_paid=round(total_material_sales, 2),
                total_income_unpaid=0.0,
                total_expense_paid=round(total_expense_actual, 2),
                total_expense_unpaid=0.0,
                fuel_paid=round(total_fuel_usage_cost, 2),
                fuel_unpaid=0.0,
                payroll_paid=round(total_payroll_expense, 2),
                payroll_unpaid=0.0,
                other_expense_paid=0.0,
                other_expense_unpaid=0.0,
                uninvoiced_material_total=0.0,
            ),
            fuel_purchases=fuel_purchases,
            fuel_by_equipment=fuel_by_equipment,
            work_logs_by_equipment=work_logs_by_equipment,
            work_logs_detail=work_logs_detail,
            attendance_summary=attendance_summary,
            material_sales=material_items,
        )

    @staticmethod
    def get_cash_flow_report(db: Session, start_date: date, end_date: date, project_id: Optional[str] = None) -> CashFlowReport:
        filter_general = project_id == 'general'
        filter_project_id: Optional[int] = None
        if project_id and project_id != 'general':
            try:
                filter_project_id = int(project_id)
            except ValueError:
                raise ValidationError("project_id tidak valid")
        
        projects = db.query(Project).all()
        project_map = {p.id: p.name for p in projects}

        incomes: List[CashFlowIncome] = []
        expenses: List[CashFlowExpense] = []

        # 1. INCOMES
        income_q = db.query(IncomeRecord).filter(
            IncomeRecord.income_date >= start_date,
            IncomeRecord.income_date <= end_date
        )
        if filter_general:
            income_q = income_q.filter(IncomeRecord.project_id == None)
        elif filter_project_id:
            income_q = income_q.filter(IncomeRecord.project_id == filter_project_id)
            
        for inc in income_q.all():
            incomes.append(CashFlowIncome(
                id=f"inc_{inc.id}",
                date=_fmt_date(inc.income_date) or "",
                source_type="Material Sale" if inc.income_type == "material_sale" else "Project Payment",
                description=inc.description or f"Penjualan ke {inc.customer_name}",
                amount=float(inc.amount or 0),
                project_id=inc.project_id,
                project_name=project_map.get(inc.project_id) if inc.project_id else None
            ))

        # 2. EXPENSES
        # A. Expense (Others & Deposit)
        exp_q = db.query(Expense).filter(
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
            Expense.payment_status == 'paid',
            Expense.category != 'gaji'
        )
        if filter_general:
            exp_q = exp_q.filter(Expense.project_id == None)
        elif filter_project_id:
            exp_q = exp_q.filter(Expense.project_id == filter_project_id)
        for exp in exp_q.all():
            expense_type = "Equipment Deposit" if exp.category == "deposit" else "Other Expense"
            expenses.append(CashFlowExpense(
                id=f"exp_{exp.id}",
                date=_fmt_date(exp.expense_date) or "",
                expense_type=expense_type,
                description=exp.description or exp.category,
                amount=float(exp.amount or 0),
                project_id=exp.project_id,
                project_name=project_map.get(exp.project_id) if exp.project_id else None
            ))
            
        # B. Fuel Purchases
        fuel_q = db.query(FuelPrice).filter(
            cast(FuelPrice.effective_date, Date) >= start_date,
            cast(FuelPrice.effective_date, Date) <= end_date,
            FuelPrice.payment_status == 'paid'
        )
        if filter_general:
            fuel_q = fuel_q.filter(FuelPrice.project_id == None)
        elif filter_project_id:
            fuel_q = fuel_q.filter(FuelPrice.project_id == filter_project_id)
        for fuel in fuel_q.all():
            expenses.append(CashFlowExpense(
                id=f"fuel_{fuel.id}",
                date=_fmt_date(fuel.effective_date) or "",
                expense_type="Fuel",
                description=f"Pembelian BBM {fuel.fuel_type} {fuel.liters or 0} L - {fuel.vendor_name or ''}",
                amount=float(fuel.total_price or 0),
                project_id=fuel.project_id,
                project_name=project_map.get(fuel.project_id) if fuel.project_id else None
            ))
            
        # C. Payroll
        payroll_q = db.query(PayrollRecord).filter(
            PayrollRecord.payment_date >= start_date,
            PayrollRecord.payment_date <= end_date,
            PayrollRecord.payment_status == 'paid'
        )
        if filter_general:
            payroll_q = payroll_q.filter(PayrollRecord.project_id == None)
        elif filter_project_id:
            payroll_q = payroll_q.filter(PayrollRecord.project_id == filter_project_id)
        for pay in payroll_q.all():
            expenses.append(CashFlowExpense(
                id=f"pay_{pay.id}",
                date=_fmt_date(pay.payment_date) or "",
                expense_type="Payroll",
                description=f"Gaji {pay.employee.name if pay.employee else 'Karyawan'}",
                amount=float(pay.net_salary or 0),
                project_id=pay.project_id,
                project_name=project_map.get(pay.project_id) if pay.project_id else None
            ))

        total_income = sum(i.amount for i in incomes)
        total_expense = sum(e.amount for e in expenses)
        
        incomes.sort(key=lambda x: x.date, reverse=True)
        expenses.sort(key=lambda x: x.date, reverse=True)

        return CashFlowReport(
            period_start=str(start_date),
            period_end=str(end_date),
            project_id=filter_project_id,
            total_income=total_income,
            total_expense=total_expense,
            net_balance=total_income - total_expense,
            incomes=incomes,
            expenses=expenses
        )
