from typing import List
from sqlalchemy.orm import Session
from ..models import Equipment, EquipmentRateHistory, WorkLog, Vendor
from ..schemas.equipment import EquipmentCreate, EquipmentUpdate
from ..core.exceptions import NotFoundError
import datetime

class EquipmentService:
    @staticmethod
    def get_equipment_ledger(db: Session, equipment_id: int):
        from ..models import VendorTopUp, WorkLog, EquipmentRateHistory, Equipment
        from ..schemas.ledger import LedgerItem
        from decimal import Decimal

        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment or not equipment.vendor_id:
            return []

        vendor_id = equipment.vendor_id
        
        from sqlalchemy import or_
        
        # 1. Fetch Topups for this vendor (only global topups or specific to this equipment)
        topups = db.query(VendorTopUp).filter(
            VendorTopUp.vendor_id == vendor_id,
            VendorTopUp.status == "approved",
            or_(VendorTopUp.equipment_id == equipment_id, VendorTopUp.equipment_id.is_(None))
        ).all()

        equipment_names = {equipment.id: equipment.name}

        # 2. Fetch WorkLogs for THIS equipment only
        worklogs = db.query(WorkLog).filter(WorkLog.equipment_id == equipment_id).all()

        # 3. Fetch Rate Histories for THIS equipment only
        histories = db.query(EquipmentRateHistory).filter(EquipmentRateHistory.equipment_id == equipment_id).all()

        events = []

        for t in topups:
            desc = f"Top-Up Deposit"
            if t.equipment_id:
                desc += f" (Khusus {equipment_names.get(t.equipment_id, 'Alat')})"
            if t.notes:
                desc += f" - {t.notes}"
            events.append({
                "id": f"topup_{t.id}",
                "type": "topup",
                "date": t.topup_date or t.approved_at,
                "description": desc,
                "amount": t.amount,
                "hours": None,
                "applied_rate": None,
                "old_rate": None,
                "new_rate": None,
                "split_details": None
            })

        from .work_log_service import WorkLogService
        
        for w in worklogs:
            hours = float(w.total_hours or 0) - float(w.rental_discount_hours or 0)
            if hours <= 0:
                continue
                
            if getattr(w, 'total_cost', None) is not None:
                cost = w.total_cost
                rate = w.applied_rate or 0
            else:
                calc = WorkLogService._calculate_rental_costs(w, equipment)
                cost = calc["rental_cost_total"]
                rate = calc["rental_rate_per_hour"]
                
            events.append({
                "id": f"worklog_{w.id}",
                "type": "worklog",
                "date": w.work_date,
                "description": f"Pemakaian {equipment_names.get(w.equipment_id, 'Alat')} ({w.input_method})",
                "amount": -Decimal(str(cost)),
                "hours": hours,
                "applied_rate": rate,
                "old_rate": None,
                "new_rate": None,
                "split_details": w.split_details
            })

        for h in histories:
            date_val = h.effective_date or h.applied_at or h.created_at
            if h.status == "applied":
                events.append({
                    "id": f"rate_{h.id}",
                    "type": "rate_change",
                    "date": date_val,
                    "description": f"Perubahan Harga {equipment_names.get(h.equipment_id, 'Alat')} ({h.trigger_type})",
                    "amount": Decimal("0"),
                    "hours": None,
                    "applied_rate": None,
                    "old_rate": h.old_rate,
                    "new_rate": h.new_rate,
                    "split_details": None
                })

        # Sort all events chronologically
        events.sort(key=lambda x: (x["date"] if isinstance(x["date"], datetime.datetime) else datetime.datetime.combine(x["date"], datetime.time.min)))

        running_balance = Decimal("0")
        ledger_items = []
        for ev in events:
            running_balance += ev["amount"]
            ev["running_balance"] = running_balance
            ledger_items.append(LedgerItem(**ev))

        return ledger_items

    @staticmethod
    def get_equipment_rate_history(db: Session, equipment_id: int) -> List[EquipmentRateHistory]:
        return db.query(EquipmentRateHistory).filter(EquipmentRateHistory.equipment_id == equipment_id).order_by(EquipmentRateHistory.created_at.desc()).all()

    @staticmethod
    def get_equipments(db: Session) -> List[Equipment]:
        return db.query(Equipment).filter(Equipment.status != "deleted").all()

    @staticmethod
    def get_equipment(db: Session, equipment_id: int) -> Equipment:
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment:
            raise NotFoundError("Equipment not found")
        return equipment

    @staticmethod
    def create_equipment(db: Session, equipment: EquipmentCreate) -> Equipment:
        db_equipment = Equipment(**equipment.model_dump())
        db.add(db_equipment)
        db.commit()
        db.refresh(db_equipment)
        return db_equipment

    @staticmethod
    def update_equipment(db: Session, equipment_id: int, equipment_update: EquipmentUpdate) -> Equipment:
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment:
            raise NotFoundError("Equipment not found")
        
        update_data = equipment_update.model_dump(exclude_unset=True)
        original_request = equipment_update.model_dump(exclude_unset=True)
        
        if "rental_rate_per_hour" in update_data and equipment.ownership_status == "rental":
            new_rate = update_data["rental_rate_per_hour"]
            old_rate = equipment.rental_rate_per_hour
            
            trigger_type = update_data.get("rate_trigger_type", "deposit")
            effective_date = update_data.get("rate_effective_date")
            auto_recalculate = update_data.get("auto_recalculate", False)

            if new_rate != old_rate:
                from decimal import Decimal
                from .vendor_service import VendorService
                
                # Create history record
                history = EquipmentRateHistory(
                    equipment_id=equipment.id,
                    old_rate=old_rate,
                    new_rate=new_rate,
                    trigger_type=trigger_type,
                    effective_date=effective_date,
                    status="pending"
                )
                
                if trigger_type == "immediate":
                    update_data["rental_rate_per_hour"] = new_rate
                    update_data["pending_rental_rate_per_hour"] = None
                    update_data["locked_balance_for_pending_rate"] = None
                    update_data["pending_rate_effective_date"] = None
                    history.status = "applied"
                    history.applied_at = datetime.datetime.now()
                    
                elif trigger_type == "deposit":
                    balance_data = VendorService._get_equipment_balance(db, equipment)
                    current_balance = Decimal(str(balance_data["balance"]))
                    
                    if current_balance > 0:
                        update_data["pending_rental_rate_per_hour"] = new_rate
                        update_data["locked_balance_for_pending_rate"] = current_balance
                        update_data["pending_rate_effective_date"] = None
                        update_data["rental_rate_per_hour"] = old_rate # Keep old active
                    else:
                        update_data["rental_rate_per_hour"] = new_rate
                        update_data["pending_rental_rate_per_hour"] = None
                        update_data["locked_balance_for_pending_rate"] = None
                        update_data["pending_rate_effective_date"] = None
                        history.status = "applied"
                        history.applied_at = datetime.datetime.now()
                        
                elif trigger_type == "date":
                    if effective_date and effective_date <= datetime.date.today():
                        # Date is today or in the past
                        update_data["rental_rate_per_hour"] = new_rate
                        update_data["pending_rental_rate_per_hour"] = None
                        update_data["locked_balance_for_pending_rate"] = None
                        update_data["pending_rate_effective_date"] = None
                        history.status = "applied"
                        history.applied_at = datetime.datetime.now()
                        
                        if auto_recalculate:
                            # Trigger auto recalculation
                            EquipmentService.apply_backdated_rate(db, equipment.id, new_rate, effective_date)
                    else:
                        update_data["pending_rental_rate_per_hour"] = new_rate
                        update_data["locked_balance_for_pending_rate"] = None
                        update_data["pending_rate_effective_date"] = effective_date
                        update_data["rental_rate_per_hour"] = old_rate

                db.add(history)

        # Cleanup extra fields from update_data before setattr
        for field in ["rate_trigger_type", "rate_effective_date", "auto_recalculate"]:
            if field in update_data:
                del update_data[field]

        for key, value in update_data.items():
            setattr(equipment, key, value)
        
        db.commit()
        db.refresh(equipment)
        return equipment

    @staticmethod
    def delete_equipment(db: Session, equipment_id: int) -> None:
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment:
            raise NotFoundError("Equipment not found")
        
        equipment.status = "deleted"
        db.commit()

    @staticmethod
    def apply_backdated_rate(db: Session, equipment_id: int, new_rate: 'Decimal', effective_date: 'datetime.date') -> None:
        from decimal import Decimal
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment or not equipment.vendor_id:
            return
            
        vendor = db.query(Vendor).filter(Vendor.id == equipment.vendor_id).first()
        if not vendor:
            return

        work_logs = db.query(WorkLog).filter(
            WorkLog.equipment_id == equipment_id,
            WorkLog.work_date >= effective_date
        ).all()

        total_difference = Decimal("0")
        for log in work_logs:
            hours = Decimal(str(log.total_hours or 0))
            discount = Decimal(str(log.rental_discount_hours or 0))
            if discount < 0: discount = Decimal("0")
            if discount > hours: discount = hours
            
            billable_hours = hours - discount
            old_cost = Decimal(str(log.total_cost or 0))
            
            new_cost = billable_hours * Decimal(str(new_rate))
            difference = new_cost - old_cost
            
            log.applied_rate = new_rate
            log.total_cost = new_cost
            total_difference += difference

        # Adjust vendor balance globally
        vendor.balance_deposit = Decimal(str(vendor.balance_deposit or 0)) - total_difference
        # If total_cost increases, deposit decreases faster (so we subtract difference)
        # Wait: Vendor deposit logic: 
        # When creating work log, we SUBTRACT from locked balance, but in WorkLogService._calculate_rental_costs
        # wait, vendor deposit balance is global.
        # When user tops up, balance_deposit increases. When work log is done, what happens to vendor.balance_deposit?
        
        db.commit()

    @staticmethod
    def update_equipment_rate_history(db: Session, equipment_id: int, history_id: int, update_data: dict) -> 'EquipmentRateHistory':
        from ..models import EquipmentRateHistory
        history = db.query(EquipmentRateHistory).filter(
            EquipmentRateHistory.id == history_id,
            EquipmentRateHistory.equipment_id == equipment_id
        ).first()
        if not history:
            raise NotFoundError("History not found")

        for key, value in update_data.items():
            if value is not None:
                setattr(history, key, value)
        
        db.commit()
        db.refresh(history)

        EquipmentService.recalculate_equipment_costs(db, equipment_id)
        EquipmentService._update_current_rate_from_history(db, equipment_id)
        
        return history

    @staticmethod
    def delete_equipment_rate_history(db: Session, equipment_id: int, history_id: int) -> None:
        from ..models import EquipmentRateHistory
        history = db.query(EquipmentRateHistory).filter(
            EquipmentRateHistory.id == history_id,
            EquipmentRateHistory.equipment_id == equipment_id
        ).first()
        if not history:
            raise NotFoundError("History not found")

        db.delete(history)
        db.commit()

        EquipmentService.recalculate_equipment_costs(db, equipment_id)
        EquipmentService._update_current_rate_from_history(db, equipment_id)

    @staticmethod
    def _update_current_rate_from_history(db: Session, equipment_id: int):
        from ..models import EquipmentRateHistory
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment: return
        
        latest_history = db.query(EquipmentRateHistory).filter(
            EquipmentRateHistory.equipment_id == equipment_id,
            EquipmentRateHistory.status == "applied"
        ).order_by(
            EquipmentRateHistory.effective_date.is_(None),
            EquipmentRateHistory.effective_date.desc(),
            EquipmentRateHistory.applied_at.is_(None),
            EquipmentRateHistory.applied_at.desc(),
            EquipmentRateHistory.created_at.desc()
        ).first()
        
        if latest_history:
            equipment.rental_rate_per_hour = latest_history.new_rate
            db.commit()

    @staticmethod
    def recalculate_equipment_costs(db: Session, equipment_id: int) -> None:
        from decimal import Decimal
        from ..models import WorkLog, Vendor, EquipmentRateHistory
        
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment or not equipment.vendor_id or equipment.ownership_status != "rental":
            return
            
        vendor = db.query(Vendor).filter(Vendor.id == equipment.vendor_id).first()
        if not vendor:
            return

        histories = db.query(EquipmentRateHistory).filter(
            EquipmentRateHistory.equipment_id == equipment_id,
            EquipmentRateHistory.status == "applied"
        ).order_by(
            EquipmentRateHistory.effective_date.is_(None),
            EquipmentRateHistory.effective_date.asc(),
            EquipmentRateHistory.applied_at.is_(None),
            EquipmentRateHistory.applied_at.asc(),
            EquipmentRateHistory.created_at.asc()
        ).all()

        def get_rate_for_date(w_date) -> Decimal:
            if isinstance(w_date, datetime.datetime):
                w_date_cmp = w_date.date()
            else:
                w_date_cmp = w_date
                
            applicable_history = None
            for h in histories:
                h_date = h.effective_date
                if not h_date:
                    if h.applied_at: h_date = h.applied_at.date()
                    else: h_date = h.created_at.date()
                
                if isinstance(h_date, datetime.datetime):
                    h_date_cmp = h_date.date()
                else:
                    h_date_cmp = h_date
                    
                if h_date_cmp <= w_date_cmp:
                    applicable_history = h
            
            if applicable_history:
                return applicable_history.new_rate
            else:
                if histories and histories[0].old_rate is not None:
                    return histories[0].old_rate
                return Decimal(str(equipment.rental_rate_per_hour or 0))

        work_logs = db.query(WorkLog).filter(WorkLog.equipment_id == equipment_id).all()
        total_difference = Decimal("0")
        
        for log in work_logs:
            w_date = log.work_date
            if not w_date: continue
            
            applicable_rate = Decimal(str(get_rate_for_date(w_date)))
            
            hours = Decimal(str(log.total_hours or 0))
            discount = Decimal(str(log.rental_discount_hours or 0))
            if discount < 0: discount = Decimal("0")
            if discount > hours: discount = hours
            
            billable_hours = hours - discount
            old_cost = Decimal(str(log.total_cost or 0))
            
            new_cost = billable_hours * applicable_rate
            difference = new_cost - old_cost
            
            log.applied_rate = applicable_rate
            log.total_cost = new_cost
            log.split_details = None
            total_difference += difference

        vendor.balance_deposit = Decimal(str(vendor.balance_deposit or 0)) - total_difference
        db.commit()
