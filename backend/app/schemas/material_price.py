from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from ..models.material_price import MATERIAL_TYPES, ALL_UNITS


class MaterialPriceBase(BaseModel):
    material_type: str
    customer_name: Optional[str] = None   # None = harga default
    unit: str
    price_per_unit: float
    is_active: bool = True
    notes: Optional[str] = None

    @field_validator("material_type")
    @classmethod
    def validate_material(cls, v: str) -> str:
        if v not in MATERIAL_TYPES:
            raise ValueError(f"material_type harus salah satu dari: {MATERIAL_TYPES}")
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v not in ALL_UNITS:
            raise ValueError(f"unit harus salah satu dari: {ALL_UNITS}")
        return v

    @field_validator("price_per_unit")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Harga tidak boleh negatif")
        return v


class MaterialPriceCreate(MaterialPriceBase):
    pass


class MaterialPriceUpdate(BaseModel):
    material_type: Optional[str] = None
    customer_name: Optional[str] = None
    unit: Optional[str] = None
    price_per_unit: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class MaterialPriceResponse(MaterialPriceBase):
    id: int
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MaterialPriceLookup(BaseModel):
    """Hasil lookup harga: harga yang ditemukan + keterangannya."""
    found: bool
    price_per_unit: Optional[float] = None
    unit: Optional[str] = None
    is_custom: bool = False          # True = harga khusus customer, False = harga default
    material_price_id: Optional[int] = None
