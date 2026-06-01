from datetime import date, datetime, timedelta
from typing import List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from ..models import FuelLog, Equipment, User, WorkLog, FuelPrice
from ..core.exceptions import AuthorizationError, NotFoundError, ValidationError
from ..schemas import (
    FuelLogCreate,
    FuelLogUpdate,
    FuelPriceCreate,
    FuelPriceUpdate,
    FuelEquipmentReportItem,
    FuelEfficiencyStats
)

class FuelService:
    @staticmethod
    def _period_start(days: int) -> datetime:
        return datetime.now() - timedelta(days=days)

    @staticmethod
    def create_fuel_log(db: Session, current_user: User, fuel_data: FuelLogCreate) -> FuelLog:
        equipment = db.query(Equipment).filter(Equipment.id == fuel_data.equipment_id).first()
        if not equipment:
            raise NotFoundError("Equipment not found")

        total_approved_stock = db.query(func.coalesce(func.sum(FuelPrice.liters), 0)).filter(
            FuelPrice.approval_status == 'approved'
        ).scalar()
        total_consumed = db.query(func.coalesce(func.sum(FuelLog.liters_filled), 0)).scalar()
        current_stock = float(total_approved_stock or 0) - float(total_consumed or 0)
        
        if current_stock < fuel_data.liters_filled:
            raise ValidationError(f"Stok BBM tidak mencukupi. Sisa stok: {current_stock} Liter")

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

    @staticmethod
    def get_fuel_logs(db: Session, equipment_id: Optional[int] = None, days: int = 30) -> List[dict]:
        query = db.query(
            FuelLog,
            Equipment.name.label('equipment_name'),
            Equipment.type.label('equipment_type')
        ).join(Equipment, FuelLog.equipment_id == Equipment.id)

        if equipment_id:
            query = query.filter(FuelLog.equipment_id == equipment_id)

        since = FuelService._period_start(days)
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

    @staticmethod
    def get_fuel_log_by_id(db: Session, log_id: int) -> dict:
        result = db.query(
            FuelLog,
            Equipment.name.label('equipment_name'),
            Equipment.type.label('equipment_type')
        ).join(Equipment, FuelLog.equipment_id == Equipment.id).filter(FuelLog.id == log_id).first()

        if not result:
            raise NotFoundError("Fuel log not found")

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

    @staticmethod
    def update_fuel_log(db: Session, log_id: int, fuel_data: FuelLogUpdate) -> FuelLog:
        fuel_log = db.query(FuelLog).filter(FuelLog.id == log_id).first()
        if not fuel_log:
            raise NotFoundError("Fuel log not found")

        update_data = fuel_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(fuel_log, field, value)

        db.commit()
        db.refresh(fuel_log)
        return fuel_log

    @staticmethod
    def delete_fuel_log(db: Session, log_id: int) -> None:
        log = db.query(FuelLog).filter(FuelLog.id == log_id).first()
        if not log:
            raise NotFoundError("Fuel log not found")

        db.delete(log)
        db.commit()

    @staticmethod
    def get_fuel_efficiency(db: Session, days: int = 30) -> FuelEfficiencyStats:
        since = FuelService._period_start(days)

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

        return FuelEfficiencyStats(
            total_fuel_consumed=round(total_fuel, 2),
            equipment_count=equipment_count
        )

    @staticmethod
    def get_fuel_equipment_report(db: Session, days: int = 30) -> List[FuelEquipmentReportItem]:
        since = FuelService._period_start(days)

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

    @staticmethod
    def get_equipment_fuel_efficiency(db: Session, equipment_id: int, days: int = 30) -> dict:
        since = FuelService._period_start(days)

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

    @staticmethod
    def get_fuel_vendors(db: Session) -> List[str]:
        vendors = db.query(FuelPrice.vendor_name).filter(
            FuelPrice.vendor_name != None,
            FuelPrice.vendor_name != ""
        ).distinct().all()
        return [v[0] for v in vendors]

    @staticmethod
    def get_fuel_prices(db: Session, fuel_type: Optional[str] = None, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[FuelPrice]:
        query = db.query(FuelPrice)
        if fuel_type:
            query = query.filter(FuelPrice.fuel_type == fuel_type)
        if start_date:
            query = query.filter(cast(FuelPrice.effective_date, Date) >= start_date)
        if end_date:
            query = query.filter(cast(FuelPrice.effective_date, Date) <= end_date)
        return query.order_by(FuelPrice.effective_date.desc()).all()

    @staticmethod
    def create_fuel_price(db: Session, current_user: User, price_data: FuelPriceCreate) -> FuelPrice:
        is_gm = current_user.role in ('gm', 'admin') or getattr(current_user, 'is_admin', False) or getattr(current_user, 'is_superuser', False)

        fuel_price = FuelPrice(
            price_per_liter=price_data.price_per_liter,
            fuel_type=price_data.fuel_type,
            effective_date=price_data.effective_date,
            liters=price_data.liters,
            total_price=price_data.total_price,
            notes=price_data.notes,
            vendor_name=price_data.vendor_name,
            project_id=price_data.project_id,
            approval_status="approved" if is_gm else "pending",
            approved_by=current_user.id if is_gm else None,
            approved_at=datetime.now() if is_gm else None,
            created_by=current_user.id if current_user else None,
        )

        db.add(fuel_price)
        db.commit()
        db.refresh(fuel_price)
        return fuel_price

    @staticmethod
    def approve_fuel_purchase(db: Session, current_user: User, price_id: int, status: str = "approved") -> FuelPrice:
        purchase = db.query(FuelPrice).filter(FuelPrice.id == price_id).first()
        if not purchase:
            raise NotFoundError("Data pembelian BBM tidak ditemukan")
            
        purchase.approval_status = status
        purchase.approved_by = current_user.id
        purchase.approved_at = datetime.now()
        
        db.commit()
        db.refresh(purchase)
        return purchase

    @staticmethod
    def pay_fuel_purchase(db: Session, current_user: User, price_id: int) -> FuelPrice:
        purchase = db.query(FuelPrice).filter(FuelPrice.id == price_id).first()
        if not purchase:
            raise NotFoundError("Data pembelian BBM tidak ditemukan")
            
        if purchase.payment_status == "paid":
            raise ValidationError("Pembelian sudah lunas")
            
        purchase.payment_status = "paid"
        purchase.paid_by = current_user.id
        purchase.paid_at = datetime.now()
        
        db.commit()
        db.refresh(purchase)
        return purchase

    @staticmethod
    def update_fuel_purchase(db: Session, current_user: User, price_id: int, data: FuelPriceUpdate) -> FuelPrice:
        purchase = db.query(FuelPrice).filter(FuelPrice.id == price_id).first()
        if not purchase:
            raise NotFoundError("Data pembelian BBM tidak ditemukan")

        is_gm = getattr(current_user, 'is_admin', False) or getattr(current_user, 'is_superuser', False) or getattr(current_user, 'role', '') in ['gm', 'admin']
        if not is_gm and purchase.created_by != current_user.id:
            raise AuthorizationError("Not authorized to update this purchase")
            
        if purchase.approval_status != "pending" and not is_gm:
            raise ValidationError("Cannot update an approved/rejected purchase")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(purchase, field, value)

        if not is_gm and "approval_status" not in update_data:
            purchase.approval_status = "pending"

        db.commit()
        db.refresh(purchase)
        return purchase

    @staticmethod
    def delete_fuel_purchase(db: Session, current_user: User, price_id: int) -> None:
        purchase = db.query(FuelPrice).filter(FuelPrice.id == price_id).first()
        if not purchase:
            raise NotFoundError("Data pembelian BBM tidak ditemukan")

        is_gm = getattr(current_user, 'is_admin', False) or getattr(current_user, 'is_superuser', False) or getattr(current_user, 'role', '') in ['gm', 'admin']
        if not is_gm and purchase.created_by != current_user.id:
            raise AuthorizationError("Not authorized to delete this purchase")
            
        if purchase.approval_status != "pending" and not is_gm:
            raise ValidationError("Cannot delete an approved/rejected purchase")

        db.delete(purchase)
        db.commit()

    @staticmethod
    def get_fuel_stock(db: Session) -> dict:
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
