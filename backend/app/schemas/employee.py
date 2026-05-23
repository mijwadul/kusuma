from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

# ============================================
# Employee Schemas
# ============================================


class EmployeeBase(BaseModel):
    """Base schema dengan field lengkap employee"""

    # Personal Data
    employee_code: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = None
    nik: Optional[str] = None  # Nomor KTP
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    place_of_birth: Optional[str] = None
    gender: Optional[str] = None  # male, female
    marital_status: Optional[str] = None  # single, married, divorced, widowed

    # Employment Data
    position: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = "permanent"  # permanent, contract, freelance
    join_date: Optional[date] = None

    # Status
    status: Optional[str] = "active"  # active, inactive, terminated, on_leave
    is_active: Optional[bool] = True


class EmployeeFinancial(BaseModel):
    """Schema untuk data finansial (hanya Finance/GM yang bisa lihat/edit)"""

    # Payroll Data
    daily_salary: Optional[float] = 0
    hourly_overtime_rate: Optional[float] = 0

    # Loan/Deduction
    loan_balance: Optional[float] = 0
    loan_deduction_per_period: Optional[float] = 0
    debt_to_company: Optional[float] = 0

    # Work Settings
    work_days_per_month: Optional[int] = 25


class EmployeeBank(BaseModel):
    """Schema untuk data bank"""

    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None


class EmployeeEmergency(BaseModel):
    """Schema untuk kontak darurat"""

    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None


# Combine all for full employee data
class EmployeeFull(EmployeeBase, EmployeeFinancial, EmployeeBank, EmployeeEmergency):
    """Full employee data - for internal use"""

    user_id: Optional[int] = None
    resign_date: Optional[date] = None


class EmployeeCreate(EmployeeFull):
    """Create employee - all fields optional except name and email"""

    pass


class EmployeeUpdate(BaseModel):
    """Update employee - all fields optional"""

    # Personal
    employee_code: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    nik: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    place_of_birth: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None

    # Employment
    position: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    join_date: Optional[date] = None
    resign_date: Optional[date] = None

    # Financial (Finance/GM only)
    daily_salary: Optional[float] = None
    hourly_overtime_rate: Optional[float] = None
    loan_balance: Optional[float] = None
    loan_deduction_per_period: Optional[float] = None
    debt_to_company: Optional[float] = None
    work_days_per_month: Optional[int] = None

    # Bank
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None

    # Emergency
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    # Status
    status: Optional[str] = None
    is_active: Optional[bool] = None
    user_id: Optional[int] = None


class EmployeePublic(BaseModel):
    """Public employee data - tanpa data finansial (untuk Admin/HR)"""

    id: int
    employee_code: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = None
    nik: Optional[str] = None
    address: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    join_date: Optional[date] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class EmployeePrivate(EmployeePublic):
    """Private employee data - dengan data finansial (untuk Finance/GM)"""

    # Financial Data
    daily_salary: Optional[float] = None
    hourly_overtime_rate: Optional[float] = None
    loan_balance: Optional[float] = None
    loan_deduction_per_period: Optional[float] = None
    debt_to_company: Optional[float] = None
    work_days_per_month: Optional[int] = None

    # Bank
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None


class Employee(EmployeePrivate):
    """Full Employee response - backward compatibility"""

    # Personal details
    date_of_birth: Optional[date] = None
    place_of_birth: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    resign_date: Optional[date] = None

    # Emergency
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    # Link
    user_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeListResponse(BaseModel):
    """Response untuk list employees dengan summary finansial"""

    id: int
    employee_code: Optional[str] = None
    name: str
    position: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    # Summary flags (tanpa nominal)
    has_loan: Optional[bool] = False
    has_debt: Optional[bool] = False
    daily_salary: Optional[float] = None  # Hanya untuk Finance/GM
    loan_balance: Optional[float] = None  # Hanya untuk Finance/GM
    loan_deduction_per_period: Optional[float] = None  # Hanya untuk Finance/GM


# ============================================
# Payroll Schemas
# ============================================


class PayrollBase(BaseModel):
    """Base payroll data"""

    employee_id: int
    period_start: date
    period_end: date
    work_days: Optional[int] = 0
    present_days: Optional[int] = 0
    absent_days: Optional[int] = 0
    overtime_hours: Optional[float] = 0
    bonus: Optional[float] = 0
    allowance: Optional[float] = 0
    loan_deduction: Optional[float] = None
    other_deduction: Optional[float] = 0
    deduction_note: Optional[str] = None
    notes: Optional[str] = None


