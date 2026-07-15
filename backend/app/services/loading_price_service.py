from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import date
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
            db.add(price)
            
        db.commit()
        db.refresh(price)
        return price

    @staticmethod
    def update_project_price(db: Session, price_id: int, data: ProjectLoadingPriceUpdate) -> ProjectLoadingPrice:
        price = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price:
            return None
            
        if data.vendor_id is not None:
            price.vendor_id = data.vendor_id
        if data.price_per_unit is not None:
            price.price_per_unit = data.price_per_unit
        if data.effective_date is not None:
            price.effective_date = data.effective_date
            
        db.commit()
        db.refresh(price)
        return price

    @staticmethod
    def delete_project_price(db: Session, price_id: int) -> bool:
        price = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price:
            return False
            
        db.delete(price)
        db.commit()
        return True
