from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from ...core.database import get_db
from ...core.auth import get_current_user, require_role, require_admin
from ...models.user import User
from ...schemas.vendor_truck import VendorTruckCreate, VendorTruckUpdate, VendorTruckResponse
from ...schemas.project_hauling_price import (
    ProjectHaulingPriceCreate, ProjectHaulingPriceUpdate, ProjectHaulingPriceResponse,
    HaulingObligationResponse, HaulingDetailProject, HaulingBillingResult
)
from ...services.hauling_service import HaulingService

router = APIRouter(dependencies=[Depends(get_current_user)])

# Dashboard
@router.get("/dashboard/stats")
def get_hauling_dashboard_stats(db: Session = Depends(get_db)):
    return HaulingService.get_dashboard_stats(db)

# Vendor Trucks
@router.get("/vendors/{vendor_id}/trucks", response_model=List[VendorTruckResponse])
def get_vendor_trucks(vendor_id: int, db: Session = Depends(get_db)):
    return HaulingService.get_vendor_trucks(db, vendor_id)

@router.post("/vendors/{vendor_id}/trucks", response_model=VendorTruckResponse)
def create_vendor_truck(vendor_id: int, data: VendorTruckCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "admin"]))):
    # Ensure vendor_id matches
    data.vendor_id = vendor_id
    return HaulingService.create_vendor_truck(db, data)

@router.put("/trucks/{truck_id}", response_model=VendorTruckResponse)
def update_vendor_truck(truck_id: int, data: VendorTruckUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "admin"]))):
    return HaulingService.update_vendor_truck(db, truck_id, data)

@router.delete("/trucks/{truck_id}")
def delete_vendor_truck(truck_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    HaulingService.delete_vendor_truck(db, truck_id)
    return {"message": "Truk berhasil dihapus"}

# Project Hauling Prices
@router.get("/projects/{project_id}/hauling-prices", response_model=List[ProjectHaulingPriceResponse])
def get_project_prices(project_id: int, db: Session = Depends(get_db)):
    return HaulingService.get_project_prices(db, project_id)

@router.post("/projects/{project_id}/hauling-prices", response_model=ProjectHaulingPriceResponse)
def set_project_price(project_id: int, data: ProjectHaulingPriceCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    data.project_id = project_id
    return HaulingService.set_project_price(db, data)

@router.put("/projects/{project_id}/hauling-prices/{price_id}", response_model=ProjectHaulingPriceResponse)
def update_project_price(project_id: int, price_id: int, data: ProjectHaulingPriceUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return HaulingService.update_project_price(db, price_id, data)

@router.delete("/projects/{project_id}/hauling-prices/{price_id}")
def delete_project_price(project_id: int, price_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return HaulingService.delete_project_price(db, price_id)

@router.get("/projects/{project_id}/hauling-obligations", response_model=List[HaulingObligationResponse])
def get_project_hauling_obligations(project_id: int, db: Session = Depends(get_db)):
    return HaulingService.get_project_hauling_obligations(db, project_id)

@router.get("/obligations", response_model=List[HaulingObligationResponse])
def get_all_hauling_obligations(db: Session = Depends(get_db)):
    return HaulingService.get_all_hauling_obligations(db)

@router.get("/vendors/{vendor_id}/hauling-obligations/details", response_model=List[HaulingDetailProject])
def get_vendor_hauling_details(vendor_id: int, db: Session = Depends(get_db)):
    return HaulingService.get_vendor_hauling_details(db, vendor_id)

from ...schemas.hauling_bill import (
    HaulingBillingPreviewResult,
    HaulingBillCreate,
    HaulingBillResponse,
    HaulingBillDetailResponse,
)

# ── Rekap Tagihan / Billing ────────────────────────────────────────────────────
@router.get("/vendors/{vendor_id}/billing", response_model=HaulingBillingPreviewResult)
def get_vendor_hauling_billing(
    vendor_id: int,
    start_date: str           = Query(..., description="Tanggal awal YYYY-MM-DD"),
    end_date: str             = Query(..., description="Tanggal akhir YYYY-MM-DD"),
    project_id: Optional[int] = Query(None, description="Filter project (opsional)"),
    nopol: Optional[str]      = Query(None, description="Filter nopol truk (opsional)"),
    only_unbilled: bool       = Query(False, description="Hanya tampilkan yang belum ditagih"),
    db: Session = Depends(get_db),
):
    return HaulingService.get_hauling_billing(
        db,
        vendor_id=vendor_id,
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date),
        project_id=project_id,
        nopol=nopol,
        only_unbilled=only_unbilled,
    )

# ── Riwayat & Simpan Laporan Tagihan Hauling (Saved Bills) ─────────────────────
@router.post("/bills", response_model=HaulingBillResponse)
def create_hauling_bill(
    data: HaulingBillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "admin"])),
):
    return HaulingService.create_hauling_bill(db, data, user_id=current_user.id)

@router.get("/bills", response_model=List[HaulingBillResponse])
def list_hauling_bills(
    vendor_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return HaulingService.list_hauling_bills(db, vendor_id=vendor_id, project_id=project_id, status=status)

@router.get("/bills/{bill_id}", response_model=HaulingBillDetailResponse)
def get_hauling_bill_detail(
    bill_id: int,
    db: Session = Depends(get_db),
):
    return HaulingService.get_hauling_bill_detail(db, bill_id=bill_id)

@router.delete("/bills/{bill_id}")
def delete_hauling_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return HaulingService.delete_hauling_bill(db, bill_id=bill_id)

