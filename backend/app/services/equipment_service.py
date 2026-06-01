from typing import List
from sqlalchemy.orm import Session
from ..models import Equipment
from ..schemas.equipment import EquipmentCreate, EquipmentUpdate
from ..core.exceptions import NotFoundError

class EquipmentService:
    @staticmethod
    def get_equipments(db: Session) -> List[Equipment]:
        return db.query(Equipment).all()

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
        
        for key, value in equipment_update.model_dump(exclude_unset=True).items():
            setattr(equipment, key, value)
        
        db.commit()
        db.refresh(equipment)
        return equipment

    @staticmethod
    def delete_equipment(db: Session, equipment_id: int) -> None:
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if not equipment:
            raise NotFoundError("Equipment not found")
        
        db.delete(equipment)
        db.commit()
