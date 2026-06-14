from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class VendorTruckBase(BaseModel):
    nopol: str
    supir_default: Optional[str] = None
    tipe_truk: str = "tronton"
    panjang: Optional[float] = None
    lebar: Optional[float] = None
    tinggi: Optional[float] = None
    status: Optional[str] = "active"

class VendorTruckCreate(VendorTruckBase):
    vendor_id: int

class VendorTruckUpdate(BaseModel):
    nopol: Optional[str] = None
    supir_default: Optional[str] = None
    tipe_truk: Optional[str] = None
    panjang: Optional[float] = None
    lebar: Optional[float] = None
    tinggi: Optional[float] = None
    status: Optional[str] = None

class VendorTruckResponse(VendorTruckBase):
    id: int
    vendor_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
