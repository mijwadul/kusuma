from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, DECIMAL
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class VendorTruck(Base):
    """
    Truk milik Vendor Armada / Logistik
    """
    __tablename__ = "vendor_trucks"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    
    nopol = Column(String(50), nullable=False, unique=True, index=True)
    supir_default = Column(String(100), nullable=True)
    
    # tronton atau colt_diesel
    tipe_truk = Column(String(50), nullable=False, default="tronton")
    
    # Ukuran bak
    panjang = Column(Float, nullable=True)
    lebar = Column(Float, nullable=True)
    tinggi = Column(Float, nullable=True)
    
    status = Column(String(30), default="active")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
