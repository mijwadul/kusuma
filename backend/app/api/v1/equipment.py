from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from ...core.database import get_db
from ...core.auth import get_current_user, require_admin, require_role
from ...schemas.equipment import Equipment as EquipmentSchema, EquipmentCreate, EquipmentUpdate
from ...schemas.equipment_rate_history import EquipmentRateHistory as EquipmentRateHistorySchema, EquipmentRateHistoryUpdate
from ...services.equipment_service import EquipmentService

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[EquipmentSchema])
def get_equipment(db: Session = Depends(get_db)):
    return EquipmentService.get_equipments(db)

@router.get("/{equipment_id}", response_model=EquipmentSchema)
def get_equipment_by_id(equipment_id: int, db: Session = Depends(get_db)):
    return EquipmentService.get_equipment(db, equipment_id)

@router.get("/{equipment_id}/rate-history", response_model=List[EquipmentRateHistorySchema])
def get_equipment_rate_history(equipment_id: int, db: Session = Depends(get_db)):
    return EquipmentService.get_equipment_rate_history(db, equipment_id)

@router.put("/{equipment_id}/rate-history/{history_id}", response_model=EquipmentRateHistorySchema, dependencies=[Depends(require_admin)])
def update_equipment_rate_history(equipment_id: int, history_id: int, update_data: EquipmentRateHistoryUpdate, db: Session = Depends(get_db)):
    return EquipmentService.update_equipment_rate_history(db, equipment_id, history_id, update_data.model_dump(exclude_unset=True))

@router.delete("/{equipment_id}/rate-history/{history_id}", dependencies=[Depends(require_admin)])
def delete_equipment_rate_history(equipment_id: int, history_id: int, db: Session = Depends(get_db)):
    EquipmentService.delete_equipment_rate_history(db, equipment_id, history_id)
    return {"message": "Rate history deleted successfully"}

@router.get("/{equipment_id}/ledger")
def get_equipment_ledger(equipment_id: int, db: Session = Depends(get_db)):
    return EquipmentService.get_equipment_ledger(db, equipment_id)

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