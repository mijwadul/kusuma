from typing import List, Optional
from pydantic import BaseModel

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
    rental_rate_per_hour: float
    total_rental_cost: float
    work_description: Optional[str]

class WorkLogByEquipmentItem(BaseModel):
    equipment_id: int
    equipment_name: str
    equipment_type: str
    total_hours: float
    total_discount_hours: float
    total_payable_hours: float
    rental_rate_per_hour: float
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
    estimated_salary: float

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
    fuel_paid: float
    fuel_unpaid: float
    payroll_paid: float
    payroll_unpaid: float
    other_expense_paid: float
    other_expense_unpaid: float
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

class CashFlowIncome(BaseModel):
    id: str
    date: str
    source_type: str
    description: str
    amount: float
    project_id: Optional[int]
    project_name: Optional[str]

class CashFlowExpense(BaseModel):
    id: str
    date: str
    expense_type: str
    description: str
    amount: float
    project_id: Optional[int]
    project_name: Optional[str]

class CashFlowReport(BaseModel):
    period_start: str
    period_end: str
    project_id: Optional[int]
    total_income: float
    total_expense: float
    net_balance: float
    incomes: List[CashFlowIncome]
    expenses: List[CashFlowExpense]
