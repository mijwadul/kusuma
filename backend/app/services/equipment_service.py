from typing import List
from sqlalchemy.orm import Session
from ..models import Equipment, EquipmentRateHistory, WorkLog, Vendor
from ..schemas.equipment import EquipmentCreate, EquipmentUpdate
from ..core.exceptions import NotFoundError
import datetime

class EquipmentService:
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
