from sqlalchemy import Column, Integer, String, Float, DateTime, Date, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class PayrollRecord(Base):
    """
    Payroll Record - Catatan gaji per karyawan per periode
    """
    __tablename__ = "payroll_records"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    employee = relationship("Employee", back_populates="payroll_records")
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    
    # Period
    period_start = Column(Date, nullable=False)  # Tanggal mulai periode
    period_end = Column(Date, nullable=False)    # Tanggal akhir periode
    
    # Attendance Data
    work_days = Column(Integer, default=0)           # Hari kerja
    present_days = Column(Integer, default=0)        # Hari hadir
    absent_days = Column(Integer, default=0)         # Hari tidak hadir
    
    # Overtime Data
    overtime_hours = Column(Float, default=0)        # Total jam lembur
    overtime_amount = Column(Float, default=0)     # Total bayaran lembur
    
    # Income
    basic_salary = Column(Float, default=0)          # Gaji pokok (daily_salary * present_days)
    bonus = Column(Float, default=0)                 # Bonus tambahan
    allowance = Column(Float, default=0)             # Tunjangan (transport, makan, dll)
    
    # Deductions
    loan_deduction = Column(Float, default=0)          # Potongan pinjaman
    debt_deduction = Column(Float, default=0)          # Potongan hutang ke perusahaan
    other_deduction = Column(Float, default=0)     # Potongan lainnya
    deduction_note = Column(Text)                    # Keterangan potongan
    
    # Totals
    total_income = Column(Float, default=0)            # Total pendapatan
    total_deduction = Column(Float, default=0)       # Total potongan
    net_salary = Column(Float, default=0)            # Gaji bersih (take home)
    
    # Payment Status
    payment_status = Column(String(30), default="pending")  # pending, approved, paid, cancelled
    payment_date = Column(Date, nullable=True)
    payment_method = Column(String(30))                      # transfer, cash
    payment_reference = Column(String(100))                   # Nomor referensi pembayaran
    
    # Approval (GM approval untuk payroll)
    approved_by = Column(Integer, nullable=True)       # User ID yang approve
    approved_at = Column(DateTime, nullable=True)      # Waktu approval
    approval_note = Column(Text)
    
    # Notes
    notes = Column(Text)
    is_downloaded = Column(Boolean, default=False, server_default="0", nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer)  # User ID yang membuat record

class Attendance(Base):
    """
    Daily Attendance - Catatan kehadiran harian
    """
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    date = Column(Date, nullable=False)
    
    # Check In/Out
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    
    # Status
    status = Column(String(30), default="present")  # present, absent, late, early_leave, sick, leave
    
    # Location (for geotagging)
    check_in_latitude = Column(Float)
    check_in_longitude = Column(Float)
    check_out_latitude = Column(Float)
    check_out_longitude = Column(Float)
    
    # Work Hours
    work_hours = Column(Float, default=0)  # Total jam kerja
    
    # Overtime
    is_overtime = Column(Boolean, default=False)
    overtime_hours = Column(Float, default=0)
    
    # Notes
    notes = Column(Text)
    
    # Photo evidence
    check_in_photo = Column(String(500))  # URL/path to photo
    check_out_photo = Column(String(500))
    
    # Payroll tracking
    is_payroll_generated = Column(Boolean, default=False, nullable=True)
    payroll_id = Column(Integer, ForeignKey("payroll_records.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class BonusDeduction(Base):
    """
    Bonus and Deduction Records - Catatan bonus dan potongan tambahan
    """
    __tablename__ = "bonus_deductions"

    id = Column(Integer, primary_key=True, index=True)
    
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    
    # Type
    type = Column(String(30), nullable=False)  # bonus, deduction
    category = Column(String(50))  # performance, attendance, loan, accident, other
    
    # Amount
    amount = Column(Float, nullable=False)
    
    # Period
    effective_date = Column(Date, nullable=False)
    
    # Description
    description = Column(Text)
    
    # Status
    is_recurring = Column(Boolean, default=False)  # Apakah berulang setiap periode
    recurring_period = Column(String(30))  # daily, weekly, monthly
    
    # For loan tracking
    remaining_balance = Column(Float, nullable=True)  # Sisa saldo (untuk pinjaman)
    
    # Approval
    approved_by = Column(Integer)
    approved_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer)
