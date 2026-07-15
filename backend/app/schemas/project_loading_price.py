from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, date

class ProjectLoadingPriceBase(BaseModel):
    project_id: int
    vendor_id: Optional[int] = None
    price_per_unit: float
    effective_date: Optional[date] = None

class ProjectLoadingPriceCreate(ProjectLoadingPriceBase):
    pass

class ProjectLoadingPriceUpdate(BaseModel):
    vendor_id: Optional[int] = None
    price_per_unit: Optional[float] = None
    effective_date: Optional[date] = None

class ProjectLoadingPriceResponse(ProjectLoadingPriceBase):
    id: int
    effective_date: date
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class LoadingObligationResponse(BaseModel):
    vendor_id: int
    vendor_name: str
    total_ritase: int
    total_obligation: float
    balance_deposit: float
