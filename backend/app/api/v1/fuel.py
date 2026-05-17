from datetime import date, datetime, timedelta
from typing import List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from ...core.auth import get_current_user
from ...core.database import get_db
from ...models import FuelLog, Equipment, User, WorkLog, FuelPrice
from ...schemas import (
    FuelLogCreate,
    FuelLogUpdate,
    FuelLog as FuelLogSchema,
    FuelLogWithEquipment,
    FuelEfficiencyStats,
    FuelEquipmentReportItem,
    FuelPriceCreate,
    FuelPriceUpdate,
    FuelPrice as FuelPriceSchema,
)

router = APIRouter()


def _period_start(days: int) -> datetime:
    return datetime.now() - timedelta(days=days)


@router.post("/refuel", response_model=FuelLogSchema)
def create_fuel_log(
    fuel_data: FuelLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Catat pengisian BBM baru"""
    equipment = db.query(Equipment).filter(Equipment.id == fuel_data.equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # Hitung stok BBM
    total_approved_stock = db.query(func.coalesce(func.sum(FuelPrice.liters), 0)).filter(
        FuelPrice.approval_status == 'approved'
    ).scalar()
    total_consumed = db.query(func.coalesce(func.sum(FuelLog.liters_filled), 0)).scalar()
    current_stock = float(total_approved_stock or 0) - float(total_consumed or 0)
    
    if current_stock < fuel_data.liters_filled:
        raise HTTPException(status_code=400, detail=f"Stok BBM tidak mencukupi. Sisa stok: {current_stock} Liter")

    fuel_log = FuelLog(
        equipment_id=fuel_data.equipment_id,
        hour_meter=fuel_data.hour_meter,
        liters_filled=fuel_data.liters_filled,
        refuel_date=fuel_data.refuel_date,
        location=fuel_data.location or equipment.location,
        photo_url=fuel_data.photo_url,
        notes=fuel_data.notes,
        operating_hours=fuel_data.operating_hours,
        recorded_by=current_user.id if current_user else None
    )

    db.add(fuel_log)
    db.commit()
    db.refresh(fuel_log)
    return fuel_log


@router.get("/logs", response_model=List[FuelLogWithEquipment])
def get_fuel_logs(
    equipment_id: Optional[int] = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ambil history pengisian BBM (sesuai tanggal pengisian, bukan waktu simpan ke server)"""
    query = db.query(
        FuelLog,
        Equipment.name.label('equipment_name'),
        Equipment.type.label('equipment_type')
    ).join(Equipment, FuelLog.equipment_id == Equipment.id)

    if equipment_id:
        query = query.filter(FuelLog.equipment_id == equipment_id)

    since = _period_start(days)
    query = query.filter(FuelLog.refuel_date >= since)

    results = query.order_by(FuelLog.refuel_date.desc()).all()

    logs = []
    for row in results:
        log_dict = {
            'id': row.FuelLog.id,
            'equipment_id': row.FuelLog.equipment_id,
            'liters_filled': row.FuelLog.liters_filled,
            'refuel_date': row.FuelLog.refuel_date,
            'location': row.FuelLog.location,
            'photo_url': row.FuelLog.photo_url,
            'notes': row.FuelLog.notes,
            'recorded_by': row.FuelLog.recorded_by,
            'created_at': row.FuelLog.created_at,
            'equipment_name': row.equipment_name,
            'equipment_type': row.equipment_type
        }
        logs.append(log_dict)

    return logs


@router.get("/logs/{log_id}", response_model=FuelLogWithEquipment)
def get_fuel_log_by_id(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ambil detail pengisian BBM by ID"""
    result = db.query(
        FuelLog,
        Equipment.name.label('equipment_name'),
        Equipment.type.label('equipment_type')
    ).join(Equipment, FuelLog.equipment_id == Equipment.id).filter(FuelLog.id == log_id).first()

    if not result:
        raise HTTPException(status_code=404, detail="Fuel log not found")

    log_dict = {
        'id': result.FuelLog.id,
        'equipment_id': result.FuelLog.equipment_id,
        'liters_filled': result.FuelLog.liters_filled,
        'refuel_date': result.FuelLog.refuel_date,
        'location': result.FuelLog.location,
        'photo_url': result.FuelLog.photo_url,
        'notes': result.FuelLog.notes,
        'recorded_by': result.FuelLog.recorded_by,
        'created_at': result.FuelLog.created_at,
        'equipment_name': result.equipment_name,
        'equipment_type': result.equipment_type
    }
    return log_dict


@router.put("/logs/{log_id}", response_model=FuelLogSchema)
def update_fuel_log(
    log_id: int,
    fuel_data: FuelLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update catatan pengisian BBM"""
    fuel_log = db.query(FuelLog).filter(FuelLog.id == log_id).first()
    if not fuel_log:
        raise HTTPException(status_code=404, detail="Fuel log not found")

    if not current_user.is_admin and not current_user.is_superuser and fuel_log.recorded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this log")

    update_data = fuel_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(fuel_log, field, value)

    db.commit()
    db.refresh(fuel_log)
    return fuel_log


@router.get("/efficiency", response_model=FuelEfficiencyStats)
def get_fuel_efficiency(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Efisiensi BBM: total liter / total jam kerja (dari catatan jam kerja) dalam periode yang sama.
    """
    since = _period_start(days)

    total_fuel = db.query(func.coalesce(func.sum(FuelLog.liters_filled), 0)).filter(
        FuelLog.refuel_date >= since
    ).scalar()
    total_fuel = float(total_fuel or 0)

    total_work_hours = db.query(func.coalesce(func.sum(WorkLog.total_hours), 0)).filter(
        WorkLog.work_date >= since
    ).scalar()
    total_work_hours = float(total_work_hours or 0)

    fuel_eq: Set[int] = {
        r[0] for r in db.query(FuelLog.equipment_id).filter(
            FuelLog.refuel_date >= since
        ).distinct().all() if r[0] is not None
    }
    work_eq: Set[int] = {
        r[0] for r in db.query(WorkLog.equipment_id).filter(
            WorkLog.work_date >= since
        ).distinct().all() if r[0] is not None
    }
    equipment_count = len(fuel_eq | work_eq)

    avg_fuel_ratio = (total_fuel / total_work_hours) if total_work_hours > 0 else 0.0

    return FuelEfficiencyStats(
        total_fuel_consumed=round(total_fuel, 2),
        equipment_count=equipment_count
    )


@router.get("/equipment-report", response_model=List[FuelEquipmentReportItem])
def get_fuel_equipment_report(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ringkasan per alat: jam kerja vs liter BBM vs konsumsi rata-rata per jam dalam satu periode."""
    since = _period_start(days)

    fuel_rows = db.query(
        FuelLog.equipment_id,
        func.coalesce(func.sum(FuelLog.liters_filled), 0).label("total_liters"),
        func.count(FuelLog.id).label("refuel_count"),
    ).filter(
        FuelLog.refuel_date >= since
    ).group_by(FuelLog.equipment_id).all()

    work_rows = db.query(
        WorkLog.equipment_id,
        func.coalesce(func.sum(WorkLog.total_hours), 0).label("total_work_hours"),
        func.count(WorkLog.id).label("work_log_count"),
    ).filter(
        WorkLog.work_date >= since
    ).group_by(WorkLog.equipment_id).all()

    by_id = {}
    for row in fuel_rows:
        eq_id = row.equipment_id
        by_id[eq_id] = {
            "total_liters": float(row.total_liters or 0),
            "total_work_hours": 0.0,
            "refuel_count": int(row.refuel_count or 0),
            "work_log_count": 0,
        }

    for row in work_rows:
        eq_id = row.equipment_id
        total_wh = float(row.total_work_hours or 0)
        wcount = int(row.work_log_count or 0)
        if eq_id not in by_id:
            by_id[eq_id] = {
                "total_liters": 0.0,
                "total_work_hours": total_wh,
                "refuel_count": 0,
                "work_log_count": wcount,
            }
        else:
            by_id[eq_id]["total_work_hours"] = total_wh
            by_id[eq_id]["work_log_count"] = wcount

    equipment_list = db.query(Equipment).filter(Equipment.id.in_(list(by_id.keys()))).all() if by_id else []
    equip_by_id = {e.id: e for e in equipment_list}

    items: List[FuelEquipmentReportItem] = []

    def _report_sort_key(kv: tuple) -> tuple:
        eq_id, _sums = kv
        eq = equip_by_id.get(eq_id)
        label = eq.name.lower() if eq else str(eq_id).zfill(8)
        return (label, eq_id)

    for eq_id, sums in sorted(by_id.items(), key=_report_sort_key):
        equip = equip_by_id.get(eq_id)
        liters = sums["total_liters"]
        hours = sums["total_work_hours"]

        # Prefer calculation based on HM delta jika tersedia; fallback ke rata-rata total liters / total work hours.
        lph = None
        hour_meter_rows = db.query(FuelLog.hour_meter).filter(
            FuelLog.equipment_id == eq_id,
            FuelLog.refuel_date >= since,
            FuelLog.hour_meter != None
        ).order_by(FuelLog.refuel_date.desc(), FuelLog.id.desc()).limit(2).all()

        hour_meters = [float(row[0]) for row in hour_meter_rows if row[0] is not None]
        if len(hour_meters) >= 2:
            delta_hm = hour_meters[0] - hour_meters[1]
            if delta_hm > 0:
                lph = liters / delta_hm

        if lph is None and hours > 0:
            lph = liters / hours

        lph = round(lph, 2) if lph is not None else None

        status_anomali = False
        pesan_alert = ""
        if lph is not None:
            if lph > 35:
                status_anomali = True
                pesan_alert = "Konsumsi BBM boros (>35 liter/jam). Periksa penggunaan atau kondisi mesin."
            elif lph < 5:
                status_anomali = True
                pesan_alert = "Konsumsi BBM tidak wajar (<5 liter/jam). Periksa input HM/jam kerja."
        else:
            pesan_alert = "Data tidak cukup untuk menghitung Liter/Jam."

        items.append(
            FuelEquipmentReportItem(
                equipment_id=eq_id,
                equipment_name=equip.name if equip else f"#{eq_id}",
                equipment_type=equip.type if equip else "?",
                location=equip.location if equip else None,
                total_liters=round(liters, 2),
                total_work_hours=round(hours, 2),
                liter_per_hour=lph,
                status_anomali=status_anomali,
                pesan_alert=pesan_alert,
                refuel_count=sums["refuel_count"],
            )
        )

    return items


@router.get("/efficiency/{equipment_id}", response_model=dict)
def get_equipment_fuel_efficiency(
    equipment_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Efisiensi BBM per equipment (liter / jam kerja terdaftar)"""
    since = _period_start(days)

    total_liters = db.query(func.coalesce(func.sum(FuelLog.liters_filled), 0)).filter(
        FuelLog.equipment_id == equipment_id,
        FuelLog.refuel_date >= since
    ).scalar()
    total_liters = float(total_liters or 0)

    total_hours = db.query(func.coalesce(func.sum(WorkLog.total_hours), 0)).filter(
        WorkLog.equipment_id == equipment_id,
        WorkLog.work_date >= since
    ).scalar()
    total_hours = float(total_hours or 0)

    refuel_count = db.query(func.count(FuelLog.id)).filter(
        FuelLog.equipment_id == equipment_id,
        FuelLog.refuel_date >= since
    ).scalar() or 0

    fuel_ratio = (total_liters / total_hours) if total_hours > 0 else 0.0

    return {
        "equipment_id": equipment_id,
        "total_liters": round(total_liters, 2),
        "hours_operated": round(total_hours, 2),
        "fuel_ratio": round(fuel_ratio, 2),
        "refuel_count": int(refuel_count)
    }


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fuel_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Hapus catatan pengisian BBM (admin only)"""
    log = db.query(FuelLog).filter(FuelLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Fuel log not found")

    if not current_user.is_admin and not current_user.is_superuser and log.recorded_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this log")

    db.delete(log)
    db.commit()
    return None


@router.get("/price", response_model=List[FuelPriceSchema])
def get_fuel_prices(
    fuel_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ambil daftar pembelian BBM, opsional filter berdasarkan tanggal"""
    query = db.query(FuelPrice)

    if fuel_type:
        query = query.filter(FuelPrice.fuel_type == fuel_type)
    if start_date:
        query = query.filter(cast(FuelPrice.effective_date, Date) >= start_date)
    if end_date:
        query = query.filter(cast(FuelPrice.effective_date, Date) <= end_date)

    prices = query.order_by(FuelPrice.effective_date.desc()).all()
    return prices


@router.post("/price", response_model=FuelPriceSchema)
def create_fuel_price(
    price_data: FuelPriceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tambah pembelian BBM baru. GM langsung auto-approved."""
    if not current_user.is_admin and not current_user.is_superuser and current_user.role not in ['gm', 'finance', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to create fuel purchases")

    is_gm = current_user.role in ('gm', 'admin') or current_user.is_admin or current_user.is_superuser

    fuel_price = FuelPrice(
        price_per_liter=price_data.price_per_liter,
        fuel_type=price_data.fuel_type,
        effective_date=price_data.effective_date,
        liters=price_data.liters,
        total_price=price_data.total_price,
        notes=price_data.notes,
        approval_status="approved" if is_gm else "pending",
        approved_by=current_user.id if is_gm else None,
        approved_at=datetime.now() if is_gm else None,
        created_by=current_user.id if current_user else None,
    )

    db.add(fuel_price)
    db.commit()
    db.refresh(fuel_price)
    return fuel_price



@router.put("/price/{price_id}/approve", response_model=FuelPriceSchema)
def approve_fuel_purchase(
    price_id: int,
    status: str = "approved",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve atau reject pembelian BBM (GM only)"""
    if not current_user.is_admin and not current_user.is_superuser and current_user.role not in ['gm', 'admin']:
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat melakukan approval")
        
    purchase = db.query(FuelPrice).filter(FuelPrice.id == price_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Data pembelian BBM tidak ditemukan")
        
    purchase.approval_status = status
    purchase.approved_by = current_user.id
    purchase.approved_at = datetime.now()
    
    db.commit()
    db.refresh(purchase)
    return purchase


@router.put("/price/{price_id}", response_model=FuelPriceSchema)
def update_fuel_purchase(
    price_id: int,
    data: FuelPriceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update pembelian BBM"""
    purchase = db.query(FuelPrice).filter(FuelPrice.id == price_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Data pembelian BBM tidak ditemukan")

    # Only GM or the creator (if pending) can update
    is_gm = current_user.is_admin or current_user.is_superuser or current_user.role in ['gm', 'admin']
    if not is_gm and purchase.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this purchase")
        
    if purchase.approval_status != "pending" and not is_gm:
        raise HTTPException(status_code=400, detail="Cannot update an approved/rejected purchase")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(purchase, field, value)

    # If updated by Finance, reset approval status
    if not is_gm and "approval_status" not in update_data:
        purchase.approval_status = "pending"

    db.commit()
    db.refresh(purchase)
    return purchase


@router.delete("/price/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fuel_purchase(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Hapus data pembelian BBM"""
    purchase = db.query(FuelPrice).filter(FuelPrice.id == price_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Data pembelian BBM tidak ditemukan")

    is_gm = current_user.is_admin or current_user.is_superuser or current_user.role in ['gm', 'admin']
    if not is_gm and purchase.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this purchase")
        
    if purchase.approval_status != "pending" and not is_gm:
        raise HTTPException(status_code=400, detail="Cannot delete an approved/rejected purchase")

    db.delete(purchase)
    db.commit()
    return None


@router.get("/stock", response_model=dict)
def get_fuel_stock(db: Session = Depends(get_db)):
    """Menghitung total stok BBM tersedia berdasarkan pembelian yang disetujui dikurangi penggunaan"""
    total_approved_stock = db.query(func.coalesce(func.sum(FuelPrice.liters), 0)).filter(
        FuelPrice.approval_status == 'approved'
    ).scalar()
    
    total_consumed = db.query(func.coalesce(func.sum(FuelLog.liters_filled), 0)).scalar()
    
    current_stock = float(total_approved_stock or 0) - float(total_consumed or 0)
    
    return {
        "total_purchased": float(total_approved_stock or 0),
        "total_consumed": float(total_consumed or 0),
        "current_stock": current_stock
    }
