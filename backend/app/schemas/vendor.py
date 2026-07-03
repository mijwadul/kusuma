from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

# -- Vendor Schema --
class VendorBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    vendor_type: Optional[str] = "equipment"
    allow_deposit_cascade: Optional[bool] = False

class VendorCreate(VendorBase):
    balance_deposit: Optional[Decimal] = Decimal("0")

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    vendor_type: Optional[str] = None
    allow_deposit_cascade: Optional[bool] = None

class VendorResponse(VendorBase):
    id: int
    balance_deposit: Decimal
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    allow_deposit_cascade: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)

# -- Top Up Schema --
class VendorTopUpCreate(BaseModel):
    vendor_id: int
    equipment_id: Optional[int] = None  # Wajib untuk equipment, opsional untuk hauling
    truck_id: Optional[int] = None      # Spesifik nopol
    amount: Decimal
    topup_date: Optional[datetime] = None
    notes: Optional[str] = None
    project_id: Optional[int] = None

class VendorTopUpResponse(BaseModel):
    id: int
    vendor_id: int
    equipment_id: Optional[int] = None
    equipment_name: Optional[str] = None  # Nama alat berat (dari join)
    truck_id: Optional[int] = None
    truck_nopol: Optional[str] = None
    amount: Decimal
    topup_date: datetime
    notes: Optional[str] = None
    status: str
    created_by: int
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    project_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

