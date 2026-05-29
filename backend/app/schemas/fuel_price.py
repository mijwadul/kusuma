from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FuelPriceBase(BaseModel):
    price_per_liter: float
    fuel_type: str
    effective_date: datetime
    liters: Optional[float] = None
    total_price: Optional[float] = None
    notes: Optional[str] = None
    vendor_name: Optional[str] = None
    project_id: Optional[int] = None


class FuelPriceCreate(FuelPriceBase):
    pass


class FuelPriceUpdate(BaseModel):
    price_per_liter: Optional[float] = None
    fuel_type: Optional[str] = None
    effective_date: Optional[datetime] = None
    liters: Optional[float] = None
    total_price: Optional[float] = None
    approval_status: Optional[str] = None
    notes: Optional[str] = None
    vendor_name: Optional[str] = None
    project_id: Optional[int] = None


class FuelPrice(FuelPriceBase):
    id: int
    approval_status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    created_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
