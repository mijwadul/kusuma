from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class IncomeRecordBase(BaseModel):
    income_date: date
    income_type: str  # project_payment, material_sale
    description: str
    amount: float
    project_id: Optional[int] = None
    payment_term: Optional[str] = None
    customer_name: Optional[str] = None
    material_type: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    payment_method: Optional[str] = None
    license_plate: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    
    # Surat Jalan fields
    sj_length: Optional[float] = None
    sj_width: Optional[float] = None
    sj_height: Optional[float] = None
    sj_volume_minus: Optional[float] = None
    sj_gross_weight: Optional[float] = None
    sj_tare_weight: Optional[float] = None
    sj_weight_minus: Optional[float] = None
    
    notes: Optional[str] = None


class IncomeRecordCreate(IncomeRecordBase):
    pass


class IncomeRecordUpdate(BaseModel):
    income_date: Optional[date] = None
    income_type: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    project_id: Optional[int] = None
    payment_term: Optional[str] = None
    customer_name: Optional[str] = None
    material_type: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    payment_method: Optional[str] = None
    license_plate: Optional[str] = None
    driver_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    
    # Surat Jalan fields
    sj_length: Optional[float] = None
    sj_width: Optional[float] = None
    sj_height: Optional[float] = None
    sj_volume_minus: Optional[float] = None
    sj_gross_weight: Optional[float] = None
    sj_tare_weight: Optional[float] = None
    sj_weight_minus: Optional[float] = None
    
    notes: Optional[str] = None


class IncomeRecordResponse(IncomeRecordBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    project_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class BulkSuratJalanItem(BaseModel):
    id: int
    unit: str  # m3 or ton
    sj_length: Optional[float] = None
    sj_width: Optional[float] = None
    sj_height: Optional[float] = None
    sj_volume_minus: Optional[float] = None
    sj_gross_weight: Optional[float] = None
    sj_tare_weight: Optional[float] = None
    sj_weight_minus: Optional[float] = None

class TruckUpdateItem(BaseModel):
    license_plate: str
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

class BulkSuratJalanUpdate(BaseModel):
    items: List[BulkSuratJalanItem]
    truck_updates: Optional[List[TruckUpdateItem]] = None
