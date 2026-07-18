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

        # Retroactive recalculation for affected SJs
        eff_date = price_record.effective_date.date() if hasattr(price_record.effective_date, 'date') else price_record.effective_date
        LoadingPriceService._recalculate_sj_loading_prices(db, data.project_id, data.vendor_id, eff_date)

        return price_record

    @staticmethod
    def update_price(db: Session, price_id: int, data: ProjectLoadingPriceUpdate) -> ProjectLoadingPrice:
        price_record = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price_record:
            return None

        old_effective_date = price_record.effective_date
            
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

        # Recalculate from the earliest of old and new effective date
        new_eff = price_record.effective_date
        earliest = min(
            old_effective_date.date() if hasattr(old_effective_date, 'date') else old_effective_date,
            new_eff.date() if hasattr(new_eff, 'date') else new_eff
        )
        LoadingPriceService._recalculate_sj_loading_prices(db, price_record.project_id, price_record.vendor_id, earliest)

        return price_record

    @staticmethod
    def delete_price(db: Session, price_id: int) -> bool:
        price_record = db.query(ProjectLoadingPrice).filter(ProjectLoadingPrice.id == price_id).first()
        if not price_record:
            return False

        project_id = price_record.project_id
        vendor_id = price_record.vendor_id
        eff_date = price_record.effective_date.date() if hasattr(price_record.effective_date, 'date') else price_record.effective_date
            
        db.delete(price_record)
        db.commit()

        # Recalculate SJs that were priced using the deleted record
        LoadingPriceService._recalculate_sj_loading_prices(db, project_id, vendor_id, eff_date)

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

    @staticmethod
    def _recalculate_sj_loading_prices(db: Session, project_id: Optional[int], vendor_id: Optional[int], effective_date: date):
        """
        Retroactively recalculates loading_price and loading_cost for all SuratJalan
        records on or after effective_date for the given project/vendor scope.

        Optimization: Pre-fetches ALL relevant ProjectLoadingPrice records in ONE
        query and performs the 4-level hierarchy selection in-memory (eliminates N+1).
        """
        from ..models.surat_jalan import SuratJalan
        from ..models.project import Project

        # 1. Find all affected SJs with a loading vendor assigned
        sj_query = db.query(SuratJalan).filter(
            func.date(SuratJalan.created_at) >= effective_date,
            SuratJalan.loading_vendor_id.isnot(None)
        )
        if project_id:
            sj_query = sj_query.filter(SuratJalan.project_id == project_id)
        if vendor_id:
            sj_query = sj_query.filter(SuratJalan.loading_vendor_id == vendor_id)

        sjs = sj_query.all()
        if not sjs:
            return

        # 2. Determine date range and collect project IDs
        dates = [sj.created_at.date() for sj in sjs if sj.created_at]
        max_date = max(dates) if dates else effective_date

        project_ids = list({sj.project_id for sj in sjs if sj.project_id})
        project_map: dict[int, Project] = {}
        for p in db.query(Project).filter(Project.id.in_(project_ids)).all():
            project_map[p.id] = p

        # 3. PRE-FETCH all potentially relevant loading prices in ONE query (N+1 fix)
        price_conditions = [func.date(ProjectLoadingPrice.effective_date) <= max_date]
        if project_id:
            price_conditions.append(
                or_(ProjectLoadingPrice.project_id == project_id, ProjectLoadingPrice.project_id.is_(None))
            )
        if vendor_id:
            price_conditions.append(
                or_(ProjectLoadingPrice.vendor_id == vendor_id, ProjectLoadingPrice.vendor_id.is_(None))
            )

        all_prices = db.query(ProjectLoadingPrice).filter(*price_conditions).all()

        # 4. Apply the 4-level hierarchy in-memory for each SJ
        def get_best_price(sj, sj_date, project):
            # Determine candidate unit_types based on measurement_type and truck
            unit_types = []
            if sj.truck_type == 'tronton':
                unit_types.append('rit_tronton')
            elif sj.truck_type == 'colt_diesel':
                unit_types.append('rit_colt_diesel')
            if project.measurement_type == 'tonase' and sj.netto and sj.netto > 0:
                unit_types.append('tonase')
            elif project.measurement_type == 'kubikasi' and sj.volume and sj.volume > 0:
                unit_types.append('kubikasi')
            if not unit_types:
                return None, None

            # Filter to candidates that match this SJ's project, vendor, unit, and date
            candidates = [
                p for p in all_prices
                if p.unit_type in unit_types
                and (p.effective_date.date() if hasattr(p.effective_date, 'date') else p.effective_date) <= sj_date
                and (p.project_id == sj.project_id or p.project_id is None)
                and (p.vendor_id == sj.loading_vendor_id or p.vendor_id is None)
            ]

            if not candidates:
                return None, None

            # Sort by hierarchy score (higher = more specific) then recency
            def sort_key(p):
                score = 0
                if p.vendor_id and p.project_id: score = 4       # Vendor+Project (most specific)
                elif not p.vendor_id and p.project_id: score = 3  # Project only
                elif p.vendor_id and not p.project_id: score = 2  # Vendor only
                else: score = 1                                    # Global default
                unit_idx = unit_types.index(p.unit_type) if p.unit_type in unit_types else 99
                eff_ts = p.effective_date.timestamp() if isinstance(p.effective_date, datetime) else 0
                return (-score, unit_idx, -eff_ts)

            best = sorted(candidates, key=sort_key)[0]

            cost = 0.0
            if best.unit_type in ('rit_tronton', 'rit_colt_diesel'):
                cost = float(best.price) * 1.0
            elif best.unit_type == 'tonase':
                cost = float(best.price) * float(sj.netto or 0)
            elif best.unit_type == 'kubikasi':
                cost = float(best.price) * float(sj.volume or 0)

            return best.price, cost

        # 5. Bulk-update all SJs
        for sj in sjs:
            project = project_map.get(sj.project_id)
            if not project:
                continue
            sj_date = sj.created_at.date() if sj.created_at else effective_date
            price, cost = get_best_price(sj, sj_date, project)
            sj.loading_price = price
            sj.loading_cost = cost

        db.commit()

