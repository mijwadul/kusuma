from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

class EquipmentRateHistoryBase(BaseModel):
    equipment_id: int
    old_rate: Optional[Decimal] = None
    new_rate: Decimal
    trigger_type: str
    effective_date: Optional[date] = None
    status: str = "pending"

class EquipmentRateHistoryCreate(EquipmentRateHistoryBase):
    pass

class EquipmentRateHistoryUpdate(BaseModel):
    new_rate: Optional[Decimal] = None
    effective_date: Optional[date] = None
    trigger_type: Optional[str] = None

class EquipmentRateHistory(EquipmentRateHistoryBase):
    id: int
    created_at: datetime
    applied_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
