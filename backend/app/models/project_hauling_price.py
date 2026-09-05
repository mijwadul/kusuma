from sqlalchemy import Column, Integer, DECIMAL, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class ProjectHaulingPrice(Base):
    """
    Harga Hauling per Vendor per Project.

    price_per_unit             : harga per m³ (kubikasi) atau per ton (tonase),
                                 sesuai measurement_type project.
    material_deduction_per_rit : potongan harga material per ritase (per surat jalan).
                                 Digunakan saat rekap tagihan vendor:
                                 Net = (price_per_unit × volume/netto) − (material_deduction_per_rit × ritase)
    """
    __tablename__ = "project_hauling_prices"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    
    # Tipe kendaraan (opsional, khususnya untuk ritase: 'tronton', 'colt_diesel', atau NULL untuk semua)
    vehicle_type = Column(String(50), nullable=True)

    # Harga dihitung berdasarkan measurement_type di tabel Project (Tonase atau Kubikasi)
    price_per_unit = Column(DECIMAL(15, 2), nullable=False)
    
    # Potongan harga material per ritase (opsional, default 0)
    material_deduction_per_rit = Column(DECIMAL(15, 2), nullable=False, default=0)
    
    # Tanggal mulai berlakunya harga ini
    effective_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", foreign_keys=[project_id])
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
