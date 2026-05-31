from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...core.database import get_db
from ...core.auth import get_current_user, require_admin
from ...models import Equipment, User
from ...schemas.equipment import Equipment as EquipmentSchema, EquipmentCreate, EquipmentUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[EquipmentSchema])
def get_equipment(db: Session = Depends(get_db)):
    equipment = db.query(Equipment).all()
    return equipment

@router.get("/{equipment_id}", response_model=EquipmentSchema)
def get_equipment_by_id(equipment_id: int, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment

@router.post("", response_model=EquipmentSchema, dependencies=[Depends(require_admin)])
def create_equipment(equipment: EquipmentCreate, db: Session = Depends(get_db)):
    db_equipment = Equipment(**equipment.model_dump())
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment

@router.put("/{equipment_id}", response_model=EquipmentSchema, dependencies=[Depends(require_admin)])
def update_equipment(equipment_id: int, equipment_update: EquipmentUpdate, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    for key, value in equipment_update.model_dump(exclude_unset=True).items():
        setattr(equipment, key, value)
    
    db.commit()
    db.refresh(equipment)
    return equipment

@router.delete("/{equipment_id}", dependencies=[Depends(require_admin)])
def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    db.delete(equipment)
    db.commit()
    return {"message": "Equipment deleted successfully"}