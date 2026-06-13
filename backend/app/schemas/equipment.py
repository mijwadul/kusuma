from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class EquipmentBase(BaseModel):
    name: str
    brand: Optional[str] = None
    type: str
    capacity: Optional[float] = None
    location: Optional[str] = None
    status: Optional[str] = "active"
    ownership_status: Optional[str] = "internal"
    rental_rate_per_hour: Optional[Decimal] = Decimal("0")
    pending_rental_rate_per_hour: Optional[Decimal] = None
    locked_balance_for_pending_rate: Optional[Decimal] = None
    pending_rate_effective_date: Optional[date] = None
    vendor_id: Optional[int] = None

class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    type: Optional[str] = None
    capacity: Optional[float] = None
    location: Optional[str] = None
    status: Optional[str] = None
    ownership_status: Optional[str] = None
    rental_rate_per_hour: Optional[Decimal] = None
    pending_rental_rate_per_hour: Optional[Decimal] = None
    locked_balance_for_pending_rate: Optional[Decimal] = None
    pending_rate_effective_date: Optional[date] = None
    vendor_id: Optional[int] = None
    
    # Extra fields for rate change logic
    rate_trigger_type: Optional[str] = None # immediate, deposit, date
    rate_effective_date: Optional[date] = None
    auto_recalculate: Optional[bool] = False # for backdated recalculation


class Equipment(EquipmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
