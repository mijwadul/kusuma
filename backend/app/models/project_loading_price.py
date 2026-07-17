from sqlalchemy import Column, Integer, DECIMAL, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class ProjectLoadingPrice(Base):
    """
    Harga Jasa Loading per Vendor per Project
    """
    __tablename__ = "project_loading_prices"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    
    # 'rit_tronton', 'rit_colt_diesel', 'kubikasi', 'tonase'
    unit_type = Column(String(50), nullable=False, default='tonase')
    
    # Harga jasa loading
    price = Column(DECIMAL(15, 2), nullable=False)
    
    # Tanggal mulai berlakunya harga ini
    effective_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", foreign_keys=[project_id])
    vendor = relationship("Vendor", foreign_keys=[vendor_id])
