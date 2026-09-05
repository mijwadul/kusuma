from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, date

class ProjectHaulingPriceBase(BaseModel):
    project_id: int
    vendor_id: Optional[int] = None
    vehicle_type: Optional[str] = None
    price_per_unit: float
    material_deduction_per_rit: float = 0.0
    effective_date: Optional[date] = None

class ProjectHaulingPriceCreate(ProjectHaulingPriceBase):
    pass

class ProjectHaulingPriceUpdate(BaseModel):
    vendor_id: Optional[int] = None
    vehicle_type: Optional[str] = None
    price_per_unit: Optional[float] = None
    material_deduction_per_rit: Optional[float] = None
    effective_date: Optional[date] = None

class ProjectHaulingPriceResponse(ProjectHaulingPriceBase):
    id: int
    material_deduction_per_rit: float
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

# ── Billing / Rekap Tagihan ──────────────────────────────────────────────────

class HaulingBillingSJ(BaseModel):
    """Satu baris rekap per Surat Jalan dalam tagihan vendor."""
    sj_id: int
    sj_date: date
    nopol: str
    supir: Optional[str]
    measurement: float          # volume (m³) atau netto (ton)
    measurement_unit: str       # 'm3' atau 'ton'
    hauling_price: float        # harga hauling per unit
    hauling_cost: float         # hauling_price × measurement
    material_deduction: float   # material_deduction_per_rit × 1 ritase
    net_cost: float             # hauling_cost - material_deduction

class HaulingBillingResult(BaseModel):
    """Hasil rekap tagihan untuk satu vendor pada suatu periode."""
    vendor_id: int
    vendor_name: str
    project_id: Optional[int]
    project_name: Optional[str]
    period_start: date
    period_end: date
    measurement_type: str       # 'kubikasi' atau 'tonase'
    total_ritase: int
    total_measurement: float
    total_hauling_cost: float
    total_material_deduction: float
    total_net: float
    rows: List[HaulingBillingSJ]
