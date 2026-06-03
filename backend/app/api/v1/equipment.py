from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from ...core.database import get_db
from ...core.auth import get_current_user, require_admin, require_role
from ...schemas.equipment import Equipment as EquipmentSchema, EquipmentCreate, EquipmentUpdate
from ...services.equipment_service import EquipmentService

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[EquipmentSchema])
def get_equipment(db: Session = Depends(get_db)):
    return EquipmentService.get_equipments(db)

@router.get("/{equipment_id}", response_model=EquipmentSchema)
def get_equipment_by_id(equipment_id: int, db: Session = Depends(get_db)):
    return EquipmentService.get_equipment(db, equipment_id)

@router.post("", response_model=EquipmentSchema, dependencies=[Depends(require_role(["field", "finance", "checker", "admin", "gm", "direktur"]))])
def create_equipment(equipment: EquipmentCreate, db: Session = Depends(get_db)):
    return EquipmentService.create_equipment(db, equipment)

@router.put("/{equipment_id}", response_model=EquipmentSchema, dependencies=[Depends(require_role(["field", "finance", "checker", "admin", "gm", "direktur"]))])
def update_equipment(equipment_id: int, equipment_update: EquipmentUpdate, db: Session = Depends(get_db)):
    return EquipmentService.update_equipment(db, equipment_id, equipment_update)

@router.delete("/{equipment_id}", dependencies=[Depends(require_admin)])
def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    EquipmentService.delete_equipment(db, equipment_id)
    return {"message": "Equipment deleted successfully"}