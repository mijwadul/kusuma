from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class ProjectHaulingPriceBase(BaseModel):
    project_id: int
    vendor_id: int
    price_per_unit: float

class ProjectHaulingPriceCreate(ProjectHaulingPriceBase):
    pass

class ProjectHaulingPriceUpdate(BaseModel):
    price_per_unit: Optional[float] = None

class ProjectHaulingPriceResponse(ProjectHaulingPriceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
