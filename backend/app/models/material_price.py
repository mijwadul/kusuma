from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base

# Jenis material yang didukung
MATERIAL_TYPES = ["Limestone (urugan)", "Dolomite", "Boulder", "Clay"]

# Satuan yang valid per material — semua material mendukung 3 satuan:
#   m3 (kubikasi), ton (tonase), ritase
MATERIAL_UNITS = {
    "Limestone (urugan)": ["m3", "ton", "ritase"],
    "Dolomite": ["m3", "ton", "ritase"],
    "Boulder": ["m3", "ton", "ritase"],
    "Clay": ["m3", "ton", "ritase"],
}

ALL_UNITS = ["m3", "ton", "ritase"]


class MaterialPrice(Base):
    """
    Harga material per kombinasi (material_type, customer_name, unit).

    Aturan lookup (diurutkan dari paling spesifik):
      1. customer_name IS NOT NULL  →  harga khusus customer
      2. customer_name IS NULL      →  harga default
    """
    __tablename__ = "material_prices"

    id = Column(Integer, primary_key=True, index=True)

    material_type = Column(String(100), nullable=False)   # Limestone, Dolomite, Boulder, Clay
    customer_name = Column(String(200), nullable=True)    # NULL = harga default semua customer
    vehicle_type = Column(String(50), nullable=True)      # NULL = berlaku semua kendaraan, atau "Tronton" / "Colt Diesel"
    unit = Column(String(20), nullable=False)             # m3 | ton | ritase
    price_per_unit = Column(Float, nullable=False)

    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