class PayrollCalculate(BaseModel):
    """Request untuk kalkulasi payroll"""

    employee_id: int
    period_start: date
    period_end: date
    overtime_hours: Optional[float] = 0
    bonus: Optional[float] = 0
    allowance: Optional[float] = 0
    loan_deduction: Optional[float] = None


class PayrollCalculationResult(BaseModel):
    """Hasil kalkulasi payroll"""

    employee_id: int
    employee_name: str
    period_start: date
    period_end: date

    # Attendance
    work_days: int
    present_days: int
    absent_days: int

    # Income
    basic_salary: float
    overtime_hours: float = 0.0
    overtime_amount: float
    bonus: float
    allowance: float
    total_income: float

    # Deductions
    loan_deduction: float
    debt_deduction: float
    other_deduction: float
    total_deduction: float

    # Net
    net_salary: float

    # Details
    loan_remaining: float
    debt_remaining: float


class PayrollCreate(PayrollBase):
    """Create payroll record"""

    pass


class PayrollUpdate(BaseModel):
    """Update payroll record"""

    work_days: Optional[int] = None
    present_days: Optional[int] = None
    absent_days: Optional[int] = None
    overtime_hours: Optional[float] = None
    bonus: Optional[float] = None
    allowance: Optional[float] = None
    other_deduction: Optional[float] = None
    deduction_note: Optional[str] = None
    notes: Optional[str] = None
    payment_status: Optional[str] = None
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None


class PayrollResponse(BaseModel):
    """Full payroll response"""

    id: int
    employee_id: int
    employee_name: Optional[str] = None
    period_start: date
    period_end: date

    work_days: int
    present_days: int
    absent_days: int
    overtime_hours: float
    overtime_amount: float

    basic_salary: float
    bonus: float
    allowance: float
    total_income: float

    loan_deduction: float
    debt_deduction: float
    other_deduction: float
    total_deduction: float

    net_salary: float

    payment_status: str
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    payment_reference: Optional[str] = None

    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    approval_note: Optional[str] = None

    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================
# Attendance Schemas
# ============================================


class AttendanceBase(BaseModel):
    """Base attendance data"""

    employee_id: int
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = "present"  # present, absent, late, etc
    notes: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    """Create attendance dengan geotagging"""

    check_in_latitude: Optional[float] = None
    check_in_longitude: Optional[float] = None
    check_out_latitude: Optional[float] = None
    check_out_longitude: Optional[float] = None
    check_in_photo: Optional[str] = None
    check_out_photo: Optional[str] = None


class AttendanceUpdate(BaseModel):
    """Update attendance"""

    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = None
    work_hours: Optional[float] = None
    is_overtime: Optional[bool] = None
    overtime_hours: Optional[float] = None
    notes: Optional[str] = None


class AttendanceResponse(AttendanceBase):
    """Full attendance response"""

    id: int
    work_hours: Optional[float] = None
    is_overtime: Optional[bool] = None
    overtime_hours: Optional[float] = None
    check_in_latitude: Optional[float] = None
    check_in_longitude: Optional[float] = None
    check_out_latitude: Optional[float] = None
    check_out_longitude: Optional[float] = None
    check_in_photo: Optional[str] = None
    check_out_photo: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================
# Bonus/Deduction Schemas
# ============================================


class BonusDeductionBase(BaseModel):
    """Base bonus/deduction data"""

    employee_id: int
    type: str  # bonus, deduction
    category: Optional[str] = None
    amount: float
    effective_date: date
    description: Optional[str] = None
    is_recurring: Optional[bool] = False
    recurring_period: Optional[str] = None


class BonusDeductionCreate(BonusDeductionBase):
    """Create bonus/deduction"""

    remaining_balance: Optional[float] = None


class BonusDeductionUpdate(BaseModel):
    """Update bonus/deduction"""

    type: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    effective_date: Optional[date] = None
    description: Optional[str] = None
    is_recurring: Optional[bool] = None
    remaining_balance: Optional[float] = None


class BonusDeductionResponse(BonusDeductionBase):
    """Full bonus/deduction response"""

    id: int
    remaining_balance: Optional[float] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
