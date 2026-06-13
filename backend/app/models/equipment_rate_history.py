from sqlalchemy import Column, Integer, String, DECIMAL, DateTime, Date, ForeignKey
from sqlalchemy.sql import func
from .base import Base

class EquipmentRateHistory(Base):
    __tablename__ = "equipment_rate_history"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    old_rate = Column(DECIMAL(15, 2), nullable=True)
    new_rate = Column(DECIMAL(15, 2), nullable=False)
    trigger_type = Column(String(30), nullable=False) # immediate, deposit, date
    effective_date = Column(Date, nullable=True)
    status = Column(String(30), default="pending") # pending, applied, cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    applied_at = Column(DateTime(timezone=True), nullable=True)
