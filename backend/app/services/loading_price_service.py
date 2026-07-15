from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import date, datetime
from typing import List

from ..models.project_loading_price import ProjectLoadingPrice
from ..models.vendor import Vendor
from ..schemas.project_loading_price import ProjectLoadingPriceCreate, ProjectLoadingPriceUpdate

class LoadingPriceService:
    @staticmethod
    def get_project_prices(db: Session, project_id: int) -> List[ProjectLoadingPrice]:
        return db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.project_id == project_id).order_by(ProjectLoadingPrice.effective_date.desc()).all()

    @staticmethod
    def set_project_price(db: Session, data: ProjectLoadingPriceCreate) -> ProjectLoadingPrice:
        query = db.query(ProjectLoadingPrice).filter(
            ProjectLoadingPrice.project_id == data.project_id,
            func.date(ProjectLoadingPrice.effective_date) == data.effective_date
        )
        if data.vendor_id:
            query = query.filter(ProjectLoadingPrice.vendor_id == data.vendor_id)
        else:
            query = query.filter(ProjectLoadingPrice.vendor_id.is_(None))
            
        existing = query.first()
        
        if existing:
            existing.price_per_unit = data.price_per_unit
            price = existing
        else:
            price = ProjectLoadingPrice(**data.model_dump())
            if not price.effective_date:
                price.effective_date = date.today()
            db.add(price)
            
        db.commit()
        db.refresh(price)
        
        # Retroactive recalculation
        LoadingPriceService._recalculate_surat_jalan_prices(db, data.project_id, data.vendor_id, price.effective_date)
        
        return price

    @staticmethod
    def update_project_price(db: Session, price_id: int, data: ProjectLoadingPriceUpdate) -> ProjectLoadingPrice:
        price = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price:
            return None
            
        old_effective_date = price.effective_date
        
        if data.vendor_id is not None:
            price.vendor_id = data.vendor_id
        if data.price_per_unit is not None:
            price.price_per_unit = data.price_per_unit
        if data.effective_date is not None:
            price.effective_date = data.effective_date
            
        db.commit()
        db.refresh(price)
        
        earliest_date = min(
            old_effective_date.date() if isinstance(old_effective_date, datetime) else old_effective_date,
            price.effective_date.date() if isinstance(price.effective_date, datetime) else price.effective_date
        )
        
        LoadingPriceService._recalculate_surat_jalan_prices(db, price.project_id, price.vendor_id, earliest_date)
        
        return price

    @staticmethod
    def delete_project_price(db: Session, price_id: int) -> bool:
        price = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price:
            return False
            
        project_id = price.project_id
        vendor_id = price.vendor_id
        effective_date = price.effective_date
        
        db.delete(price)
        db.commit()
        
        LoadingPriceService._recalculate_surat_jalan_prices(db, project_id, vendor_id, effective_date.date() if isinstance(effective_date, datetime) else effective_date)
        
        return True

    @staticmethod
    def _recalculate_surat_jalan_prices(db: Session, project_id: int, vendor_id: int | None, effective_date: date):
        from ..models.surat_jalan import SuratJalan
        
        sjs = db.query(SuratJalan).filter(
            SuratJalan.project_id == project_id,
            func.date(SuratJalan.created_at) >= effective_date
        ).all()
        
        for sj in sjs:
            sj_date = sj.created_at.date() if isinstance(sj.created_at, datetime) else sj.created_at
            
            target_vendor_id = sj.loading_vendor_id or vendor_id
            
            l_price_record = db.query(ProjectLoadingPrice).filter(
                ProjectLoadingPrice.project_id == project_id,
                func.date(ProjectLoadingPrice.effective_date) <= sj_date
            )
            
            # 1. Try vendor specific price
            if target_vendor_id:
                vendor_price_record = l_price_record.filter(ProjectLoadingPrice.vendor_id == target_vendor_id).order_by(ProjectLoadingPrice.effective_date.desc()).first()
                if vendor_price_record:
                    sj.loading_vendor_id = target_vendor_id
                    sj.loading_price = vendor_price_record.price_per_unit
                    sj.loading_cost = float(vendor_price_record.price_per_unit) * 1.0
                    continue
                    
            # 2. Try global price
            global_price_record = l_price_record.filter(ProjectLoadingPrice.vendor_id.is_(None)).order_by(ProjectLoadingPrice.effective_date.desc()).first()
            if global_price_record:
                sj.loading_vendor_id = target_vendor_id
                sj.loading_price = global_price_record.price_per_unit
                sj.loading_cost = float(global_price_record.price_per_unit) * 1.0
                continue
                
            # If no price applies, clear it out (in case it was deleted)
            if not target_vendor_id or (not vendor_price_record and not global_price_record):
                # Wait, we only clear it if we are sure there is no price
                sj.loading_price = None
                sj.loading_cost = None
                
        db.commit()
