from datetime import date
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.project import Project
from ..models.surat_jalan import SuratJalan
from ..models.vendor import Vendor
from ..models.vendor_truck import VendorTruck
from ..schemas.vendor_truck import VendorTruckCreate, VendorTruckUpdate
from .hauling_billing_service import HaulingBillingService
from .hauling_price_service import HaulingPriceService


class HaulingService:
    @staticmethod
    def get_dashboard_stats(db: Session) -> dict:
        total_ritase = db.query(SuratJalan).count()
        active_vendors = (
            db.query(SuratJalan.vendor_id)
            .filter(SuratJalan.vendor_id.isnot(None))
            .distinct()
            .count()
        )

        total_tonase = db.query(func.sum(SuratJalan.netto)).scalar() or 0.0
        total_volume = db.query(func.sum(SuratJalan.volume)).scalar() or 0.0

        return {
            "total_ritase": total_ritase,
            "total_tonase": float(total_tonase),
            "total_volume": float(total_volume),
            "active_vendors": active_vendors,
        }

    # ── Truck Management ─────────────────────────────────────────────────────
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
    def update_vendor_truck(
        db: Session, truck_id: int, data: VendorTruckUpdate
    ) -> VendorTruck:
        truck = db.query(VendorTruck).filter(VendorTruck.id == truck_id).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Dump truck tidak ditemukan")

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
            raise HTTPException(status_code=404, detail="Dump truck tidak ditemukan")

        db.delete(truck)
        db.commit()

    # ── Project Pricing Delegations ──────────────────────────────────────────
    get_project_prices = staticmethod(HaulingPriceService.get_project_prices)
    set_project_price = staticmethod(HaulingPriceService.set_project_price)
    update_project_price = staticmethod(HaulingPriceService.update_project_price)
    delete_project_price = staticmethod(HaulingPriceService.delete_project_price)
    _recalculate_surat_jalan_prices = staticmethod(
        HaulingPriceService._recalculate_surat_jalan_prices
    )

    # ── Obligations ──────────────────────────────────────────────────────────
    @staticmethod
    def get_project_hauling_obligations(db: Session, project_id: int) -> List[dict]:
        # Group SJ by vendor and calculate totals
        sjs = (
            db.query(SuratJalan)
            .filter(
                SuratJalan.project_id == project_id, SuratJalan.vendor_id != None
            )
            .all()
        )

        vendors_data = {}
        for sj in sjs:
            vid = sj.vendor_id
            if vid not in vendors_data:
                vendors_data[vid] = {
                    "vendor_id": vid,
                    "vendor_name": sj.vendor.name if sj.vendor else f"Vendor #{vid}",
                    "total_ritase": 0,
                    "total_tonase": 0.0,
                    "total_volume": 0.0,
                    "total_cost": 0.0,
                }
            v = vendors_data[vid]
            v["total_ritase"] += 1
            v["total_tonase"] += float(sj.netto or 0.0)
            v["total_volume"] += float(sj.volume or 0.0)
            v["total_cost"] += float(sj.hauling_cost or 0.0)

        # Append vendor's actual balance
        result = []
        for v in vendors_data.values():
            vendor_obj = db.query(Vendor).filter(Vendor.id == v["vendor_id"]).first()
            v["current_balance"] = (
                float(vendor_obj.current_balance or 0.0) if vendor_obj else 0.0
            )
            result.append(v)

        return result

    @staticmethod
    def get_all_hauling_obligations(db: Session) -> List[dict]:
        vendors = db.query(Vendor).filter(Vendor.category == "hauling").all()
        result = []
        for vendor in vendors:
            sjs = (
                db.query(SuratJalan)
                .filter(SuratJalan.vendor_id == vendor.id)
                .all()
            )
            total_ritase = len(sjs)
            total_tonase = sum(float(sj.netto or 0.0) for sj in sjs)
            total_volume = sum(float(sj.volume or 0.0) for sj in sjs)
            total_cost = sum(float(sj.hauling_cost or 0.0) for sj in sjs)

            result.append(
                {
                    "vendor_id": vendor.id,
                    "vendor_name": vendor.name,
                    "vendor_contact": vendor.contact_person,
                    "vendor_phone": vendor.phone,
                    "total_ritase": total_ritase,
                    "total_tonase": total_tonase,
                    "total_volume": total_volume,
                    "total_cost": total_cost,
                    "current_balance": float(vendor.current_balance or 0.0),
                }
            )
        return result

    @staticmethod
    def get_vendor_hauling_details(db: Session, vendor_id: int) -> List[dict]:
        vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor tidak ditemukan")

        sjs = (
            db.query(SuratJalan)
            .filter(SuratJalan.vendor_id == vendor_id)
            .all()
        )

        projects_map = {}
        for sj in sjs:
            pid = sj.project_id
            if pid not in projects_map:
                p_name = sj.project.name if sj.project else f"Project #{pid}"
                meas_type = (
                    getattr(sj.project, "measurement_type", "tonase")
                    if sj.project
                    else "tonase"
                )
                projects_map[pid] = {
                    "project_id": pid,
                    "project_name": p_name,
                    "measurement_type": meas_type,
                    "total_ritase": 0,
                    "total_tonase": 0.0,
                    "total_volume": 0.0,
                    "total_cost": 0.0,
                    "trucks": {},
                }
            p_data = projects_map[pid]
            p_data["total_ritase"] += 1
            p_data["total_tonase"] += float(sj.netto or 0.0)
            p_data["total_volume"] += float(sj.volume or 0.0)
            p_data["total_cost"] += float(sj.hauling_cost or 0.0)

            nopol = sj.nopol or "Tanpa Nopol"
            if nopol not in p_data["trucks"]:
                p_data["trucks"][nopol] = {
                    "nopol": nopol,
                    "driver_name": sj.nama_supir or "-",
                    "ritase": 0,
                    "tonase": 0.0,
                    "volume": 0.0,
                    "cost": 0.0,
                }
            t = p_data["trucks"][nopol]
            t["ritase"] += 1
            t["tonase"] += float(sj.netto or 0.0)
            t["volume"] += float(sj.volume or 0.0)
            t["cost"] += float(sj.hauling_cost or 0.0)

        result = []
        for p in projects_map.values():
            p["trucks"] = list(p["trucks"].values())
            result.append(p)

        return result

    # ── Billing Delegations ──────────────────────────────────────────────────
    get_hauling_billing = staticmethod(HaulingBillingService.get_hauling_billing)
    create_hauling_bill = staticmethod(HaulingBillingService.create_hauling_bill)
    list_hauling_bills = staticmethod(HaulingBillingService.list_hauling_bills)
    get_hauling_bill_detail = staticmethod(
        HaulingBillingService.get_hauling_bill_detail
    )
    delete_hauling_bill = staticmethod(HaulingBillingService.delete_hauling_bill)
