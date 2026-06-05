from typing import List
from sqlalchemy.orm import Session
from ..models import Equipment
from ..schemas.equipment import EquipmentCreate, EquipmentUpdate
from ..core.exceptions import NotFoundError

class EquipmentService:
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
            
            if new_rate != old_rate:
                from decimal import Decimal
                from .vendor_service import VendorService
                balance_data = VendorService._get_equipment_balance(db, equipment)
                current_balance = Decimal(str(balance_data["balance"]))
                
                if current_balance > 0:
                    update_data["pending_rental_rate_per_hour"] = new_rate
                    update_data["locked_balance_for_pending_rate"] = current_balance
                    update_data["rental_rate_per_hour"] = old_rate # Keep old active
                    
                    # Prevent original_request from overwriting what we just calculated
                    if "pending_rental_rate_per_hour" in original_request:
                        del original_request["pending_rental_rate_per_hour"]
                else:
                    update_data["pending_rental_rate_per_hour"] = None
                    update_data["locked_balance_for_pending_rate"] = None
                    
                    if "pending_rental_rate_per_hour" in original_request:
                        del original_request["pending_rental_rate_per_hour"]

        # Only apply manual pending rate edits if we didn't just auto-calculate a transition
        if "pending_rental_rate_per_hour" in original_request:
            update_data["pending_rental_rate_per_hour"] = original_request["pending_rental_rate_per_hour"]
            if original_request["pending_rental_rate_per_hour"] is None:
                update_data["locked_balance_for_pending_rate"] = None

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
