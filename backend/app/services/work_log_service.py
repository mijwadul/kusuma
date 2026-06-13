from datetime import date
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import WorkLog, Equipment, User, Vendor
from ..core.exceptions import NotFoundError
from ..schemas.work_log import (
    WorkLogCreate, 
    WorkLogUpdate,
    WorkLogWithEquipment,
    WorkLogStats
)

class WorkLogService:
    @staticmethod
    def _calculate_rental_costs(work_log: WorkLog, equipment: Equipment) -> dict:
        hours = Decimal(str(work_log.total_hours or 0))
        discount_hours = Decimal(str(work_log.rental_discount_hours or 0))

        if discount_hours < 0:
            discount_hours = Decimal("0")
        if discount_hours > hours:
            discount_hours = hours

        billable_hours = hours - discount_hours

        if getattr(work_log, 'total_cost', None) is not None:
            rate = Decimal(str(work_log.applied_rate or 0))
            total_cost = Decimal(str(work_log.total_cost))
            return {
                "rental_rate_per_hour": rate,
                "rental_billable_hours": billable_hours,
                "rental_cost_before_discount": total_cost + (discount_hours * rate),
                "rental_discount_amount": discount_hours * rate,
                "rental_cost_total": total_cost,
                "split_details": getattr(work_log, 'split_details', None)
            }

        # Legacy calculation for old records
        rate = Decimal(str(equipment.rental_rate_per_hour or 0))
        if (equipment.ownership_status or "internal") != "rental":
            rate = Decimal("0")

        gross_cost = hours * rate
        discount_amount = discount_hours * rate
        total_cost = gross_cost - discount_amount

        return {
            "rental_rate_per_hour": rate,
            "rental_billable_hours": billable_hours,
            "rental_cost_before_discount": gross_cost,
            "rental_discount_amount": discount_amount,
            "rental_cost_total": total_cost,
            "split_details": None
        }

    @staticmethod
    def get_work_logs(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        equipment_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        input_method: Optional[str] = None
    ) -> List[WorkLogWithEquipment]:
        query = db.query(WorkLog, Equipment).join(Equipment, WorkLog.equipment_id == Equipment.id)
        
        if equipment_id:
            query = query.filter(WorkLog.equipment_id == equipment_id)
        
        if start_date:
            query = query.filter(WorkLog.work_date >= start_date)
        
        if end_date:
            query = query.filter(WorkLog.work_date <= end_date)
        
        if input_method:
            query = query.filter(WorkLog.input_method == input_method)
        
        query = query.order_by(WorkLog.work_date.desc())
        
        work_logs = query.offset(skip).limit(limit).all()
        
        result = []
        for work_log, equipment in work_logs:
            work_dict = {
                **work_log.__dict__,
                'equipment_name': equipment.name,
                'equipment_type': equipment.type,
                'equipment_location': equipment.location,
                **WorkLogService._calculate_rental_costs(work_log, equipment),
            }
            result.append(WorkLogWithEquipment(**work_dict))
        
        return result

    @staticmethod
    def get_work_log(db: Session, work_log_id: int) -> WorkLogWithEquipment:
        work_log = db.query(WorkLog, Equipment).join(Equipment, WorkLog.equipment_id == Equipment.id).filter(WorkLog.id == work_log_id).first()
        
        if not work_log:
            raise NotFoundError("Work log not found")
        
        work_log_data, equipment = work_log
        work_dict = {
            **work_log_data.__dict__,
            'equipment_name': equipment.name,
            'equipment_type': equipment.type,
            'equipment_location': equipment.location,
            **WorkLogService._calculate_rental_costs(work_log_data, equipment),
        }
        
        return WorkLogWithEquipment(**work_dict)

    @staticmethod
    def create_work_log(db: Session, current_user: User, data: WorkLogCreate) -> WorkLog:
        equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
        if not equipment:
            raise NotFoundError("Equipment not found")
        
        total_hours = data.total_hours
        if data.input_method == "HM" and data.hm_start and data.hm_end:
            total_hours = float(data.hm_end - data.hm_start)
        
        discount_hours = Decimal(str(data.rental_discount_hours or 0))
        if discount_hours < 0:
            discount_hours = Decimal("0")
        if discount_hours > Decimal(str(total_hours or 0)):
            discount_hours = Decimal(str(total_hours or 0))

        hours_to_bill = Decimal(str(total_hours or 0)) - discount_hours
        total_cost = Decimal("0")
        applied_rate = equipment.rental_rate_per_hour
        split_details = None

        if (equipment.ownership_status or "internal") == "rental":
            pending_rate = getattr(equipment, 'pending_rental_rate_per_hour', None)
            locked_balance = getattr(equipment, 'locked_balance_for_pending_rate', None)
            pending_effective_date = getattr(equipment, 'pending_rate_effective_date', None)
            
            # Check date trigger first
            if pending_rate is not None and pending_effective_date is not None and data.work_date >= pending_effective_date:
                applied_rate = Decimal(str(pending_rate))
                total_cost = hours_to_bill * applied_rate
                
                equipment.rental_rate_per_hour = pending_rate
                equipment.pending_rental_rate_per_hour = None
                equipment.pending_rate_effective_date = None
                
                from ..models import EquipmentRateHistory
                import datetime
                history = db.query(EquipmentRateHistory).filter(
                    EquipmentRateHistory.equipment_id == equipment.id,
                    EquipmentRateHistory.status == "pending"
                ).order_by(EquipmentRateHistory.id.desc()).first()
                if history:
                    history.status = "applied"
                    history.applied_at = datetime.datetime.now()
            
            # If no date trigger, check deposit trigger
            elif pending_rate is not None and locked_balance is not None and locked_balance > 0:
                old_rate = Decimal(str(equipment.rental_rate_per_hour or 0))
                new_rate = Decimal(str(pending_rate))
                
                max_hours_old = locked_balance / old_rate if old_rate > 0 else Decimal("0")

                if hours_to_bill <= max_hours_old:
                    total_cost = hours_to_bill * old_rate
                    equipment.locked_balance_for_pending_rate -= total_cost
                    applied_rate = old_rate
                else:
                    cost_old = max_hours_old * old_rate
                    remaining_hours = hours_to_bill - max_hours_old
                    cost_new = remaining_hours * new_rate
                    
                    total_cost = cost_old + cost_new
                    applied_rate = new_rate
                    split_details = f"{max_hours_old:.2f} jam x Rp {old_rate:,.0f}, {remaining_hours:.2f} jam x Rp {new_rate:,.0f}"
                    
                    equipment.rental_rate_per_hour = new_rate
                    equipment.pending_rental_rate_per_hour = None
                    equipment.locked_balance_for_pending_rate = Decimal("0")
                    
                    from ..models import EquipmentRateHistory
                    import datetime
                    history = db.query(EquipmentRateHistory).filter(
                        EquipmentRateHistory.equipment_id == equipment.id,
                        EquipmentRateHistory.status == "pending"
                    ).order_by(EquipmentRateHistory.id.desc()).first()
                    if history:
                        history.status = "applied"
                        history.applied_at = datetime.datetime.now()
            else:
                total_cost = hours_to_bill * Decimal(str(equipment.rental_rate_per_hour or 0))
                applied_rate = Decimal(str(equipment.rental_rate_per_hour or 0))

        db_work_log = WorkLog(
            equipment_id=data.equipment_id,
            input_method=data.input_method,
            hm_start=data.hm_start,
            hm_end=data.hm_end,
            total_hours=total_hours,
            rental_discount_hours=discount_hours,
            project_id=data.project_id,
            operator_name=data.operator_name,
            work_description=data.work_description,
            work_date=data.work_date,
            applied_rate=applied_rate,
            total_cost=total_cost,
            split_details=split_details
        )
        
        db.add(db_work_log)
        db.commit()
        db.refresh(db_work_log)
        
        return db_work_log

    @staticmethod
    def update_work_log(db: Session, current_user: User, work_log_id: int, data: WorkLogUpdate) -> WorkLog:
        work_log = db.query(WorkLog).filter(WorkLog.id == work_log_id).first()
        
        if not work_log:
            raise NotFoundError("Work log not found")
        
        update_data = data.model_dump(exclude_unset=True)
        
        if data.input_method == "HM" and data.hm_start and data.hm_end:
            update_data['total_hours'] = float(data.hm_end - data.hm_start)

        if "rental_discount_hours" in update_data and update_data["rental_discount_hours"] is not None:
            discount_hours = Decimal(str(update_data["rental_discount_hours"]))
            if discount_hours < 0:
                discount_hours = Decimal("0")
            hours_for_cap = Decimal(str(update_data.get("total_hours", work_log.total_hours) or 0))
            if discount_hours > hours_for_cap:
                discount_hours = hours_for_cap
            update_data["rental_discount_hours"] = discount_hours
        
        for key, value in update_data.items():
            setattr(work_log, key, value)
            
        db.commit()
        db.refresh(work_log)
        
        return work_log

    @staticmethod
    def delete_work_log(db: Session, current_user: User, work_log_id: int) -> None:
        work_log = db.query(WorkLog).filter(WorkLog.id == work_log_id).first()
        
        if not work_log:
            raise NotFoundError("Work log not found")
            
        equipment = db.query(Equipment).filter(Equipment.id == work_log.equipment_id).first()
        if equipment and equipment.ownership_status == "rental" and equipment.vendor_id:
            vendor = db.query(Vendor).filter(Vendor.id == equipment.vendor_id).first()
            if vendor:
                costs = WorkLogService._calculate_rental_costs(work_log, equipment)
                vendor.balance_deposit = Decimal(str(vendor.balance_deposit or 0)) + costs["rental_cost_total"]
        
        db.delete(work_log)
        db.commit()

    @staticmethod
    def get_work_log_stats(
        db: Session,
        equipment_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> WorkLogStats:
        base_query = db.query(WorkLog)
        
        if equipment_id:
            base_query = base_query.filter(WorkLog.equipment_id == equipment_id)
        
        if start_date:
            base_query = base_query.filter(WorkLog.work_date >= start_date)
        
        if end_date:
            base_query = base_query.filter(WorkLog.work_date <= end_date)
        
        total_hours_result = base_query.with_entities(func.sum(WorkLog.total_hours)).scalar()
        total_hours = float(total_hours_result) if total_hours_result else 0
        
        total_days = base_query.count()
        avg_hours = total_hours / total_days if total_days > 0 else 0
        
        hm_active_count = base_query.filter(WorkLog.input_method == "HM").count()
        manual_count = base_query.filter(WorkLog.input_method == "MANUAL").count()
        
        equipment_count = base_query.with_entities(WorkLog.equipment_id).distinct().count()
        
        return WorkLogStats(
            total_hours_worked=total_hours,
            total_work_days=total_days,
            avg_hours_per_day=avg_hours,
            equipment_count=equipment_count,
            hm_active_count=hm_active_count,
            manual_count=manual_count
        )
