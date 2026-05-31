from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from ...core.database import get_db
from ...core.auth import get_current_user, require_role, require_admin
from ...models import Vendor, VendorTopUp, Expense, User, Equipment
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
from .work_logs import _calculate_rental_costs

def _sync_vendor_balance(db: Session, vendor: Vendor):
    from ...models import Equipment, WorkLog
    # 1. Total Topup (Approved)
    topups = db.query(VendorTopUp).filter(
        VendorTopUp.vendor_id == vendor.id,
        VendorTopUp.status == "approved"
    ).all()
    total_topup = sum((t.amount for t in topups), Decimal("0"))
    
    # 2. Total Biaya Rental dari WorkLog
    equipments = db.query(Equipment).filter(Equipment.vendor_id == vendor.id).all()
    total_rental_cost = Decimal("0")
    if equipments:
        eq_map = {e.id: e for e in equipments if e.ownership_status == "rental"}
        if eq_map:
            work_logs = db.query(WorkLog).filter(WorkLog.equipment_id.in_(eq_map.keys())).all()
            for wl in work_logs:
                eq = eq_map[wl.equipment_id]
                costs = _calculate_rental_costs(wl, eq)
                total_rental_cost += costs["rental_cost_total"]
                
    vendor.balance_deposit = total_topup - total_rental_cost
    db.commit()


def _get_equipment_balance(db: Session, equipment: Equipment) -> dict:
    """Hitung saldo deposit untuk satu alat berat tertentu."""
    from ...models import WorkLog
    
    # Total topup yang dikaitkan ke alat ini (approved)
    topups = db.query(VendorTopUp).filter(
        VendorTopUp.equipment_id == equipment.id,
        VendorTopUp.status == "approved"
    ).all()
    total_topup = sum((t.amount for t in topups), Decimal("0"))
    
    # Total biaya rental alat ini
    total_rental_cost = Decimal("0")
    if equipment.ownership_status == "rental":
        work_logs = db.query(WorkLog).filter(WorkLog.equipment_id == equipment.id).all()
        for wl in work_logs:
            costs = _calculate_rental_costs(wl, equipment)
            total_rental_cost += costs["rental_cost_total"]
    
    balance = total_topup - total_rental_cost
    return {
        "equipment_id": equipment.id,
        "equipment_name": equipment.name,
        "equipment_type": equipment.type,
        "vendor_id": equipment.vendor_id,
        "total_topup": float(total_topup),
        "total_rental_cost": float(total_rental_cost),
        "balance": float(balance),
    }


def _enrich_topup(topup: VendorTopUp, db: Session) -> dict:
    """Tambahkan equipment_name ke data topup."""
    data = {
        "id": topup.id,
        "vendor_id": topup.vendor_id,
        "equipment_id": topup.equipment_id,
        "equipment_name": None,
        "amount": topup.amount,
        "topup_date": topup.topup_date,
        "notes": topup.notes,
        "status": topup.status,
        "created_by": topup.created_by,
        "approved_by": topup.approved_by,
        "approved_at": topup.approved_at,
    }
    if topup.equipment_id:
        eq = db.query(Equipment).filter(Equipment.id == topup.equipment_id).first()
        if eq:
            data["equipment_name"] = eq.name
    return data


@router.get("", response_model=List[VendorResponse])
def get_vendors(db: Session = Depends(get_db)):
    vendors = db.query(Vendor).order_by(Vendor.name).all()
    for v in vendors:
        _sync_vendor_balance(db, v)
    return vendors

@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    _sync_vendor_balance(db, vendor)
    return vendor

@router.post("", response_model=VendorResponse)
def create_vendor(data: VendorCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "checker"]))):
    db_vendor = Vendor(**data.model_dump())
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor

