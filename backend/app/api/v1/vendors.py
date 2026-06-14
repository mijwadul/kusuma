from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...core.auth import get_current_user, require_role, require_admin
from ...models.user import User
from ...schemas.vendor import (
    VendorCreate,
    VendorUpdate,
    VendorResponse,
    VendorTopUpCreate,
    VendorTopUpResponse
)
from ...services.vendor_service import VendorService

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[VendorResponse])
def get_vendors(type: str = None, db: Session = Depends(get_db)):
    return VendorService.get_vendors(db, type)

@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    return VendorService.get_vendor(db, vendor_id)

@router.post("", response_model=VendorResponse)
def create_vendor(data: VendorCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "checker"]))):
    return VendorService.create_vendor(db, current_user, data)

@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(vendor_id: int, data: VendorUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "checker"]))):
    return VendorService.update_vendor(db, current_user, vendor_id, data)

@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    VendorService.delete_vendor(db, current_user, vendor_id)
    return {"message": "Vendor deleted"}

@router.get("/{vendor_id}/equipment-balances")
def get_equipment_balances(vendor_id: int, db: Session = Depends(get_db)):
    return VendorService.get_equipment_balances(db, vendor_id)

@router.get("/equipment-balances/all")
def get_all_equipment_balances(db: Session = Depends(get_db)):
    return VendorService.get_all_equipment_balances(db)

@router.get("/{vendor_id}/topups", response_model=List[VendorTopUpResponse])
def get_vendor_topups(vendor_id: int, db: Session = Depends(get_db)):
    return VendorService.get_vendor_topups(db, vendor_id)

@router.get("/topups/all", response_model=List[VendorTopUpResponse])
def get_all_topups(db: Session = Depends(get_db)):
    return VendorService.get_all_topups(db)

@router.post("/topups", response_model=VendorTopUpResponse)
def create_topup(data: VendorTopUpCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "checker"]))):
    return VendorService.create_topup(db, current_user, data)

@router.put("/topups/{topup_id}/approve", response_model=VendorTopUpResponse)
def approve_topup(topup_id: int, status: str = "approved", db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return VendorService.approve_topup(db, current_user, topup_id, status)

@router.put("/topups/{topup_id}", response_model=VendorTopUpResponse)
def edit_topup(topup_id: int, data: VendorTopUpCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return VendorService.edit_topup(db, current_user, topup_id, data)

@router.delete("/topups/{topup_id}")
def delete_topup(topup_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    VendorService.delete_topup(db, current_user, topup_id)
    return {"message": "Top-Up deposit berhasil dihapus"}
