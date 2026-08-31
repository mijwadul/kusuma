from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, date

class HaulingBillingSJ(BaseModel):
    """Satu baris rincian per Surat Jalan dalam rekapitulasi hauling."""
    sj_id: int
    sj_date: date
    nopol: str
    supir: Optional[str]
    measurement: float          # volume (m³) atau netto (ton) tanpa pembulatan
    measurement_unit: str       # 'm3' atau 'ton'
    hauling_price: float        # harga hauling per unit
    hauling_cost: float         # hauling_price × measurement
    material_deduction: float   # material_deduction_per_rit × 1 ritase
    net_cost: float             # hauling_cost - material_deduction
    hauling_is_billed: bool = False
    hauling_bill_id: Optional[int] = None

class HaulingBillingGroupDate(BaseModel):
    """Subtotal dan ringkasan per Tanggal Operasional."""
    date: date
    ritase: int
    measurement: float
    measurement_unit: str
    hauling_cost: float
    material_deduction: float
    net_cost: float
    rates: List[float]
    rows: List[HaulingBillingSJ]

class HaulingBillingPreviewResult(BaseModel):
    """Hasil preview rekap tagihan (sebelum disimpan / kalkulasi live)."""
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
    unbilled_count: int
    billed_count: int
    grouped_dates: List[HaulingBillingGroupDate]
    rows: List[HaulingBillingSJ]

class HaulingBillCreate(BaseModel):
    vendor_id: int
    project_id: Optional[int] = None
    nopol: Optional[str] = None
    start_date: date
    end_date: date
    bill_date: Optional[date] = None
    bill_number: Optional[str] = None # Jika kosong, di-generate otomatis
    notes: Optional[str] = None
    sj_ids: Optional[List[int]] = None # List ID SJ yang di-cover

class HaulingBillResponse(BaseModel):
    id: int
    bill_number: str
    vendor_id: int
    vendor_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    nopol: Optional[str] = None
    start_date: date
    end_date: date
    bill_date: date
    total_ritase: int
    total_measurement: float
    total_hauling_cost: float
    total_material_deduction: float
    total_net: float
    measurement_type: str
    status: str
    notes: Optional[str] = None
    is_downloaded: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class HaulingBillDetailResponse(HaulingBillResponse):
    grouped_dates: List[HaulingBillingGroupDate] = []
    rows: List[HaulingBillingSJ] = []
