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
    def get_dashboard_stats(db: Session) -> dict:
        total_ritase = db.query(SuratJalan).count()
        active_vendors = db.query(SuratJalan.vendor_id).filter(SuratJalan.vendor_id.isnot(None)).distinct().count()
        
        total_tonase = db.query(func.sum(SuratJalan.netto)).scalar() or 0.0
        total_volume = db.query(func.sum(SuratJalan.volume)).scalar() or 0.0
        
        return {
            "total_ritase": total_ritase,
            "total_tonase": float(total_tonase),
            "total_volume": float(total_volume),
            "active_vendors": active_vendors
        }

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
        """
        Recalculates hauling_price and hauling_cost for all SuratJalan records
        in a project from effective_date onward.

        Optimization: Pre-fetches all relevant ProjectHaulingPrice records in ONE
        query and performs vendor/date selection in-memory (eliminates N+1).
        """
        # 1. Fetch all affected SJs
        query = db.query(SuratJalan).filter(
            SuratJalan.project_id == project_id,
            func.date(SuratJalan.created_at) >= effective_date
        )
        if vendor_id is not None:
            query = query.filter(SuratJalan.vendor_id == vendor_id)
        sjs = query.all()

        if not sjs:
            return

        # 2. Load project to get measurement_type (tonase/kubikasi)
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return
        measurement_type = getattr(project, 'measurement_type', 'tonase')

        # 3. Determine the date range of the affected SJs
        dates = [sj.created_at.date() for sj in sjs if sj.created_at]
        max_date = max(dates) if dates else effective_date

        # 4. PRE-FETCH all relevant ProjectHaulingPrice records in ONE query (N+1 fix)
        price_filter = db.query(ProjectHaulingPrice).filter(
            ProjectHaulingPrice.project_id == project_id,
            func.date(ProjectHaulingPrice.effective_date) <= max_date
        )
        if vendor_id is not None:
            price_filter = price_filter.filter(
                or_(ProjectHaulingPrice.vendor_id == vendor_id, ProjectHaulingPrice.vendor_id.is_(None))
            )
        all_prices = price_filter.all()

        # 5. Index prices in-memory: vendor_id -> [prices sorted by effective_date desc]
        price_map: dict[int | None, list] = {}
        for p in all_prices:
            price_map.setdefault(p.vendor_id, []).append(p)
        for lst in price_map.values():
            lst.sort(key=lambda x: x.effective_date, reverse=True)

        def find_applicable_price(sj) -> ProjectHaulingPrice | None:
            """Find best matching price: vendor-specific first, then global (None)."""
            sj_date = sj.created_at.date() if sj.created_at else effective_date
            for vid in [sj.vendor_id, None]:
                candidates = price_map.get(vid, [])
                for p in candidates:
                    p_date = p.effective_date.date() if hasattr(p.effective_date, 'date') else p.effective_date
                    if p_date <= sj_date:
                        return p
            return None

        # 6. Apply prices to each SJ, cache vendors for batch balance sync
        vendor_cache: dict[int, any] = {}
        for sj in sjs:
            if not sj.vendor_id:
                continue

            applicable = find_applicable_price(sj)
            if applicable:
                price_per_unit = float(applicable.price_per_unit)
                measurement = float(sj.volume or 0) if measurement_type == 'kubikasi' else float(sj.netto or 0)

                sj.hauling_price = applicable.price_per_unit
                sj.hauling_cost = price_per_unit * measurement

                if sj.vendor_id not in vendor_cache:
                    v = db.query(Vendor).filter(Vendor.id == sj.vendor_id).first()
                    if v:
                        vendor_cache[sj.vendor_id] = v

        db.commit()

        # 7. Sync vendor balances after bulk updates (single pass per vendor)
        if vendor_cache:
            from ..services.vendor_service import VendorService
            for v in vendor_cache.values():
                VendorService._sync_vendor_balance(db, v)


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
                from .vendor_service import VendorService
                VendorService._sync_vendor_balance(db, vendor)
                
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

    @staticmethod
    def get_all_hauling_obligations(db: Session) -> List[dict]:
        # Calculate totals across all projects
        sjs = db.query(SuratJalan).filter(SuratJalan.vendor_id != None).all()
        
        vendors_data = {}
        for sj in sjs:
            vid = sj.vendor_id
            if vid not in vendors_data:
                vendor = db.query(Vendor).filter(Vendor.id == vid).first()
                if not vendor:
                    continue
                from .vendor_service import VendorService
                VendorService._sync_vendor_balance(db, vendor)
                
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

    @staticmethod
    def get_vendor_hauling_details(db: Session, vendor_id: int) -> List[dict]:
        sjs = db.query(SuratJalan).filter(SuratJalan.vendor_id == vendor_id).all()
        
        projects_data = {}
        for sj in sjs:
            if not sj.project_id:
                continue
            
            pid = sj.project_id
            if pid not in projects_data:
                project = db.query(Project).filter(Project.id == pid).first()
                if not project:
                    continue
                projects_data[pid] = {
                    "project_id": pid,
                    "project_name": project.name,
                    "total_ritase": 0,
                    "total_measurement": 0.0,
                    "total_obligation": 0.0,
                    "nopols": {}
                }
            
            nopol = sj.nopol or "Tanpa Nopol"
            if nopol not in projects_data[pid]["nopols"]:
                projects_data[pid]["nopols"][nopol] = {
                    "nopol": nopol,
                    "total_ritase": 0,
                    "total_measurement": 0.0,
                    "total_obligation": 0.0,
                    "dates": {}
                }
            
            date_str = sj.created_at.date() if sj.created_at else date.today()
            if date_str not in projects_data[pid]["nopols"][nopol]["dates"]:
                projects_data[pid]["nopols"][nopol]["dates"][date_str] = {
                    "date": date_str,
                    "ritase": 0,
                    "measurement": 0.0,
                    "obligation": 0.0
                }
            
            measurement = 0.0
            if sj.netto is not None:
                measurement = float(sj.netto)
            elif sj.volume is not None:
                measurement = float(sj.volume)
                
            cost = float(sj.hauling_cost) if sj.hauling_cost is not None else 0.0
            
            # Update date
            projects_data[pid]["nopols"][nopol]["dates"][date_str]["ritase"] += 1
            projects_data[pid]["nopols"][nopol]["dates"][date_str]["measurement"] += measurement
            projects_data[pid]["nopols"][nopol]["dates"][date_str]["obligation"] += cost
            
            # Update nopol
            projects_data[pid]["nopols"][nopol]["total_ritase"] += 1
            projects_data[pid]["nopols"][nopol]["total_measurement"] += measurement
            projects_data[pid]["nopols"][nopol]["total_obligation"] += cost
            
            # Update project
            projects_data[pid]["total_ritase"] += 1
            projects_data[pid]["total_measurement"] += measurement
            projects_data[pid]["total_obligation"] += cost
            
        # Convert nested dicts to lists
        result = []
        for pid, pdata in projects_data.items():
            nopols_list = []
            for nopol, ndata in pdata["nopols"].items():
                dates_list = list(ndata["dates"].values())
                dates_list.sort(key=lambda x: x["date"], reverse=True)
                ndata["dates"] = dates_list
                nopols_list.append(ndata)
            
            nopols_list.sort(key=lambda x: x["nopol"])
            pdata["nopols"] = nopols_list
            result.append(pdata)
            
        result.sort(key=lambda x: x["project_name"])
        return result
