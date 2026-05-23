from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from decimal import Decimal

from ...core.database import get_db
from ...core.auth import get_current_user
from ...models import Vendor, VendorTopUp, Expense, User
from ...schemas.vendor import (
    VendorCreate,
    VendorUpdate,
    VendorResponse,
    VendorTopUpCreate,
    VendorTopUpResponse
)

router = APIRouter(dependencies=[Depends(get_current_user)])

# ============================================
# VENDOR CRUD
# ============================================
@router.get("", response_model=List[VendorResponse])
def get_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).order_by(Vendor.name).all()

@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.post("", response_model=VendorResponse)
def create_vendor(data: VendorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["finance", "gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_vendor = Vendor(**data.model_dump())
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor

@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(vendor_id: int, data: VendorUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["finance", "gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vendor, key, value)
        
    db.commit()
    db.refresh(vendor)
    return vendor

@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only GM can delete vendor")
        
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    db.delete(vendor)
    db.commit()
    return {"message": "Vendor deleted"}

# ============================================
# TOP UP DEPOSIT
# ============================================
@router.get("/{vendor_id}/topups", response_model=List[VendorTopUpResponse])
def get_vendor_topups(vendor_id: int, db: Session = Depends(get_db)):
    return db.query(VendorTopUp).filter(VendorTopUp.vendor_id == vendor_id).order_by(VendorTopUp.topup_date.desc()).all()

@router.get("/topups/all", response_model=List[VendorTopUpResponse])
def get_all_topups(db: Session = Depends(get_db)):
    return db.query(VendorTopUp).order_by(VendorTopUp.topup_date.desc()).all()

@router.post("/topups", response_model=VendorTopUpResponse)
def create_topup(data: VendorTopUpCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new topup request. Goes to pending unless user is GM."""
    if current_user.role not in ["finance", "gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    is_gm = current_user.role in ["gm", "admin"] or current_user.is_admin or current_user.is_superuser
    
    topup = VendorTopUp(
        vendor_id=data.vendor_id,
        amount=data.amount,
        notes=data.notes,
        status="approved" if is_gm else "pending",
        created_by=current_user.id,
        approved_by=current_user.id if is_gm else None,
        approved_at=datetime.now() if is_gm else None
    )
    db.add(topup)
    db.commit()
    db.refresh(topup)
    
    if is_gm:
        _apply_topup_and_expense(db, topup, vendor, current_user.id)
        
    return topup

@router.put("/topups/{topup_id}/approve", response_model=VendorTopUpResponse)
def approve_topup(topup_id: int, status: str = "approved", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Approve or reject a topup (GM only)."""
    if current_user.role not in ["gm", "admin"] and not current_user.is_admin and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat melakukan approval")
        
    topup = db.query(VendorTopUp).filter(VendorTopUp.id == topup_id).first()
    if not topup:
        raise HTTPException(status_code=404, detail="TopUp not found")
        
    if topup.status != "pending":
        raise HTTPException(status_code=400, detail="TopUp already processed")
        
    topup.status = status
    topup.approved_by = current_user.id
    topup.approved_at = datetime.now()
    
    vendor = db.query(Vendor).filter(Vendor.id == topup.vendor_id).first()
    
    if status == "approved":
        _apply_topup_and_expense(db, topup, vendor, current_user.id)
    else:
        db.commit()
        db.refresh(topup)
        
    return topup

def _apply_topup_and_expense(db: Session, topup: VendorTopUp, vendor: Vendor, user_id: int):
    # 1. Add balance to vendor
    vendor.balance_deposit = Decimal(str(vendor.balance_deposit or 0)) + Decimal(str(topup.amount))
    
    # 2. Record Expense
    expense = Expense(
        category="deposit",
        description=f"Deposit Alat - {vendor.name}: {topup.notes or ''}",
        amount=float(topup.amount),
        expense_date=datetime.now().date(),
        created_by=user_id,
        approval_status="approved",
        approved_by=user_id,
        approved_at=datetime.now(),
        payment_status="paid",
        paid_by=user_id,
        paid_at=datetime.now()
    )
    db.add(expense)
    db.commit()
    db.refresh(topup)
