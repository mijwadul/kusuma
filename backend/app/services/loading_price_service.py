from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import date, datetime
from typing import List, Optional

from ..models.project_loading_price import ProjectLoadingPrice
from ..models.vendor import Vendor
from ..schemas.project_loading_price import ProjectLoadingPriceCreate, ProjectLoadingPriceUpdate

class LoadingPriceService:
    @staticmethod
    def get_prices(db: Session, project_id: Optional[int] = None, vendor_id: Optional[int] = None) -> List[ProjectLoadingPrice]:
        query = db.query(ProjectLoadingPrice)
        if project_id:
            query = query.filter(ProjectLoadingPrice.project_id == project_id)
        else:
            query = query.filter(ProjectLoadingPrice.project_id.is_(None))
            
        if vendor_id:
            query = query.filter(ProjectLoadingPrice.vendor_id == vendor_id)
        else:
            query = query.filter(ProjectLoadingPrice.vendor_id.is_(None))
            
        return query.order_by(ProjectLoadingPrice.unit_type, ProjectLoadingPrice.effective_date.desc()).all()
        
    @staticmethod
    def get_all_prices(db: Session) -> List[ProjectLoadingPrice]:
        return db.query(ProjectLoadingPrice).order_by(
            ProjectLoadingPrice.project_id, 
            ProjectLoadingPrice.vendor_id, 
            ProjectLoadingPrice.unit_type, 
            ProjectLoadingPrice.effective_date.desc()
        ).all()

    @staticmethod
    def set_price(db: Session, data: ProjectLoadingPriceCreate) -> ProjectLoadingPrice:
        query = db.query(ProjectLoadingPrice).filter(
            func.date(ProjectLoadingPrice.effective_date) == data.effective_date,
            ProjectLoadingPrice.unit_type == data.unit_type
        )
        
        if data.project_id:
            query = query.filter(ProjectLoadingPrice.project_id == data.project_id)
        else:
            query = query.filter(ProjectLoadingPrice.project_id.is_(None))
            
        if data.vendor_id:
            query = query.filter(ProjectLoadingPrice.vendor_id == data.vendor_id)
        else:
            query = query.filter(ProjectLoadingPrice.vendor_id.is_(None))
            
        existing = query.first()
        
        if existing:
            existing.price = data.price
            price_record = existing
        else:
            price_record = ProjectLoadingPrice(**data.model_dump())
            if not price_record.effective_date:
                price_record.effective_date = date.today()
            db.add(price_record)
            
        db.commit()
        db.refresh(price_record)
        return price_record

    @staticmethod
    def update_price(db: Session, price_id: int, data: ProjectLoadingPriceUpdate) -> ProjectLoadingPrice:
        price_record = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price_record:
            return None
            
        if data.project_id is not None:
            price_record.project_id = data.project_id
        if data.vendor_id is not None:
            price_record.vendor_id = data.vendor_id
        if data.price is not None:
            price_record.price = data.price
        if data.unit_type is not None:
            price_record.unit_type = data.unit_type
        if data.effective_date is not None:
            price_record.effective_date = data.effective_date
            
        db.commit()
        db.refresh(price_record)
        return price_record

    @staticmethod
    def delete_price(db: Session, price_id: int) -> bool:
        price_record = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price_record:
            return False
            
        db.delete(price_record)
        db.commit()
        return True

    @staticmethod
    def calculate_loading_cost(db: Session, project_id: int, vendor_id: Optional[int], target_date: date, measurement_type: str, truck_type: Optional[str], netto: Optional[float], volume: Optional[float]):
        """
        Determines the applicable unit_type based on the given parameters.
        Then queries the hierarchy to find the price.
        Returns (loading_price, loading_cost)
        """
        # Determine possible unit_types in order of preference
        unit_types = []
        if truck_type == 'tronton':
            unit_types.append('rit_tronton')
        elif truck_type == 'colt_diesel':
            unit_types.append('rit_colt_diesel')
            
        if measurement_type == 'tonase' and netto and netto > 0:
            unit_types.append('tonase')
        elif measurement_type == 'kubikasi' and volume and volume > 0:
            unit_types.append('kubikasi')
            
        if not unit_types:
            return None, None
            
        # Fetch all possible valid prices (effective <= target_date)
        conditions = [
            func.date(ProjectLoadingPrice.effective_date) <= target_date,
            ProjectLoadingPrice.unit_type.in_(unit_types),
            or_(ProjectLoadingPrice.project_id == project_id, ProjectLoadingPrice.project_id.is_(None))
        ]
        if vendor_id:
            conditions.append(or_(ProjectLoadingPrice.vendor_id == vendor_id, ProjectLoadingPrice.vendor_id.is_(None)))
        else:
            conditions.append(ProjectLoadingPrice.vendor_id.is_(None))
            
        prices = db.query(ProjectLoadingPrice).filter(*conditions).all()
        
        if not prices:
            return None, None
        
        def sort_key(p: ProjectLoadingPrice):
            score = 0
            if p.vendor_id and p.project_id: score = 4
            elif not p.vendor_id and p.project_id: score = 3
            elif p.vendor_id and not p.project_id: score = 2
            else: score = 1
            
            unit_idx = unit_types.index(p.unit_type) if p.unit_type in unit_types else 99
            
            return (-score, unit_idx, -p.effective_date.timestamp() if isinstance(p.effective_date, datetime) else 0)
            
        best_price = sorted(prices, key=sort_key)[0]
        
        cost = 0.0
        if best_price.unit_type == 'rit_tronton' or best_price.unit_type == 'rit_colt_diesel':
            cost = float(best_price.price) * 1.0 # 1 rit
        elif best_price.unit_type == 'tonase':
            cost = float(best_price.price) * (netto or 0.0)
        elif best_price.unit_type == 'kubikasi':
            cost = float(best_price.price) * (volume or 0.0)
            
        return best_price.price, cost
