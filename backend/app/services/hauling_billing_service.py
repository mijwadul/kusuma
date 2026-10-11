from datetime import date, datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..models.hauling_bill import HaulingBill
from ..models.project import Project
from ..models.project_hauling_price import ProjectHaulingPrice
from ..models.surat_jalan import SuratJalan
from ..models.vendor import Vendor
from ..schemas.hauling_bill import (
    HaulingBillCreate,
    HaulingBillDetailResponse,
    HaulingBillingGroupDate,
    HaulingBillingPreviewResult,
    HaulingBillingSJ,
    HaulingBillResponse,
)


class HaulingBillingService:
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
            nopols = [n.strip() for n in nopol.split(",") if n.strip()]
            if len(nopols) == 1:
                q = q.filter(SuratJalan.nopol == nopols[0])
            elif len(nopols) > 1:
                q = q.filter(SuratJalan.nopol.in_(nopols))

        all_period_sjs = q.order_by(SuratJalan.created_at.asc()).all()

        unbilled_count = sum(1 for s in all_period_sjs if not s.hauling_is_billed)
        billed_count = sum(1 for s in all_period_sjs if s.hauling_is_billed)

        sjs = [s for s in all_period_sjs if not s.hauling_is_billed] if only_unbilled else all_period_sjs

        # ── Pre-load project & price maps ──────────────────────────────────
        pids = list({sj.project_id for sj in sjs if sj.project_id})
        projects = db.query(Project).filter(Project.id.in_(pids)).all() if pids else []
        project_map = {p.id: p for p in projects}

        first_project = project_map.get(project_id) if project_id else (projects[0] if projects else None)
        overall_measurement_type = getattr(first_project, "measurement_type", "tonase") if first_project else "tonase"

        all_prices = db.query(ProjectHaulingPrice).filter(
            ProjectHaulingPrice.project_id.in_(pids),
            or_(
                ProjectHaulingPrice.vendor_id == vendor_id,
                ProjectHaulingPrice.vendor_id.is_(None),
            ),
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
                    p_date = p.effective_date.date() if hasattr(p.effective_date, "date") else p.effective_date
                    if p_date <= sj_date:
                        return p
            return None

        # ── Bangun baris rincian & Grouping per Tanggal ──────────────────────
        rows: list[HaulingBillingSJ] = []
        date_groups_map: dict[date, dict] = {}

        for sj in sjs:
            proj = project_map.get(sj.project_id)
            sj_meas_type = getattr(proj, "measurement_type", "tonase") if proj else "tonase"
            sj_meas_unit = "m3" if sj_meas_type == "kubikasi" else "ton"

            applicable = find_price(sj)
            hp = float(applicable.price_per_unit) if applicable else float(sj.hauling_price or 0)
            deduction = float(applicable.material_deduction_per_rit) if applicable else 0.0

            # Raw measurement tanpa pembulatan desimal
            measurement = (
                float(sj.volume or 0) if sj_meas_type == "kubikasi"
                else float(sj.netto or 0)
            )
            hauling_cost = hp * measurement
            net_cost = hauling_cost - deduction

            sj_date_val = sj.created_at.date() if sj.created_at else start_date

            row_item = HaulingBillingSJ(
                sj_id=sj.id,
                sj_date=sj_date_val,
                nopol=sj.nopol or "-",
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
                measurement=round(gdata["measurement"], 2),
                measurement_unit=gdata["measurement_unit"],
                hauling_cost=gdata["hauling_cost"],
                material_deduction=gdata["material_deduction"],
                net_cost=gdata["net_cost"],
                rates=sorted(list(gdata["rates"])),
                rows=gdata["rows"],
            ))

        total_ritase = len(rows)
        total_measurement = round(sum(r.measurement for r in rows), 2)
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
        preview = HaulingBillingService.get_hauling_billing(
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
            nopol=data.nopol[:50] if data.nopol else None,
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

        # Ambil Surat Jalan yang terhubung ke bill
        sjs = (
            db.query(SuratJalan)
            .filter(SuratJalan.hauling_bill_id == bill.id)
            .order_by(SuratJalan.created_at.asc())
            .all()
        )

        rows = []
        date_groups_map: dict[date, dict] = {}
        project_price_map: dict[tuple[int, int | None], list] = {}

        project_ids = list({
            sj.project_id
            for sj in sjs
            if sj.project_id is not None
        })

        if project_ids:
            prices = (
                db.query(ProjectHaulingPrice)
                .filter(
                    ProjectHaulingPrice.project_id.in_(project_ids),
                    or_(
                        ProjectHaulingPrice.vendor_id == bill.vendor_id,
                        ProjectHaulingPrice.vendor_id.is_(None),
                    ),
                    func.date(ProjectHaulingPrice.effective_date) <= bill.end_date,
                )
                .order_by(ProjectHaulingPrice.effective_date.desc())
                .all()
            )

            for price in prices:
                key = (price.project_id, price.vendor_id)
                project_price_map.setdefault(key, []).append(price)

        def find_applicable_price(sj: SuratJalan) -> Optional[ProjectHaulingPrice]:
            if not sj.project_id:
                return None

            sj_date = (
                sj.created_at.date()
                if sj.created_at
                else bill.start_date
            )

            for vendor_key in [bill.vendor_id, None]:
                candidates = project_price_map.get(
                    (sj.project_id, vendor_key),
                    [],
                )
                for price in candidates:
                    price_date = (
                        price.effective_date.date()
                        if hasattr(price.effective_date, "date")
                        else price.effective_date
                    )
                    if price_date <= sj_date:
                        return price
            return None

        for sj in sjs:
            applicable = find_applicable_price(sj)
            hp = (
                float(applicable.price_per_unit)
                if applicable
                else float(sj.hauling_price or 0)
            )

            meas = (
                float(sj.volume or 0)
                if bill.measurement_type == "kubikasi"
                else float(sj.netto or 0)
            )

            cost = float(
                sj.hauling_cost
                if sj.hauling_cost is not None
                else hp * meas
            )

            deduction = (
                float(applicable.material_deduction_per_rit or 0)
                if applicable
                else 0.0
            )

            net = cost - deduction

            sj_date_val = (
                sj.created_at.date()
                if sj.created_at
                else bill.start_date
            )

            unit_val = (
                "m3"
                if bill.measurement_type == "kubikasi"
                else "ton"
            )

            row_item = HaulingBillingSJ(
                sj_id=sj.id,
                sj_date=sj_date_val,
                nopol=sj.nopol or "-",
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
            sorted_date_groups.append(
                HaulingBillingGroupDate(
                    date=gdata["date"],
                    ritase=gdata["ritase"],
                    measurement=round(gdata["measurement"], 2),
                    measurement_unit=gdata["measurement_unit"],
                    hauling_cost=gdata["hauling_cost"],
                    material_deduction=gdata["material_deduction"],
                    net_cost=gdata["net_cost"],
                    rates=sorted(list(gdata["rates"])),
                    rows=gdata["rows"],
                )
            )

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
