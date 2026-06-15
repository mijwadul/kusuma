from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(200), nullable=False)
    invoice_date = Column(Date, nullable=False)
    start_date = Column(Date, nullable=False)  # Periode awal penjualan material
    end_date = Column(Date, nullable=False)    # Periode akhir penjualan material
    total_amount = Column(Float, nullable=False)
    status = Column(String(20), default="unpaid") # unpaid, paid, cancelled
    notes = Column(Text, nullable=True)
    is_downloaded = Column(Boolean, default=False, server_default="0", nullable=False)
    
    discount_type = Column(String(20), nullable=True) # 'percentage' or 'nominal'
    discount_value = Column(Float, nullable=True)
    discount_amount = Column(Float, nullable=True)
    final_amount = Column(Float, nullable=True) # total_amount - discount_amount
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
