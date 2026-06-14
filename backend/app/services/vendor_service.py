from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models import Vendor, VendorTopUp, Expense, User, Equipment, WorkLog
from ..core.exceptions import AuthorizationError, NotFoundError, ValidationError
from ..schemas.vendor import VendorCreate, VendorUpdate, VendorTopUpCreate
from ..services.work_log_service import WorkLogService

class VendorService:
    @staticmethod
    def _sync_vendor_balance(db: Session, vendor: Vendor):
        topups = db.query(VendorTopUp).filter(
            VendorTopUp.vendor_id == vendor.id,
            VendorTopUp.status == "approved"
        ).all()
        total_topup = sum((t.amount for t in topups), Decimal("0"))
        
        equipments = db.query(Equipment).filter(Equipment.vendor_id == vendor.id).all()
        total_rental_cost = Decimal("0")
        if equipments:
            eq_map = {e.id: e for e in equipments if e.ownership_status == "rental"}
            if eq_map:
                work_logs = db.query(WorkLog).filter(WorkLog.equipment_id.in_(eq_map.keys())).all()
                for wl in work_logs:
                    eq = eq_map[wl.equipment_id]
                    costs = WorkLogService._calculate_rental_costs(wl, eq)
                    total_rental_cost += costs["rental_cost_total"]
                    
        vendor.balance_deposit = total_topup - total_rental_cost
        db.commit()

    @staticmethod
    def _get_equipment_balance(db: Session, equipment: Equipment) -> dict:
        topups = db.query(VendorTopUp).filter(
            VendorTopUp.equipment_id == equipment.id,
            VendorTopUp.status == "approved"
        ).all()
        total_topup = sum((t.amount for t in topups), Decimal("0"))
        
        total_rental_cost = Decimal("0")
        if equipment.ownership_status == "rental":
            work_logs = db.query(WorkLog).filter(WorkLog.equipment_id == equipment.id).all()
            for wl in work_logs:
                costs = WorkLogService._calculate_rental_costs(wl, equipment)
                total_rental_cost += costs["rental_cost_total"]
        
        balance = total_topup - total_rental_cost
        return {
            "equipment_id": equipment.id,
            "equipment_name": equipment.name,
            "equipment_type": equipment.type,
            "vendor_id": equipment.vendor_id,
            "total_topup": float(total_topup),
            "total_rental_cost": float(total_rental_cost),
            "balance": float(balance),
        }

    @staticmethod
    def _enrich_topup(topup: VendorTopUp, db: Session) -> dict:
        data = {
            "id": topup.id,
            "vendor_id": topup.vendor_id,
            "equipment_id": topup.equipment_id,
            "equipment_name": None,
            "amount": topup.amount,
            "topup_date": topup.topup_date,
            "notes": topup.notes,
            "status": topup.status,
            "created_by": topup.created_by,
            "approved_by": topup.approved_by,
            "approved_at": topup.approved_at,
            "project_id": topup.project_id,
        }
        if topup.equipment_id:
            eq = db.query(Equipment).filter(Equipment.id == topup.equipment_id).first()
            if eq:
                data["equipment_name"] = eq.name
        return data

    @staticmethod
    def _apply_topup_and_expense(db: Session, topup: VendorTopUp, vendor: Vendor, equipment: Optional[Equipment], user_id: int):
        expense_dt = topup.topup_date.date() if topup.topup_date else datetime.now().date()
        
        eq_label = f" - {equipment.name}" if equipment else ""
        expense = Expense(
            category="deposit",
            description=f"[TopUp #{topup.id}] Deposit Alat - {vendor.name}{eq_label}: {topup.notes or ''}",
            amount=float(topup.amount),
            expense_date=expense_dt,
            created_by=user_id,
            approval_status="approved",
            approved_by=user_id,
            approved_at=datetime.now(),
            payment_status="paid",
            paid_by=user_id,
            paid_at=datetime.now(),
            project_id=topup.project_id
        )
        db.add(expense)
        db.commit()
        db.refresh(topup)

    @staticmethod
    def get_vendors(db: Session, vendor_type: Optional[str] = None) -> List[Vendor]:
        query = db.query(Vendor).filter(Vendor.status != "deleted")
        if vendor_type:
            query = query.filter(Vendor.vendor_type == vendor_type)
        vendors = query.order_by(Vendor.name).all()
        
        for v in vendors:
            VendorService._sync_vendor_balance(db, v)
        return vendors

    @staticmethod
    def get_vendor(db: Session, vendor_id: int) -> Vendor:
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise NotFoundError("Vendor not found")
        VendorService._sync_vendor_balance(db, vendor)
        return vendor

    @staticmethod
    def create_vendor(db: Session, current_user: User, data: VendorCreate) -> Vendor:
        db_vendor = Vendor(**data.model_dump())
        db.add(db_vendor)
        db.commit()
        db.refresh(db_vendor)
        return db_vendor

    @staticmethod
    def update_vendor(db: Session, current_user: User, vendor_id: int, data: VendorUpdate) -> Vendor:
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise NotFoundError("Vendor not found")
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(vendor, key, value)
            
        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def delete_vendor(db: Session, current_user: User, vendor_id: int) -> None:
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise NotFoundError("Vendor not found")
            
        vendor.status = "deleted"
        db.commit()

    @staticmethod
    def get_equipment_balances(db: Session, vendor_id: int) -> List[dict]:
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise NotFoundError("Vendor not found")
        
        equipments = db.query(Equipment).filter(
            Equipment.vendor_id == vendor_id,
            Equipment.ownership_status == "rental"
        ).order_by(Equipment.name).all()
        
        result = []
        for eq in equipments:
            result.append(VendorService._get_equipment_balance(db, eq))
        
        return result

    @staticmethod
    def get_all_equipment_balances(db: Session) -> List[dict]:
        equipments = db.query(Equipment).filter(
            Equipment.vendor_id != None,
            Equipment.ownership_status == "rental"
        ).order_by(Equipment.name).all()
        
        result = []
        for eq in equipments:
            balance_data = VendorService._get_equipment_balance(db, eq)
            vendor = db.query(Vendor).filter(Vendor.id == eq.vendor_id).first()
            balance_data["vendor_name"] = vendor.name if vendor else "-"
            result.append(balance_data)
        
        return result

    @staticmethod
    def get_vendor_topups(db: Session, vendor_id: int) -> List[dict]:
        topups = db.query(VendorTopUp).filter(VendorTopUp.vendor_id == vendor_id).order_by(VendorTopUp.topup_date.desc()).all()
        return [VendorService._enrich_topup(t, db) for t in topups]

    @staticmethod
    def get_all_topups(db: Session) -> List[dict]:
        topups = db.query(VendorTopUp).order_by(VendorTopUp.topup_date.desc()).all()
        return [VendorService._enrich_topup(t, db) for t in topups]

    @staticmethod
    def create_topup(db: Session, current_user: User, data: VendorTopUpCreate) -> dict:
        vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
        if not vendor:
            raise NotFoundError("Vendor not found")
        
        equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
        if not equipment:
            raise NotFoundError("Alat berat tidak ditemukan")
        if equipment.vendor_id != data.vendor_id:
            raise ValidationError("Alat berat ini bukan milik vendor yang dipilih")
            
        is_gm = current_user.role in ["gm", "admin"] or getattr(current_user, 'is_admin', False) or getattr(current_user, 'is_superuser', False)
        
        topup_dt = data.topup_date if data.topup_date else datetime.now()
        
        topup = VendorTopUp(
            vendor_id=data.vendor_id,
            equipment_id=data.equipment_id,
            amount=data.amount,
            notes=data.notes,
            project_id=data.project_id,
            topup_date=topup_dt,
            status="approved" if is_gm else "pending",
            created_by=current_user.id,
            approved_by=current_user.id if is_gm else None,
            approved_at=datetime.now() if is_gm else None
        )
        db.add(topup)
        db.commit()
        db.refresh(topup)
        
        if is_gm:
            VendorService._apply_topup_and_expense(db, topup, vendor, equipment, current_user.id)
            
        return VendorService._enrich_topup(topup, db)

    @staticmethod
    def approve_topup(db: Session, current_user: User, topup_id: int, status: str = "approved") -> dict:
        topup = db.query(VendorTopUp).filter(VendorTopUp.id == topup_id).first()
        if not topup:
            raise NotFoundError("TopUp not found")
            
        if topup.status != "pending":
            raise ValidationError("TopUp already processed")
            
        topup.status = status
        topup.approved_by = current_user.id
        topup.approved_at = datetime.now()
        
        vendor = db.query(Vendor).filter(Vendor.id == topup.vendor_id).first()
        equipment = db.query(Equipment).filter(Equipment.id == topup.equipment_id).first() if topup.equipment_id else None
        
        if status == "approved":
            VendorService._apply_topup_and_expense(db, topup, vendor, equipment, current_user.id)
        else:
            db.commit()
            db.refresh(topup)
            
        return VendorService._enrich_topup(topup, db)

    @staticmethod
    def edit_topup(db: Session, current_user: User, topup_id: int, data: VendorTopUpCreate) -> dict:
        topup = db.query(VendorTopUp).filter(VendorTopUp.id == topup_id).first()
        if not topup:
            raise NotFoundError("TopUp not found")

        vendor = db.query(Vendor).filter(Vendor.id == topup.vendor_id).first()

        old_equipment = db.query(Equipment).filter(Equipment.id == topup.equipment_id).first() if topup.equipment_id else None
        old_amount = float(topup.amount)
        old_date = topup.topup_date.date() if topup.topup_date else datetime.now().date()

        if data.equipment_id:
            equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
            if not equipment:
                raise NotFoundError("Alat berat tidak ditemukan")
            if equipment.vendor_id != data.vendor_id:
                raise ValidationError("Alat berat ini bukan milik vendor yang dipilih")
            topup.equipment_id = data.equipment_id
        else:
            equipment = old_equipment

        topup.amount = data.amount
        topup.notes = data.notes
        topup.project_id = data.project_id
        if data.topup_date:
            topup.topup_date = data.topup_date

        expense = db.query(Expense).filter(
            Expense.category == "deposit"
        ).filter(
            or_(
                Expense.description.like(f"[TopUp #{topup.id}]%"),
                and_(
                    Expense.amount == old_amount,
                    Expense.expense_date == old_date,
                    Expense.description.like(f"Deposit Alat - {vendor.name}%")
                )
            )
        ).first()

        if expense:
            expense.amount = float(data.amount)
            expense.project_id = data.project_id
            if data.topup_date:
                expense.expense_date = data.topup_date.date()
            new_eq_label = f" - {equipment.name}" if equipment else ""
            expense.description = f"[TopUp #{topup.id}] Deposit Alat - {vendor.name}{new_eq_label}: {data.notes or ''}"

        db.commit()
        db.refresh(topup)
        return VendorService._enrich_topup(topup, db)

    @staticmethod
    def delete_topup(db: Session, current_user: User, topup_id: int) -> None:
        topup = db.query(VendorTopUp).filter(VendorTopUp.id == topup_id).first()
        if not topup:
            raise NotFoundError("TopUp not found")

        vendor = db.query(Vendor).filter(Vendor.id == topup.vendor_id).first()
        old_amount = float(topup.amount)
        old_date = topup.topup_date.date() if topup.topup_date else datetime.now().date()

        expense = db.query(Expense).filter(
            Expense.category == "deposit"
        ).filter(
            or_(
                Expense.description.like(f"[TopUp #{topup.id}]%"),
                and_(
                    Expense.amount == old_amount,
                    Expense.expense_date == old_date,
                    Expense.description.like(f"Deposit Alat - {vendor.name}%")
                )
            )
        ).first()

        if expense:
            db.delete(expense)

        db.delete(topup)
        db.commit()
