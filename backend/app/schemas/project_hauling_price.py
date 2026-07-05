from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, date

class ProjectHaulingPriceBase(BaseModel):
    project_id: int
    vendor_id: Optional[int] = None
    price_per_unit: float
    effective_date: Optional[date] = None

class ProjectHaulingPriceCreate(ProjectHaulingPriceBase):
    pass

class ProjectHaulingPriceUpdate(BaseModel):
    vendor_id: Optional[int] = None
    price_per_unit: Optional[float] = None
    effective_date: Optional[date] = None

class ProjectHaulingPriceResponse(ProjectHaulingPriceBase):
    id: int
    effective_date: date
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class HaulingObligationResponse(BaseModel):
    vendor_id: int
    vendor_name: str
    total_ritase: int
    total_measurement: float # total tonase or kubikasi
    total_obligation: float
    balance_deposit: float

class HaulingDetailDate(BaseModel):
    date: date
    ritase: int
    measurement: float
    obligation: float

class HaulingDetailNopol(BaseModel):
    nopol: str
    total_ritase: int
    total_measurement: float
    total_obligation: float
    dates: List[HaulingDetailDate]

class HaulingDetailProject(BaseModel):
    project_id: int
    project_name: str
    total_ritase: int
    total_measurement: float
    total_obligation: float
    nopols: List[HaulingDetailNopol]
