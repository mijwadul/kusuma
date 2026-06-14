from typing import Optional
from pydantic import BaseModel

class SuratJalanCreate(BaseModel):
    project_id: int
    nopol: Optional[str] = None
    nama_supir: Optional[str] = None
    asal_tambang: Optional[str] = None
    
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    truck_id: Optional[int] = None
    truck_type: Optional[str] = None
    
    # Tonase
    bruto: Optional[float] = None
    tarra: Optional[float] = None
    minus_berat: Optional[float] = 0.0
    
    # Kubikasi
    panjang: Optional[float] = None
    lebar: Optional[float] = None
    tinggi: Optional[float] = None
    minus_tinggi: Optional[float] = 0.0

    created_at: Optional[str] = None

class SuratJalanUpdate(BaseModel):
    nopol: Optional[str] = None
    nama_supir: Optional[str] = None
    asal_tambang: Optional[str] = None
    
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    truck_id: Optional[int] = None
    truck_type: Optional[str] = None
    
    # Tonase
    bruto: Optional[float] = None
    tarra: Optional[float] = None
    minus_berat: Optional[float] = None
    
    # Kubikasi
    panjang: Optional[float] = None
    lebar: Optional[float] = None
    tinggi: Optional[float] = None
    minus_tinggi: Optional[float] = None

    created_at: Optional[str] = None

class SuratJalanResponse(BaseModel):
    id: int
    project_id: int
    field_staff_id: Optional[int] = None
    vendor_id: Optional[int] = None
    truck_id: Optional[int] = None
    nopol: Optional[str]
    nama_supir: Optional[str]
    asal_tambang: Optional[str]
    hauling_price: Optional[float] = None
    hauling_cost: Optional[float] = None
    bruto: Optional[float]
    tarra: Optional[float]
    minus_berat: Optional[float]
    netto: Optional[float]
    panjang: Optional[float]
    lebar: Optional[float]
    tinggi: Optional[float]
    minus_tinggi: Optional[float]
    volume: Optional[float]
    created_at: Optional[str]
    
    vendor_name: Optional[str] = None
    truck_type: Optional[str] = None

    class Config:
        from_attributes = True
