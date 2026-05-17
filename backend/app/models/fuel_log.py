from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from .base import Base

class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    hour_meter = Column(Float, nullable=True)
    liters_filled = Column(Float, nullable=False)  # Jumlah liter diisi
    location = Column(String(255), nullable=True)
    photo_url = Column(String(500), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(String(500), nullable=True)
    refuel_date = Column(DateTime(timezone=True), nullable=False)  # Tanggal/jam pengisian BBM
    operating_hours = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # Waktu pencatatan di sistem

    # Relasi akan dibuat di query
    # equipment = relationship("Equipment", back_populates="fuel_logs")
