from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from ..models.vendor_truck import VendorTruck
from ..models.project_hauling_price import ProjectHaulingPrice
from ..models.vendor import Vendor
from ..models.project import Project
from ..schemas.vendor_truck import VendorTruckCreate, VendorTruckUpdate
from ..schemas.project_hauling_price import ProjectHaulingPriceCreate, ProjectHaulingPriceUpdate
from ..models.user import User
from ..models.user import User
from ..models.surat_jalan import SuratJalan
from sqlalchemy import func, or_
from datetime import datetime, date

class HaulingService:
    @staticmethod
    def get_vendor_trucks(db: Session, vendor_id: int) -> List[VendorTruck]:
        return db.query(VendorTruck).filter(VendorTruck.vendor_id == vendor_id).all()

    @staticmethod
    def create_vendor_truck(db: Session, data: VendorTruckCreate) -> VendorTruck:
        vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor tidak ditemukan")
            
        truck = VendorTruck(**data.model_dump())
        db.add(truck)
        db.commit()
        db.refresh(truck)
        return truck

    @staticmethod
    def update_vendor_truck(db: Session, truck_id: int, data: VendorTruckUpdate) -> VendorTruck:
        truck = db.query(VendorTruck).filter(VendorTruck.id == truck_id).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truk tidak ditemukan")
            
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(truck, key, value)
            
        db.commit()
        db.refresh(truck)
        return truck

    @staticmethod
    def delete_vendor_truck(db: Session, truck_id: int) -> None:
        truck = db.query(VendorTruck).filter(VendorTruck.id == truck_id).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truk tidak ditemukan")
        db.delete(truck)
        db.commit()

    @staticmethod
    def get_project_prices(db: Session, project_id: int) -> List[ProjectHaulingPrice]:
        return db.query(ProjectHaulingPrice).filter(ProjectHaulingPrice.project_id == project_id).order_by(ProjectHaulingPrice.effective_date.desc()).all()

    @staticmethod
    def set_project_price(db: Session, data: ProjectHaulingPriceCreate) -> ProjectHaulingPrice:
        # Check if there is an existing price for this date and vendor (or global if vendor_id is None)
        query = db.query(ProjectHaulingPrice).filter(
            ProjectHaulingPrice.project_id == data.project_id,
            func.date(ProjectHaulingPrice.effective_date) == data.effective_date
        )
        if data.vendor_id is not None:
            query = query.filter(ProjectHaulingPrice.vendor_id == data.vendor_id)
        else:
            query = query.filter(ProjectHaulingPrice.vendor_id.is_(None))
            
        price = query.first()
        
        if price:
            price.price_per_unit = data.price_per_unit
        else:
            price = ProjectHaulingPrice(**data.model_dump())
            if not price.effective_date:
                price.effective_date = date.today()
            db.add(price)
            
        db.commit()
        db.refresh(price)
        
        # Retroactive recalculation
        HaulingService._recalculate_surat_jalan_prices(db, data.project_id, data.vendor_id, price.effective_date)
        
        return price

    @staticmethod
    def update_project_price(db: Session, price_id: int, data: ProjectHaulingPriceUpdate) -> ProjectHaulingPrice:
        price = db.query(ProjectHaulingPrice).filter(ProjectHaulingPrice.id == price_id).first()
        if not price:
            raise HTTPException(status_code=404, detail="Harga Hauling tidak ditemukan")
        
        old_effective_date = price.effective_date
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(price, key, value)
            
        db.commit()
        db.refresh(price)
        
        # Recalculate starting from the earliest of old and new effective date
        earliest_date = min(old_effective_date.date() if isinstance(old_effective_date, datetime) else old_effective_date, 
                            price.effective_date.date() if isinstance(price.effective_date, datetime) else price.effective_date)
        
        HaulingService._recalculate_surat_jalan_prices(db, price.project_id, price.vendor_id, earliest_date)
        return price

    @staticmethod
    def delete_project_price(db: Session, price_id: int):
        price = db.query(ProjectHaulingPrice).filter(ProjectHaulingPrice.id == price_id).first()
        if not price:
            raise HTTPException(status_code=404, detail="Harga Hauling tidak ditemukan")
            
        project_id = price.project_id
        vendor_id = price.vendor_id
        effective_date = price.effective_date
        
        db.delete(price)
        db.commit()
        
        # Recalculate SJs that were affected by this price
        HaulingService._recalculate_surat_jalan_prices(db, project_id, vendor_id, effective_date.date() if isinstance(effective_date, datetime) else effective_date)
        return {"message": "Harga hauling berhasil dihapus"}

    @staticmethod
    def _recalculate_surat_jalan_prices(db: Session, project_id: int, vendor_id: int | None, effective_date: date):
        # Fetch all SJ for this project & vendor after or equal to effective_date
        # If vendor_id is None (Global price), we might need to recalculate all vendors' SJ 
        # that don't have a specific vendor price overriding it.
        # For simplicity, if global, we recalculate ALL SJs for the project after the date.
        query = db.query(SuratJalan).filter(
            SuratJalan.project_id == project_id,
            func.date(SuratJalan.created_at) >= effective_date
        )
        
        if vendor_id is not None:
            # If specific vendor changed, only recalculate for that vendor
            query = query.filter(SuratJalan.vendor_id == vendor_id)
            
        sjs = query.all()

        project = db.query(Project).filter(Project.id == project_id).first()
        
        if not project:
            return

        # Pre-fetch vendors to minimize DB hits for balance updates
        vendor_dict = {}

        for sj in sjs:
            if not sj.vendor_id:
                continue
                
            # Find the applicable price for this SJ's date and vendor
            sj_date = sj.created_at.date()
            applicable_price = db.query(ProjectHaulingPrice).filter(
                ProjectHaulingPrice.project_id == project_id,
                or_(ProjectHaulingPrice.vendor_id == sj.vendor_id, ProjectHaulingPrice.vendor_id.is_(None)),
                func.date(ProjectHaulingPrice.effective_date) <= sj_date
            ).order_by(
                ProjectHaulingPrice.vendor_id.isnot(None).desc(), # Specific vendor first
                ProjectHaulingPrice.effective_date.desc()         # Then latest date
            ).first()

            if applicable_price:
                new_price = applicable_price.price_per_unit
                old_cost = float(sj.hauling_cost or 0.0)
                new_cost = 0.0
                
                if project.measurement_type == "tonase" and sj.netto is not None:
                    new_cost = float(new_price) * float(sj.netto)
                elif project.measurement_type == "kubikasi" and sj.volume is not None:
                    new_cost = float(new_price) * float(sj.volume)
                    
                cost_diff = new_cost - old_cost
                
                sj.hauling_price = new_price
                sj.hauling_cost = new_cost
                
                # Adjust vendor deposit (if cost increases, deposit decreases)
                if sj.vendor_id not in vendor_dict:
                    v = db.query(Vendor).filter(Vendor.id == sj.vendor_id).first()
                    if v:
                        vendor_dict[sj.vendor_id] = v
                
                v = vendor_dict.get(sj.vendor_id)
                if v:
                    v.balance_deposit = float(v.balance_deposit or 0) - cost_diff
                
        db.commit()

    @staticmethod
    def get_project_hauling_obligations(db: Session, project_id: int) -> List[dict]:
        # Group SJ by vendor and calculate totals
        sjs = db.query(SuratJalan).filter(SuratJalan.project_id == project_id, SuratJalan.vendor_id != None).all()
        
        vendors_data = {}
        for sj in sjs:
            vid = sj.vendor_id
            if vid not in vendors_data:
                vendor = db.query(Vendor).filter(Vendor.id == vid).first()
                if not vendor:
                    continue
                vendors_data[vid] = {
                    "vendor_id": vid,
                    "vendor_name": vendor.name,
                    "total_ritase": 0,
                    "total_measurement": 0.0,
                    "total_obligation": 0.0,
                    "balance_deposit": float(vendor.balance_deposit or 0)
                }
            
            vendors_data[vid]["total_ritase"] += 1
            if sj.netto is not None:
                vendors_data[vid]["total_measurement"] += float(sj.netto)
            elif sj.volume is not None:
                vendors_data[vid]["total_measurement"] += float(sj.volume)
                
            if sj.hauling_cost is not None:
                vendors_data[vid]["total_obligation"] += float(sj.hauling_cost)
                
        return list(vendors_data.values())
