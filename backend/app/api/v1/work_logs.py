from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, date, timedelta

from ...core.database import get_db
from ...core.auth import get_current_user
from ...models import WorkLog, Equipment, User, Vendor
from ...schemas.work_log import (
    WorkLog as WorkLogSchema, 
    WorkLogCreate, 
    WorkLogUpdate,
    WorkLogWithEquipment,
    WorkLogWithProject,
    WorkLogStats
)

router = APIRouter(dependencies=[Depends(get_current_user)])


def _calculate_rental_costs(work_log: WorkLog, equipment: Equipment) -> dict:
    rate = Decimal(str(equipment.rental_rate_per_hour or 0))
    hours = Decimal(str(work_log.total_hours or 0))
    discount_hours = Decimal(str(work_log.rental_discount_hours or 0))

    if discount_hours < 0:
        discount_hours = Decimal("0")
    if discount_hours > hours:
        discount_hours = hours

    if (equipment.ownership_status or "internal") != "rental":
        rate = Decimal("0")

    gross_cost = hours * rate
    billable_hours = hours - discount_hours
    discount_amount = discount_hours * rate
    total_cost = gross_cost - discount_amount

    return {
        "rental_rate_per_hour": rate,
        "rental_billable_hours": billable_hours,
        "rental_cost_before_discount": gross_cost,
        "rental_discount_amount": discount_amount,
        "rental_cost_total": total_cost,
    }

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
    """Get work logs with optional filtering"""
    query = db.query(WorkLog, Equipment).join(Equipment, WorkLog.equipment_id == Equipment.id)
    
    if equipment_id:
        query = query.filter(WorkLog.equipment_id == equipment_id)
    
    if start_date:
        query = query.filter(WorkLog.work_date >= start_date)
    
    if end_date:
        query = query.filter(WorkLog.work_date <= end_date)
    
    if input_method:
        query = query.filter(WorkLog.input_method == input_method)
    
    # Order by date descending
    query = query.order_by(WorkLog.work_date.desc())
    
    work_logs = query.offset(skip).limit(limit).all()
    
    # Convert to response format
    result = []
    for work_log, equipment in work_logs:
        work_dict = {
            **work_log.__dict__,
            'equipment_name': equipment.name,
            'equipment_type': equipment.type,
            'equipment_location': equipment.location,
            **_calculate_rental_costs(work_log, equipment),
        }
        result.append(WorkLogWithEquipment(**work_dict))
    
    return result

@router.get("/{work_log_id}", response_model=WorkLogWithEquipment)
def get_work_log(work_log_id: int, db: Session = Depends(get_db)):
    """Get specific work log by ID"""
    work_log = db.query(WorkLog, Equipment).join(Equipment, WorkLog.equipment_id == Equipment.id).filter(WorkLog.id == work_log_id).first()
    
    if not work_log:
        raise HTTPException(status_code=404, detail="Work log not found")
    
    work_log_data, equipment = work_log
    work_dict = {
        **work_log_data.__dict__,
        'equipment_name': equipment.name,
        'equipment_type': equipment.type,
        'equipment_location': equipment.location,
        **_calculate_rental_costs(work_log_data, equipment),
    }
    
    return WorkLogWithEquipment(**work_dict)

