from sqlalchemy import Column, Integer, String, DECIMAL, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class Vendor(Base):
    """
    Perusahaan Sewa Alat Berat (Vendor)
    """
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    
    # Saldo deposit tersentralisasi untuk semua alat milik vendor ini
    balance_deposit = Column(DECIMAL(15, 2), default=0)
    
    status = Column(String(30), default="active")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Jika ingin relationship ke equipment
    # equipment_list = relationship("Equipment", back_populates="vendor")

class VendorTopUp(Base):
    """
    Catatan Top-Up Deposit ke Vendor, dikaitkan ke alat berat tertentu
    """
    __tablename__ = "vendor_topups"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    
    # Deposit dikaitkan ke alat berat spesifik
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True)
    
    amount = Column(DECIMAL(15, 2), nullable=False)
    topup_date = Column(DateTime(timezone=True), default=func.now())
    notes = Column(Text, nullable=True)
    
    status = Column(String(30), default="pending") # pending, approved, rejected
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationship ke Equipment untuk mengambil nama alat
    equipment = relationship("Equipment", foreign_keys=[equipment_id])
