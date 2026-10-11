from datetime import date, datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..models.project import Project
from ..models.project_hauling_price import ProjectHaulingPrice
from ..models.surat_jalan import SuratJalan
from ..models.vendor import Vendor
from ..schemas.project_hauling_price import ProjectHaulingPriceCreate, ProjectHaulingPriceUpdate


class HaulingPriceService:
    @staticmethod
    def get_project_prices(db: Session, project_id: int) -> List[ProjectHaulingPrice]:
        return (
            db.query(ProjectHaulingPrice)
            .filter(ProjectHaulingPrice.project_id == project_id)
            .order_by(ProjectHaulingPrice.effective_date.desc())
            .all()
        )

    @staticmethod
    def set_project_price(db: Session, data: ProjectHaulingPriceCreate) -> ProjectHaulingPrice:
        # Check if there is an existing price for this date and vendor (or global if vendor_id is None)
        query = db.query(ProjectHaulingPrice).filter(
            ProjectHaulingPrice.project_id == data.project_id,
            func.date(ProjectHaulingPrice.effective_date) == data.effective_date,
        )
        if data.vendor_id is not None:
            query = query.filter(ProjectHaulingPrice.vendor_id == data.vendor_id)
        else:
            query = query.filter(ProjectHaulingPrice.vendor_id.is_(None))

        if data.vehicle_type:
            query = query.filter(ProjectHaulingPrice.vehicle_type == data.vehicle_type)
        else:
            query = query.filter(ProjectHaulingPrice.vehicle_type.is_(None))

        price = query.first()

        if price:
            price.price_per_unit = data.price_per_unit
            price.material_deduction_per_rit = data.material_deduction_per_rit
        else:
            price = ProjectHaulingPrice(**data.model_dump())
            if not price.effective_date:
                price.effective_date = date.today()
            db.add(price)

        db.commit()
        db.refresh(price)

        # Retroactive recalculation
        HaulingPriceService._recalculate_surat_jalan_prices(
            db, data.project_id, data.vendor_id, price.effective_date
        )

        return price

    @staticmethod
    def update_project_price(
        db: Session, price_id: int, data: ProjectHaulingPriceUpdate
    ) -> ProjectHaulingPrice:
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
        earliest_date = min(
            old_effective_date.date()
            if isinstance(old_effective_date, datetime)
            else old_effective_date,
            price.effective_date.date()
            if isinstance(price.effective_date, datetime)
            else price.effective_date,
        )

        HaulingPriceService._recalculate_surat_jalan_prices(
            db, price.project_id, price.vendor_id, earliest_date
        )
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
        HaulingPriceService._recalculate_surat_jalan_prices(
            db,
            project_id,
            vendor_id,
            effective_date.date() if isinstance(effective_date, datetime) else effective_date,
        )
        return {"message": "Harga hauling berhasil dihapus"}

    @staticmethod
    def _recalculate_surat_jalan_prices(
        db: Session, project_id: int, vendor_id: int | None, effective_date: date
    ):
        """
        Recalculates hauling_price and hauling_cost for all SuratJalan records
        in a project from effective_date onward.

        Optimization: Pre-fetches all relevant ProjectHaulingPrice records in ONE
        query and performs vendor/date selection in-memory (eliminates N+1).
        """
        # 1. Fetch all affected SJs
        query = db.query(SuratJalan).filter(
            SuratJalan.project_id == project_id,
            func.date(SuratJalan.created_at) >= effective_date,
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
        measurement_type = getattr(project, "measurement_type", "tonase")

        # 3. Determine the date range of the affected SJs
        dates = [sj.created_at.date() for sj in sjs if sj.created_at]
        max_date = max(dates) if dates else effective_date

        # 4. PRE-FETCH all relevant ProjectHaulingPrice records in ONE query (N+1 fix)
        price_filter = db.query(ProjectHaulingPrice).filter(
            ProjectHaulingPrice.project_id == project_id,
            func.date(ProjectHaulingPrice.effective_date) <= max_date,
        )
        if vendor_id is not None:
            price_filter = price_filter.filter(
                or_(
                    ProjectHaulingPrice.vendor_id == vendor_id,
                    ProjectHaulingPrice.vendor_id.is_(None),
                )
            )
        all_prices = price_filter.all()

        # 5. Index prices in-memory: (vendor_id, vehicle_type) -> [prices sorted by effective_date desc]
        price_map: dict = {}
        for p in all_prices:
            price_map.setdefault((p.vendor_id, p.vehicle_type), []).append(p)
        for lst in price_map.values():
            lst.sort(key=lambda x: x.effective_date, reverse=True)

        def find_applicable_price(sj) -> ProjectHaulingPrice | None:
            """Find best matching price:
            1. vendor + vehicle_type
            2. vendor + null vehicle_type
            3. global + vehicle_type
            4. global + null vehicle_type
            """
            sj_date = sj.created_at.date() if sj.created_at else effective_date
            truck_type = getattr(sj, "truck_type", None)
            search_keys = []
            if truck_type:
                search_keys.append((sj.vendor_id, truck_type))
            search_keys.append((sj.vendor_id, None))
            if truck_type:
                search_keys.append((None, truck_type))
            search_keys.append((None, None))

            for key in search_keys:
                candidates = price_map.get(key, [])
                for p in candidates:
                    p_date = (
                        p.effective_date.date()
                        if hasattr(p.effective_date, "date")
                        else p.effective_date
                    )
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
                if measurement_type == "kubikasi":
                    measurement = float(sj.volume or 0)
                elif measurement_type == "ritase":
                    measurement = 1.0
                else:
                    measurement = float(sj.netto or 0)

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
