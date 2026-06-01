from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from ...core.database import get_db
from ...core.auth import get_current_user, require_role
from ...models.user import User
from ...schemas.work_log import (
    WorkLog as WorkLogSchema, 
    WorkLogCreate, 
    WorkLogUpdate,
    WorkLogWithEquipment,
    WorkLogStats
)
from ...services.work_log_service import WorkLogService

router = APIRouter(dependencies=[Depends(get_current_user)])

# Backward compatibility
def _calculate_rental_costs(work_log, equipment):
    return WorkLogService._calculate_rental_costs(work_log, equipment)

@router.get("", response_model=List[WorkLogWithEquipment])
def get_work_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    equipment_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    input_method: Optional[str] = Query(None, pattern="^(HM|MANUAL)$"),
    db: Session = Depends(get_db)
):
    return WorkLogService.get_work_logs(db, skip, limit, equipment_id, start_date, end_date, input_method)

@router.get("/stats/summary", response_model=WorkLogStats)
def get_work_log_stats(
    equipment_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    return WorkLogService.get_work_log_stats(db, equipment_id, start_date, end_date)

@router.get("/{work_log_id}", response_model=WorkLogWithEquipment)
def get_work_log(work_log_id: int, db: Session = Depends(get_db)):
    return WorkLogService.get_work_log(db, work_log_id)

@router.post("", response_model=WorkLogSchema)
def create_work_log(work_log: WorkLogCreate, db: Session = Depends(get_db), current_user: User = Depends(require_role(["field", "helper", "finance", "checker"]))):
    return WorkLogService.create_work_log(db, current_user, work_log)

@router.put("/{work_log_id}", response_model=WorkLogSchema)
def update_work_log(
    work_log_id: int, 
    work_log_update: WorkLogUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"]))
):
    return WorkLogService.update_work_log(db, current_user, work_log_id, work_log_update)

@router.delete("/{work_log_id}")
def delete_work_log(work_log_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["finance", "checker"]))):
    WorkLogService.delete_work_log(db, current_user, work_log_id)
    return {"message": "Work log deleted successfully"}
