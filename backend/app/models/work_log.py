from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, DECIMAL
from sqlalchemy.sql import func
from .base import Base

class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)  # Opsional
    
    # Input method: 'HM' atau 'MANUAL'
    input_method = Column(String(10), nullable=False, default="HM")
    
    # HM data (NULL jika manual)
    hm_start = Column(DECIMAL(10, 2), nullable=True)  # HM awal
    hm_end = Column(DECIMAL(10, 2), nullable=True)    # HM akhir
    
    # Total hours (hasil hitungan otomatis atau input manual)
    total_hours = Column(DECIMAL(10, 2), nullable=False)

    # Rental cost discount as deducted hours for financing calculation
    rental_discount_hours = Column(DECIMAL(10, 2), nullable=False, default=0)
    
    # Operator info
    operator_name = Column(String(100), nullable=True)
    
    # Work description
    work_description = Column(String(500), nullable=True)
    
    # Biaya sewa yang dibekukan pada saat input
    applied_rate = Column(DECIMAL(15, 2), nullable=True)
    total_cost = Column(DECIMAL(15, 2), nullable=True)
    split_details = Column(String(1000), nullable=True)  # Menyimpan detail jika terjadi transisi harga

    # Date tracking
    work_date = Column(DateTime(timezone=True), nullable=False)  # Tanggal kerja
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Audit fields
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # User yang mencatat
    
    # Relasi akan dibuat di query
    # equipment = relationship("Equipment", back_populates="work_logs")
    # project = relationship("Project", back_populates="work_logs")
