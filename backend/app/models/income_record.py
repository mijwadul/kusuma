from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from .base import Base


class IncomeRecord(Base):
    __tablename__ = "income_records"

    id = Column(Integer, primary_key=True, index=True)
    income_date = Column(Date, nullable=False)
    income_type = Column(String(30), nullable=False)  # project_payment, material_sale
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    payment_term = Column(
        String(50), nullable=True
    )  # dp, termin_1, termin_2, pelunasan
    customer_name = Column(String(200), nullable=True)
    material_type = Column(String(100), nullable=True)
    quantity = Column(Float, nullable=True)
    unit = Column(String(20), nullable=True)  # m3, ton
    unit_price = Column(Float, nullable=True)
    payment_method = Column(String(20), nullable=True)  # cash, transfer
    license_plate = Column(String(50), nullable=True)
    driver_name = Column(String(100), nullable=True)
    vehicle_type = Column(String(50), nullable=True)  # Colt Diesel, Tronton
    
    # Manajemen Surat Jalan
    sj_length = Column(Float, nullable=True)         # Panjang
    sj_width = Column(Float, nullable=True)          # Lebar
    sj_height = Column(Float, nullable=True)         # Tinggi
    sj_volume_minus = Column(Float, nullable=True)   # Minus volume (dikurangi dari tinggi)
    sj_gross_weight = Column(Float, nullable=True)   # Berat 1 (Bruto)
    sj_tare_weight = Column(Float, nullable=True)    # Berat 2 (Tara)
    sj_weight_minus = Column(Float, nullable=True)   # Minus berat
    
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
