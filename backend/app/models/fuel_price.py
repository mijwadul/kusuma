from sqlalchemy import Column, Integer, Float, DateTime, String, Text, ForeignKey
from sqlalchemy.sql import func
from .base import Base

class FuelPrice(Base):
    __tablename__ = "fuel_prices"

    id = Column(Integer, primary_key=True, index=True)
    price_per_liter = Column(Float, nullable=False)  # Harga per liter
    fuel_type = Column(String(50), nullable=False)  # Jenis BBM (solar, premium, dll)
    effective_date = Column(DateTime(timezone=True), nullable=False)  # Tanggal berlaku
    
    # New fields for Fuel Purchase & Stock
    liters = Column(Float, nullable=True) # Jumlah liter yang dibeli
    total_price = Column(Float, nullable=True) # Total harga pembelian
    approval_status = Column(String(20), nullable=False, default="pending") # "pending", "approved", "rejected"
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    payment_status = Column(String(20), nullable=False, default="unpaid") # "unpaid", "paid"
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    notes = Column(Text, nullable=True)
    vendor_name = Column(String(200), nullable=True)
    
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # Waktu pencatatan
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # User yang mencatat


