from typing import List, Optional
from pydantic import BaseModel

class CustomerMaterialPreference(BaseModel):
    material_type: str
    unit: str
    unit_price: Optional[float] = None
    vehicle_type: str = "Tronton"

class CustomerTruck(BaseModel):
    license_plate: str
    driver_name: Optional[str] = None
    vehicle_type: str = "Tronton"
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

class AddTruckRequest(BaseModel):
    license_plate: str
    driver_name: Optional[str] = None
    vehicle_type: str = "Colt Diesel"
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

class CustomerCreate(BaseModel):
    name: str
    company: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    material_preferences: List[CustomerMaterialPreference] = []
    trucks: List[CustomerTruck] = []

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    material_preferences: Optional[List[CustomerMaterialPreference]] = None
    trucks: Optional[List[CustomerTruck]] = None

class CustomerResponse(BaseModel):
    id: int
    name: str
    company: Optional[str]
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    is_active: bool
    material_preferences: List[CustomerMaterialPreference] = []
    trucks: List[CustomerTruck] = []
    total_purchases: float = 0.0
    purchase_count: int = 0

    class Config:
        from_attributes = True
