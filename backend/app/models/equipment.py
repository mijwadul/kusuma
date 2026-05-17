from sqlalchemy import Column, Integer, String, Float, DateTime, DECIMAL
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
    rental_rate_per_hour = Column(DECIMAL(15, 2), default=0)
    deposit_amount = Column(DECIMAL(15, 2), default=0)
    vendor_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())