@router.post("", response_model=WorkLogSchema)
def create_work_log(work_log: WorkLogCreate, db: Session = Depends(get_db)):
    """Create new work log"""
    
    # Validate equipment exists
    equipment = db.query(Equipment).filter(Equipment.id == work_log.equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    # Auto-calculate total_hours if input_method is HM
    total_hours = work_log.total_hours
    if work_log.input_method == "HM" and work_log.hm_start and work_log.hm_end:
        total_hours = float(work_log.hm_end - work_log.hm_start)
    
    discount_hours = Decimal(str(work_log.rental_discount_hours or 0))
    if discount_hours < 0:
        discount_hours = Decimal("0")
    if discount_hours > Decimal(str(total_hours or 0)):
        discount_hours = Decimal(str(total_hours or 0))

    # Create work log
    db_work_log = WorkLog(
        equipment_id=work_log.equipment_id,
        input_method=work_log.input_method,
        hm_start=work_log.hm_start,
        hm_end=work_log.hm_end,
        total_hours=total_hours,
        rental_discount_hours=discount_hours,
        project_id=work_log.project_id,
        operator_name=work_log.operator_name,
        work_description=work_log.work_description,
        work_date=work_log.work_date
    )
    
    db.add(db_work_log)
    
    # Vendor deposit is now dynamically calculated when fetching vendors.

    db.commit()
    db.refresh(db_work_log)
    
    return db_work_log

@router.put("/{work_log_id}", response_model=WorkLogSchema)
def update_work_log(
    work_log_id: int, 
    work_log_update: WorkLogUpdate, 
    db: Session = Depends(get_db)
):
    """Update work log"""
    work_log = db.query(WorkLog).filter(WorkLog.id == work_log_id).first()
    
    if not work_log:
        raise HTTPException(status_code=404, detail="Work log not found")
    
    # Update fields
    update_data = work_log_update.model_dump(exclude_unset=True)
    
    # Auto-calculate total_hours if HM method
    if work_log_update.input_method == "HM" and work_log_update.hm_start and work_log_update.hm_end:
        update_data['total_hours'] = float(work_log_update.hm_end - work_log_update.hm_start)

    if "rental_discount_hours" in update_data and update_data["rental_discount_hours"] is not None:
        discount_hours = Decimal(str(update_data["rental_discount_hours"]))
        if discount_hours < 0:
            discount_hours = Decimal("0")
        hours_for_cap = Decimal(str(update_data.get("total_hours", work_log.total_hours) or 0))
        if discount_hours > hours_for_cap:
            discount_hours = hours_for_cap
        update_data["rental_discount_hours"] = discount_hours
    
    # Vendor deposit is now dynamically calculated when fetching vendors.
    
    for key, value in update_data.items():
        setattr(work_log, key, value)
        
    db.commit()
    db.refresh(work_log)
    
    return work_log

@router.delete("/{work_log_id}")
def delete_work_log(work_log_id: int, db: Session = Depends(get_db)):
    """Delete work log"""
    work_log = db.query(WorkLog).filter(WorkLog.id == work_log_id).first()
    
    if not work_log:
        raise HTTPException(status_code=404, detail="Work log not found")
        
    equipment = db.query(Equipment).filter(Equipment.id == work_log.equipment_id).first()
    if equipment and equipment.ownership_status == "rental" and equipment.vendor_id:
        vendor = db.query(Vendor).filter(Vendor.id == equipment.vendor_id).first()
        if vendor:
            costs = _calculate_rental_costs(work_log, equipment)
            vendor.balance_deposit = Decimal(str(vendor.balance_deposit or 0)) + costs["rental_cost_total"]
    
    db.delete(work_log)
    db.commit()
    
    return {"message": "Work log deleted successfully"}

@router.get("/stats/summary", response_model=WorkLogStats)
def get_work_log_stats(
    equipment_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Get work log statistics"""
    base_query = db.query(WorkLog)
    
    if equipment_id:
        base_query = base_query.filter(WorkLog.equipment_id == equipment_id)
    
    if start_date:
        base_query = base_query.filter(WorkLog.work_date >= start_date)
    
    if end_date:
        base_query = base_query.filter(WorkLog.work_date <= end_date)
    
    # Get stats
    total_hours_result = base_query.with_entities(func.sum(WorkLog.total_hours)).scalar()
    total_hours = float(total_hours_result) if total_hours_result else 0
    
    total_days = base_query.count()
    avg_hours = total_hours / total_days if total_days > 0 else 0
    
    hm_active_count = base_query.filter(WorkLog.input_method == "HM").count()
    manual_count = base_query.filter(WorkLog.input_method == "MANUAL").count()
    
    # Count unique equipment
    equipment_count = base_query.with_entities(WorkLog.equipment_id).distinct().count()
    
    return WorkLogStats(
        total_hours_worked=total_hours,
        total_work_days=total_days,
        avg_hours_per_day=avg_hours,
        equipment_count=equipment_count,
        hm_active_count=hm_active_count,
        manual_count=manual_count
    )
