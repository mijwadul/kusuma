from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class HaulingBill(Base):
    """
    Model untuk menyimpan rekapitulasi laporan pembayaran/tagihan vendor hauling.
    Mencegah double billing dan memungkinkan download ulang laporan tersimpan.
    """
    __tablename__ = "hauling_bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(50), unique=True, index=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    nopol = Column(String(50), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    bill_date = Column(Date, nullable=False)
    
    total_ritase = Column(Integer, default=0, nullable=False)
    total_measurement = Column(Float, default=0.0, nullable=False)
    total_hauling_cost = Column(Float, default=0.0, nullable=False)
    total_material_deduction = Column(Float, default=0.0, nullable=False)
    total_net = Column(Float, default=0.0, nullable=False)
    
    measurement_type = Column(String(30), default="tonase", nullable=False)
    status = Column(String(20), default="unpaid", nullable=False) # unpaid, paid, cancelled
    notes = Column(Text, nullable=True)
    is_downloaded = Column(Boolean, default=False, nullable=False)
    
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
    project = relationship("Project", foreign_keys=[project_id])
    creator = relationship("User", foreign_keys=[created_by])
    surat_jalans = relationship("SuratJalan", back_populates="hauling_bill")
