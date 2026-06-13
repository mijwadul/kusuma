from sqlalchemy import Column, Integer, String, Float, DateTime, DECIMAL, Date
from sqlalchemy.sql import func
from .base import Base

class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    brand = Column(String(200), nullable=True)
    type = Column(String(100), nullable=False)
    capacity = Column(Float, nullable=True)
    location = Column(String(255))
    status = Column(String(30), default="active")
    ownership_status = Column(String(30), default="internal")
    
    # Harga aktif saat ini
    rental_rate_per_hour = Column(DECIMAL(15, 2), default=0)
    
    # Harga antrian (pending) jika ada perubahan saat saldo > 0
    pending_rental_rate_per_hour = Column(DECIMAL(15, 2), nullable=True)
    # Saldo deposit lama yang harus dihabiskan dengan harga lama
    locked_balance_for_pending_rate = Column(DECIMAL(15, 2), nullable=True)
    
    # Tanggal efektif untuk harga antrian (opsional)
    pending_rate_effective_date = Column(Date, nullable=True)
    
    deposit_amount = Column(DECIMAL(15, 2), default=0)
    vendor_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())