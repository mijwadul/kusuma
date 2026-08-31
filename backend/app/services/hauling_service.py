from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from ..models.vendor_truck import VendorTruck
from ..models.project_hauling_price import ProjectHaulingPrice
from ..models.vendor import Vendor
from ..models.project import Project
from ..models.hauling_bill import HaulingBill
from ..schemas.vendor_truck import VendorTruckCreate, VendorTruckUpdate
from ..schemas.project_hauling_price import ProjectHaulingPriceCreate, ProjectHaulingPriceUpdate
from ..schemas.hauling_bill import (
    HaulingBillingSJ,
    HaulingBillingGroupDate,
    HaulingBillingPreviewResult,
    HaulingBillCreate,
    HaulingBillResponse,
    HaulingBillDetailResponse,
)
from ..models.user import User
from ..models.surat_jalan import SuratJalan
from sqlalchemy import func, or_, and_
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
            price.material_deduction_per_rit = data.material_deduction_per_rit
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

    @staticmethod
    def get_hauling_billing(
        db: Session,
        vendor_id: int,
        start_date: date,
        end_date: date,
        project_id: Optional[int] = None,
        nopol: Optional[str] = None,
        only_unbilled: bool = False,
    ) -> HaulingBillingPreviewResult:
        """
        Hitung preview rekap tagihan hauling untuk satu vendor pada periode tertentu.
        Mendukung filter unbilled untuk mencegah double billing, grouping per tanggal,
        serta raw precision tanpa pembulatan.
        """
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor tidak ditemukan")

        # ── Query Surat Jalan dalam periode yang relevan ─────────────────────
        q = db.query(SuratJalan).filter(
            SuratJalan.vendor_id == vendor_id,
            func.date(SuratJalan.created_at) >= start_date,
            func.date(SuratJalan.created_at) <= end_date,
        )
        if project_id:
            q = q.filter(SuratJalan.project_id == project_id)
        if nopol:
            q = q.filter(SuratJalan.nopol == nopol)

        all_period_sjs = q.order_by(SuratJalan.created_at.asc()).all()

        unbilled_count = sum(1 for s in all_period_sjs if not s.hauling_is_billed)
        billed_count = sum(1 for s in all_period_sjs if s.hauling_is_billed)

        sjs = [s for s in all_period_sjs if not s.hauling_is_billed] if only_unbilled else all_period_sjs

        # ── Pre-load project & price maps ──────────────────────────────────
        pids = list({sj.project_id for sj in sjs if sj.project_id})
        projects = db.query(Project).filter(Project.id.in_(pids)).all() if pids else []
        project_map = {p.id: p for p in projects}

        first_project = project_map.get(project_id) if project_id else (projects[0] if projects else None)
        overall_measurement_type = getattr(first_project, 'measurement_type', 'tonase') if first_project else 'tonase'

        all_prices = db.query(ProjectHaulingPrice).filter(
            ProjectHaulingPrice.project_id.in_(pids),
            or_(
                ProjectHaulingPrice.vendor_id == vendor_id,
                ProjectHaulingPrice.vendor_id.is_(None)
            )
        ).order_by(ProjectHaulingPrice.effective_date.desc()).all() if pids else []

        price_map: dict[tuple[int, int | None], list] = {}
        for p in all_prices:
            price_map.setdefault((p.project_id, p.vendor_id), []).append(p)

        def find_price(sj: SuratJalan) -> Optional[ProjectHaulingPrice]:
            if not sj.project_id:
                return None
            sj_date = sj.created_at.date() if sj.created_at else start_date
            for vid in [vendor_id, None]:
                for p in price_map.get((sj.project_id, vid), []):
                    p_date = p.effective_date.date() if hasattr(p.effective_date, 'date') else p.effective_date
                    if p_date <= sj_date:
                        return p
            return None

        # ── Bangun baris rincian & Grouping per Tanggal ──────────────────────
        rows: list[HaulingBillingSJ] = []
        date_groups_map: dict[date, dict] = {}

        for sj in sjs:
            proj = project_map.get(sj.project_id)
            sj_meas_type = getattr(proj, 'measurement_type', 'tonase') if proj else 'tonase'
            sj_meas_unit = 'm3' if sj_meas_type == 'kubikasi' else 'ton'

            applicable = find_price(sj)
            hp = float(applicable.price_per_unit) if applicable else float(sj.hauling_price or 0)
            deduction = float(applicable.material_deduction_per_rit) if applicable else 0.0

            # Raw measurement tanpa pembulatan desimal
            measurement = (
                float(sj.volume or 0) if sj_meas_type == 'kubikasi'
                else float(sj.netto or 0)
            )
            hauling_cost = hp * measurement
            net_cost = hauling_cost - deduction

            sj_date_val = sj.created_at.date() if sj.created_at else start_date

            row_item = HaulingBillingSJ(
                sj_id=sj.id,
                sj_date=sj_date_val,
                nopol=sj.nopol or '-',
                supir=sj.nama_supir,
                measurement=measurement,
                measurement_unit=sj_meas_unit,
                hauling_price=hp,
                hauling_cost=hauling_cost,
                material_deduction=deduction,
                net_cost=net_cost,
                hauling_is_billed=bool(sj.hauling_is_billed),
                hauling_bill_id=sj.hauling_bill_id,
            )
            rows.append(row_item)

            if sj_date_val not in date_groups_map:
                date_groups_map[sj_date_val] = {
                    "date": sj_date_val,
                    "ritase": 0,
                    "measurement": 0.0,
                    "measurement_unit": sj_meas_unit,
                    "hauling_cost": 0.0,
                    "material_deduction": 0.0,
                    "net_cost": 0.0,
                    "rates": set(),
                    "rows": [],
                }
            g = date_groups_map[sj_date_val]
            g["ritase"] += 1
            g["measurement"] += measurement
            g["hauling_cost"] += hauling_cost
            g["material_deduction"] += deduction
            g["net_cost"] += net_cost
            g["rates"].add(hp)
            g["rows"].append(row_item)

        sorted_date_groups = []
        for dval in sorted(date_groups_map.keys()):
            gdata = date_groups_map[dval]
            sorted_date_groups.append(HaulingBillingGroupDate(
                date=gdata["date"],
                ritase=gdata["ritase"],
                measurement=gdata["measurement"],
                measurement_unit=gdata["measurement_unit"],
                hauling_cost=gdata["hauling_cost"],
                material_deduction=gdata["material_deduction"],
                net_cost=gdata["net_cost"],
                rates=sorted(list(gdata["rates"])),
                rows=gdata["rows"],
            ))

        total_ritase = len(rows)
        total_measurement = sum(r.measurement for r in rows)
        total_hauling_cost = sum(r.hauling_cost for r in rows)
        total_material_deduction = sum(r.material_deduction for r in rows)
        total_net = sum(r.net_cost for r in rows)

        return HaulingBillingPreviewResult(
            vendor_id=vendor_id,
            vendor_name=vendor.name,
            project_id=project_id,
            project_name=first_project.name if first_project and project_id else None,
            period_start=start_date,
            period_end=end_date,
            measurement_type=overall_measurement_type,
            total_ritase=total_ritase,
            total_measurement=total_measurement,
            total_hauling_cost=total_hauling_cost,
            total_material_deduction=total_material_deduction,
            total_net=total_net,
            unbilled_count=unbilled_count,
            billed_count=billed_count,
            grouped_dates=sorted_date_groups,
            rows=rows,
        )

    # ── CRUD Hauling Bills (Simpan & Riwayat Laporan Tagihan) ────────────────
    @staticmethod
    def create_hauling_bill(db: Session, data: HaulingBillCreate, user_id: Optional[int] = None) -> HaulingBill:
        vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor tidak ditemukan")

        # 1. Tentukan nomor bill/laporan jika tidak diinput
        if not data.bill_number or not data.bill_number.strip():
            today_str = (data.bill_date or date.today()).strftime("%Y%m%d")
            count_today = db.query(HaulingBill).filter(
                func.date(HaulingBill.created_at) == date.today()
            ).count()
            data.bill_number = f"RTH-{today_str}-{count_today + 1:03d}"

        # 2. Preview kalkulasi data yang akan disimpan
        preview = HaulingService.get_hauling_billing(
            db,
            vendor_id=data.vendor_id,
            start_date=data.start_date,
            end_date=data.end_date,
            project_id=data.project_id,
            nopol=data.nopol,
            only_unbilled=False,
        )

        # Jika user memilih spesifik sj_ids
        target_sjs = preview.rows
        if data.sj_ids and len(data.sj_ids) > 0:
            target_sjs = [r for r in preview.rows if r.sj_id in data.sj_ids]

        if not target_sjs:
            raise HTTPException(status_code=400, detail="Tidak ada surat jalan yang dapat ditagihkan.")

        total_ritase = len(target_sjs)
        total_measurement = sum(r.measurement for r in target_sjs)
        total_hauling_cost = sum(r.hauling_cost for r in target_sjs)
        total_material_deduction = sum(r.material_deduction for r in target_sjs)
        total_net = sum(r.net_cost for r in target_sjs)

        # 3. Simpan record HaulingBill
        bill = HaulingBill(
            bill_number=data.bill_number,
            vendor_id=data.vendor_id,
            project_id=data.project_id,
            nopol=data.nopol,
            start_date=data.start_date,
            end_date=data.end_date,
            bill_date=data.bill_date or date.today(),
            total_ritase=total_ritase,
            total_measurement=total_measurement,
            total_hauling_cost=total_hauling_cost,
            total_material_deduction=total_material_deduction,
            total_net=total_net,
            measurement_type=preview.measurement_type,
            status="unpaid",
            notes=data.notes,
            is_downloaded=True,
            created_by=user_id,
        )
        db.add(bill)
        db.commit()
        db.refresh(bill)

        # 4. Update status surat_jalan terkait
        sj_ids_to_update = [r.sj_id for r in target_sjs]
        db.query(SuratJalan).filter(SuratJalan.id.in_(sj_ids_to_update)).update(
            {
                SuratJalan.hauling_is_billed: True,
                SuratJalan.hauling_bill_id: bill.id,
            },
            synchronize_session=False,
        )
        db.commit()

        return bill

    @staticmethod
    def list_hauling_bills(
        db: Session,
        vendor_id: Optional[int] = None,
        project_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> List[HaulingBillResponse]:
        q = db.query(HaulingBill)
        if vendor_id:
            q = q.filter(HaulingBill.vendor_id == vendor_id)
        if project_id:
            q = q.filter(HaulingBill.project_id == project_id)
        if status:
            q = q.filter(HaulingBill.status == status)

        bills = q.order_by(HaulingBill.created_at.desc()).all()
        result = []
        for b in bills:
            resp = HaulingBillResponse.model_validate(b)
            resp.vendor_name = b.vendor.name if b.vendor else "-"
            resp.project_name = b.project.name if b.project else "-"
            result.append(resp)
        return result

    @staticmethod
    def get_hauling_bill_detail(db: Session, bill_id: int) -> HaulingBillDetailResponse:
        bill = db.query(HaulingBill).filter(HaulingBill.id == bill_id).first()
        if not bill:
            raise HTTPException(status_code=404, detail="Laporan tagihan tidak ditemukan")

        resp = HaulingBillDetailResponse.model_validate(bill)
        resp.vendor_name = bill.vendor.name if bill.vendor else "-"
        resp.project_name = bill.project.name if bill.project else "-"

        # Ambil SJ yang terhubung
        sjs = db.query(SuratJalan).filter(SuratJalan.hauling_bill_id == bill.id).order_by(SuratJalan.created_at.asc()).all()

        # Dapatkan harga yang berlaku saat itu
        rows = []
        date_groups_map: dict[date, dict] = {}
        for sj in sjs:
            hp = float(sj.hauling_price or 0)
            meas = float(sj.volume or 0) if bill.measurement_type == 'kubikasi' else float(sj.netto or 0)
            cost = float(sj.hauling_cost or (hp * meas))
            sj_date_val = sj.created_at.date() if sj.created_at else bill.start_date
            unit_val = 'm3' if bill.measurement_type == 'kubikasi' else 'ton'

            # Est. deduction
            deduction = (cost - (float(sj.hauling_cost or cost))) # or proportional
            net = cost - deduction

            row_item = HaulingBillingSJ(
                sj_id=sj.id,
                sj_date=sj_date_val,
                nopol=sj.nopol or '-',
                supir=sj.nama_supir,
                measurement=meas,
                measurement_unit=unit_val,
                hauling_price=hp,
                hauling_cost=cost,
                material_deduction=deduction,
                net_cost=net,
                hauling_is_billed=True,
                hauling_bill_id=bill.id,
            )
            rows.append(row_item)

            if sj_date_val not in date_groups_map:
                date_groups_map[sj_date_val] = {
                    "date": sj_date_val,
                    "ritase": 0,
                    "measurement": 0.0,
                    "measurement_unit": unit_val,
                    "hauling_cost": 0.0,
                    "material_deduction": 0.0,
                    "net_cost": 0.0,
                    "rates": set(),
                    "rows": [],
                }
            g = date_groups_map[sj_date_val]
            g["ritase"] += 1
            g["measurement"] += meas
            g["hauling_cost"] += cost
            g["material_deduction"] += deduction
            g["net_cost"] += net
            g["rates"].add(hp)
            g["rows"].append(row_item)

        sorted_date_groups = []
        for dval in sorted(date_groups_map.keys()):
            gdata = date_groups_map[dval]
            sorted_date_groups.append(HaulingBillingGroupDate(
                date=gdata["date"],
                ritase=gdata["ritase"],
                measurement=gdata["measurement"],
                measurement_unit=gdata["measurement_unit"],
                hauling_cost=gdata["hauling_cost"],
                material_deduction=gdata["material_deduction"],
                net_cost=gdata["net_cost"],
                rates=sorted(list(gdata["rates"])),
                rows=gdata["rows"],
            ))

        resp.rows = rows
        resp.grouped_dates = sorted_date_groups
        return resp

    @staticmethod
    def delete_hauling_bill(db: Session, bill_id: int):
        bill = db.query(HaulingBill).filter(HaulingBill.id == bill_id).first()
        if not bill:
            raise HTTPException(status_code=404, detail="Laporan tagihan tidak ditemukan")

        # Unlink SuratJalan
        db.query(SuratJalan).filter(SuratJalan.hauling_bill_id == bill.id).update(
            {
                SuratJalan.hauling_is_billed: False,
                SuratJalan.hauling_bill_id: None,
            },
            synchronize_session=False,
        )
        db.delete(bill)
        db.commit()
        return {"message": "Laporan tagihan hauling berhasil dihapus"}

