from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, DECIMAL, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class SuratJalan(Base):
    __tablename__ = "surat_jalan"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    field_staff_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Common fields
    nopol = Column(String(50), nullable=True)
    nama_supir = Column(String(100), nullable=True)
    asal_tambang = Column(String(200), nullable=True)
    
    # Hauling fields
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="SET NULL"), nullable=True)
    truck_id = Column(Integer, ForeignKey("vendor_trucks.id", ondelete="SET NULL"), nullable=True)
    truck_type = Column(String(50), nullable=True)  # 'tronton' or 'colt_diesel'
    hauling_price = Column(DECIMAL(15, 2), nullable=True)
    hauling_cost = Column(DECIMAL(15, 2), nullable=True)
    
    # Tonase
    bruto = Column(Float, nullable=True)
    tarra = Column(Float, nullable=True)
    minus_berat = Column(Float, nullable=True)
    netto = Column(Float, nullable=True)
    
    # Kubikasi (3 variables)
    panjang = Column(Float, nullable=True)
    lebar = Column(Float, nullable=True)
    tinggi = Column(Float, nullable=True)
    minus_tinggi = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Invoicing tracking
    is_invoiced = Column(Boolean, default=False, nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    
    project = relationship("Project", backref="surat_jalans")
    field_staff = relationship("User", backref="surat_jalans_created")
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    truck = relationship("VendorTruck", foreign_keys=[truck_id])