@router.put("/{vendor_id}", response_model=VendorResponse)
def update_vendor(vendor_id: int, data: VendorUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "checker"]))):
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
def delete_vendor(vendor_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    db.delete(vendor)
    db.commit()
    return {"message": "Vendor deleted"}


# ============================================
# SALDO PER ALAT BERAT
# ============================================

@router.get("/{vendor_id}/equipment-balances")
def get_equipment_balances(vendor_id: int, db: Session = Depends(get_db)):
    """Kembalikan saldo deposit per alat berat untuk vendor tertentu."""
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    equipments = db.query(Equipment).filter(
        Equipment.vendor_id == vendor_id,
        Equipment.ownership_status == "rental"
    ).order_by(Equipment.name).all()
    
    result = []
    for eq in equipments:
        result.append(_get_equipment_balance(db, eq))
    
    return result


@router.get("/equipment-balances/all")
def get_all_equipment_balances(db: Session = Depends(get_db)):
    """Kembalikan saldo deposit semua alat berat dari semua vendor (untuk dashboard)."""
    equipments = db.query(Equipment).filter(
        Equipment.vendor_id != None,
        Equipment.ownership_status == "rental"
    ).order_by(Equipment.name).all()
    
    result = []
    for eq in equipments:
        balance_data = _get_equipment_balance(db, eq)
        # Tambahkan nama vendor
        vendor = db.query(Vendor).filter(Vendor.id == eq.vendor_id).first()
        balance_data["vendor_name"] = vendor.name if vendor else "-"
        result.append(balance_data)
    
    return result


# ============================================
# TOP UP DEPOSIT
# ============================================
@router.get("/{vendor_id}/topups", response_model=List[VendorTopUpResponse])
def get_vendor_topups(vendor_id: int, db: Session = Depends(get_db)):
    topups = db.query(VendorTopUp).filter(VendorTopUp.vendor_id == vendor_id).order_by(VendorTopUp.topup_date.desc()).all()
    return [VendorTopUpResponse(**_enrich_topup(t, db)) for t in topups]

@router.get("/topups/all", response_model=List[VendorTopUpResponse])
def get_all_topups(db: Session = Depends(get_db)):
    topups = db.query(VendorTopUp).order_by(VendorTopUp.topup_date.desc()).all()
    return [VendorTopUpResponse(**_enrich_topup(t, db)) for t in topups]

@router.post("/topups", response_model=VendorTopUpResponse)
def create_topup(data: VendorTopUpCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "checker"]))):
    """Create a new topup request. Equipment wajib dipilih."""
    vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Validasi equipment: wajib ada dan harus milik vendor ini
    equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Alat berat tidak ditemukan")
    if equipment.vendor_id != data.vendor_id:
        raise HTTPException(status_code=400, detail="Alat berat ini bukan milik vendor yang dipilih")
        
    is_gm = current_user.role in ["gm", "admin"] or current_user.is_admin or current_user.is_superuser
    
    topup_dt = data.topup_date if data.topup_date else datetime.now()
    
    topup = VendorTopUp(
        vendor_id=data.vendor_id,
        equipment_id=data.equipment_id,
        amount=data.amount,
        notes=data.notes,
        project_id=data.project_id,
        topup_date=topup_dt,
        status="approved" if is_gm else "pending",
        created_by=current_user.id,
        approved_by=current_user.id if is_gm else None,
        approved_at=datetime.now() if is_gm else None
    )
    db.add(topup)
    db.commit()
    db.refresh(topup)
    
    if is_gm:
        _apply_topup_and_expense(db, topup, vendor, equipment, current_user.id)
        
    return VendorTopUpResponse(**_enrich_topup(topup, db))

@router.put("/topups/{topup_id}/approve", response_model=VendorTopUpResponse)
def approve_topup(topup_id: int, status: str = "approved", db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Approve or reject a topup (GM only)."""
    topup = db.query(VendorTopUp).filter(VendorTopUp.id == topup_id).first()
    if not topup:
        raise HTTPException(status_code=404, detail="TopUp not found")
        
    if topup.status != "pending":
        raise HTTPException(status_code=400, detail="TopUp already processed")
        
    topup.status = status
    topup.approved_by = current_user.id
    topup.approved_at = datetime.now()
    
    vendor = db.query(Vendor).filter(Vendor.id == topup.vendor_id).first()
    equipment = db.query(Equipment).filter(Equipment.id == topup.equipment_id).first() if topup.equipment_id else None
    
    if status == "approved":
        _apply_topup_and_expense(db, topup, vendor, equipment, current_user.id)
    else:
        db.commit()
        db.refresh(topup)
        
    return VendorTopUpResponse(**_enrich_topup(topup, db))

@router.put("/topups/{topup_id}", response_model=VendorTopUpResponse)
def edit_topup(topup_id: int, data: VendorTopUpCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Edit a topup record (GM only)."""
    topup = db.query(VendorTopUp).filter(VendorTopUp.id == topup_id).first()
    if not topup:
        raise HTTPException(status_code=404, detail="TopUp not found")

    # Validasi equipment jika diubah
    if data.equipment_id:
        equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
        if not equipment:
            raise HTTPException(status_code=404, detail="Alat berat tidak ditemukan")
        if equipment.vendor_id != data.vendor_id:
            raise HTTPException(status_code=400, detail="Alat berat ini bukan milik vendor yang dipilih")
        topup.equipment_id = data.equipment_id

    topup.amount = data.amount
    topup.notes = data.notes
    if data.topup_date:
        topup.topup_date = data.topup_date
    db.commit()
    db.refresh(topup)
    return VendorTopUpResponse(**_enrich_topup(topup, db))

@router.delete("/topups/{topup_id}")
def delete_topup(topup_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Delete a topup record (GM only). Balance is recalculated dynamically."""
    topup = db.query(VendorTopUp).filter(VendorTopUp.id == topup_id).first()
    if not topup:
        raise HTTPException(status_code=404, detail="TopUp not found")

    db.delete(topup)
    db.commit()
    return {"message": "Top-Up deposit berhasil dihapus"}

def _apply_topup_and_expense(db: Session, topup: VendorTopUp, vendor: Vendor, equipment: Optional[Equipment], user_id: int):
    # Record Expense
    expense_dt = topup.topup_date.date() if topup.topup_date else datetime.now().date()
    
    eq_label = f" - {equipment.name}" if equipment else ""
    expense = Expense(
        category="deposit",
        description=f"Deposit Alat - {vendor.name}{eq_label}: {topup.notes or ''}",
        amount=float(topup.amount),
        expense_date=expense_dt,
        created_by=user_id,
        approval_status="approved",
        approved_by=user_id,
        approved_at=datetime.now(),
        payment_status="paid",
        paid_by=user_id,
        paid_at=datetime.now(),
        project_id=topup.project_id
    )
    db.add(expense)
    db.commit()
    db.refresh(topup)
