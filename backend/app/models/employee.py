from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)

    # Personal Data
    employee_code = Column(String(50), unique=True, nullable=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    phone = Column(String(50))
    nik = Column(String(50), unique=True, nullable=True)
    address = Column(Text)
    date_of_birth = Column(Date)
    place_of_birth = Column(String(100))
    gender = Column(String(20))
    marital_status = Column(String(30))

    position = Column(String(100))
    department = Column(String(100))
    employment_type = Column(String(30), default="permanent")
    join_date = Column(Date)
    resign_date = Column(Date, nullable=True)

    daily_salary = Column(Float, default=0)
    hourly_overtime_rate = Column(Float, default=0)

    loan_balance = Column(Float, default=0)
    loan_deduction_per_period = Column(Float, default=0)
    debt_to_company = Column(Float, default=0)

    work_days_per_month = Column(Integer, default=25)

    status = Column(String(30), default="active")
    is_active = Column(Boolean, default=True)

    bank_name = Column(String(100))
    bank_account_number = Column(String(50))
    bank_account_name = Column(String(200))

    emergency_contact_name = Column(String(200))
    emergency_contact_phone = Column(String(50))
    emergency_contact_relation = Column(String(50))

    # Linked User Account
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=True
    )  # Link ke tabel users

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    payroll_records = relationship("PayrollRecord", back_populates="employee")
