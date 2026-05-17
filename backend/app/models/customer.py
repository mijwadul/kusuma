from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .base import Base


class Customer(Base):
    """
    Pelanggan tetap (continuous buyer).
    Tidak ada volume target — pembelian berlangsung terus.
    Harga per material dikelola di tabel material_prices.
    """
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    company = Column(String(200), nullable=True)       # Nama perusahaan / instansi
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Material yang biasa dibeli (JSON string simpan di kolom materials_json)
    # Format: [{"material_type":"Limestone (urugan)","unit":"m3"},...]
    materials_json = Column(Text, nullable=True)

    # Relasi ke income records
    # income_records = relationship("IncomeRecord", ...)  # dibuat lewat query


class ProjectMaterialItem(Base):
    """
    Item material per proyek: jenis material, satuan, dan volume target.
    """
    __tablename__ = "project_material_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    material_type = Column(String(100), nullable=False)   # Limestone, Dolomite, dll
    unit = Column(String(20), nullable=False)              # m3 | ton | ritase
    target_quantity = Column(Float, nullable=False)        # Volume yang diminta
    unit_price = Column(Float, nullable=True)             # Harga yang disepakati (bisa override dari price table)
    notes = Column(Text, nullable=True)

    project = relationship("Project", back_populates="material_items")
