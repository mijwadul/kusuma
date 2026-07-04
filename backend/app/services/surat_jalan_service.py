import math
from typing import List
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from ..models.surat_jalan import SuratJalan
from ..models.project import Project
from ..models.user import User
from ..models.vendor import Vendor
from ..models.project_hauling_price import ProjectHaulingPrice
from ..models.vendor_truck import VendorTruck
from ..schemas.surat_jalan import SuratJalanCreate, SuratJalanUpdate
from fastapi import HTTPException
from datetime import datetime, date

class SuratJalanService:
    @staticmethod
    def _check_project_access(project: Project, current_user: User):
        if getattr(current_user, "role", "") == "field":
            is_assigned = any(u.id == current_user.id for u in project.assigned_users)
            if not is_assigned:
                raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke proyek ini")

    @staticmethod
    def _calculate_measurement(project: Project, data: dict) -> tuple:
        netto = None
        volume = None
        
        if project.measurement_type == "tonase":
            bruto = data.get("bruto")
            tarra = data.get("tarra")
            if bruto is not None and tarra is not None:
                minus_berat = data.get("minus_berat") or 0.0
                netto = (bruto - tarra - minus_berat) / 1000.0
                if netto < 0:
                    raise HTTPException(status_code=400, detail="Bruto tidak boleh lebih kecil dari Tarra + Potongan")
        elif project.measurement_type == "kubikasi":
            panjang = data.get("panjang")
            lebar = data.get("lebar")
            tinggi = data.get("tinggi")
            if panjang is not None and lebar is not None and tinggi is not None:
                minus_tinggi = data.get("minus_tinggi") or 0.0
                raw_volume = (panjang * lebar * max(0, tinggi - minus_tinggi)) / 1000000.0
                volume = math.floor(raw_volume * 100) / 100.0
                if volume < 0:
                    raise HTTPException(status_code=400, detail="Volume tidak valid")
                    
        return netto, volume

    @staticmethod
    def create_surat_jalan(db: Session, current_user: User, data: SuratJalanCreate) -> SuratJalan:
        project = db.query(Project).filter(Project.id == data.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
            
        SuratJalanService._check_project_access(project, current_user)

        data_dict = data.model_dump()
        netto, volume = SuratJalanService._calculate_measurement(project, data_dict)
        
        # Calculate Hauling Cost
        hauling_price = None
        hauling_cost = None
        vendor = None
        
        # Handle manual vendor creation
        if not data.vendor_id and getattr(data, "vendor_name", None):
            vname = data.vendor_name.strip()
            if vname:
                vendor = db.query(Vendor).filter(Vendor.name == vname).first()
                if not vendor:
                    vendor = Vendor(name=vname, vendor_type="hauling")
                    db.add(vendor)
                    db.commit()
                    db.refresh(vendor)
                data.vendor_id = vendor.id

        if data.vendor_id:
            vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
            if vendor:
                today_date = date.today()
                price_record = db.query(ProjectHaulingPrice).filter(
                    ProjectHaulingPrice.project_id == project.id,
                    or_(ProjectHaulingPrice.vendor_id == vendor.id, ProjectHaulingPrice.vendor_id.is_(None)),
                    func.date(ProjectHaulingPrice.effective_date) <= today_date
                ).order_by(
                    ProjectHaulingPrice.vendor_id.isnot(None).desc(),
                    ProjectHaulingPrice.effective_date.desc()
                ).first()
                if price_record:
                    hauling_price = price_record.price_per_unit
                    
                    if project.measurement_type == "tonase" and netto is not None:
                        hauling_cost = float(hauling_price) * float(netto)
                    elif project.measurement_type == "kubikasi" and volume is not None:
                        hauling_cost = float(hauling_price) * float(volume)
                    elif project.measurement_type == "ritase":
                        hauling_cost = float(hauling_price) * 1.0

        sj = SuratJalan(
            project_id=data.project_id,
            field_staff_id=current_user.id,
            nopol=data.nopol,
            nama_supir=data.nama_supir,
            asal_tambang=data.asal_tambang,
            vendor_id=data.vendor_id,
            truck_id=data.truck_id,
            truck_type=getattr(data, 'truck_type', None),
            hauling_price=hauling_price,
            hauling_cost=hauling_cost,
            bruto=data.bruto if project.measurement_type == "tonase" else None,
            tarra=data.tarra if project.measurement_type == "tonase" else None,
            minus_berat=data.minus_berat if project.measurement_type == "tonase" else 0.0,
            netto=netto,
            panjang=data.panjang if project.measurement_type == "kubikasi" else None,
            lebar=data.lebar if project.measurement_type == "kubikasi" else None,
            tinggi=data.tinggi if project.measurement_type == "kubikasi" else None,
            minus_tinggi=data.minus_tinggi if project.measurement_type == "kubikasi" else 0.0,
            volume=volume
        )
        
        if data.created_at:
            sj.created_at = datetime.fromisoformat(data.created_at)
        
        db.add(sj)
        
        # Auto-save atau update VendorTruck
        if data.vendor_id and data.nopol:
            nopol_clean = data.nopol.strip().upper()
            if data.truck_id:
                # Update dimensi truk yang sudah ada jika ada perubahan ukuran, dan migrasikan jika vendor berbeda
                truck = db.query(VendorTruck).filter(VendorTruck.id == data.truck_id).first()
                if truck:
                    # Migrate truck to new vendor if requested (now always migrate to latest vendor)
                    if data.vendor_id and truck.vendor_id != data.vendor_id:
                        truck.vendor_id = data.vendor_id
                        
                    if project.measurement_type == "kubikasi":
                        if data.panjang is not None: truck.panjang = data.panjang
                        if data.lebar is not None: truck.lebar = data.lebar
                        if data.tinggi is not None: truck.tinggi = data.tinggi
            else:
                # Cek apakah nopol sudah ada di vendor_trucks (untuk vendor ini atau vendor manapun)
                existing_truck = db.query(VendorTruck).filter(
                    VendorTruck.nopol.ilike(nopol_clean)
                ).first()
                if not existing_truck:
                    # Auto-create truk baru
                    tipe = getattr(data, 'truck_type', None) or 'colt_diesel'
                    new_truck = VendorTruck(
                        vendor_id=data.vendor_id,
                        nopol=data.nopol.strip(),
                        supir_default=data.nama_supir,
                        tipe_truk=tipe,
                        panjang=data.panjang if project.measurement_type == "kubikasi" else None,
                        lebar=data.lebar if project.measurement_type == "kubikasi" else None,
                        tinggi=data.tinggi if project.measurement_type == "kubikasi" else None,
                    )
                    db.add(new_truck)
                    db.flush()  # dapatkan ID tanpa commit
                    sj.truck_id = new_truck.id
                else:
                    # Truk sudah ada, link ke SJ dan update supir default jika kosong
                    sj.truck_id = existing_truck.id
                    
                    # Migrate truck to new vendor if requested or if it had no vendor (now always migrate to latest vendor)
                    if data.vendor_id and existing_truck.vendor_id != data.vendor_id:
                        existing_truck.vendor_id = data.vendor_id

                    if not existing_truck.supir_default and data.nama_supir:
                        existing_truck.supir_default = data.nama_supir
                    if project.measurement_type == "kubikasi":
                        if data.panjang is not None: existing_truck.panjang = data.panjang
                        if data.lebar is not None: existing_truck.lebar = data.lebar
                        if data.tinggi is not None: existing_truck.tinggi = data.tinggi
        
        # Update vendor balance
        if vendor:
            from ..services.vendor_service import VendorService
            VendorService._sync_vendor_balance(db, vendor)

        db.commit()
        db.refresh(sj)
        return sj

    @staticmethod
    def get_project_surat_jalans(db: Session, current_user: User, project_id: int) -> List[SuratJalan]:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
            
        SuratJalanService._check_project_access(project, current_user)

        from sqlalchemy.orm import joinedload
        return db.query(SuratJalan).options(
            joinedload(SuratJalan.vendor),
            joinedload(SuratJalan.truck)
        ).filter(SuratJalan.project_id == project_id).order_by(SuratJalan.created_at.desc()).all()

    @staticmethod
    def update_surat_jalan(db: Session, current_user: User, sj_id: int, data: SuratJalanUpdate) -> SuratJalan:
        sj = db.query(SuratJalan).filter(SuratJalan.id == sj_id).first()
        if not sj:
            raise HTTPException(status_code=404, detail="Surat jalan tidak ditemukan")
            
        project = db.query(Project).filter(Project.id == sj.project_id).first()
        SuratJalanService._check_project_access(project, current_user)

        old_vendor_id = sj.vendor_id
        old_hauling_cost = float(sj.hauling_cost or 0.0)

        update_data = data.model_dump(exclude_unset=True)
        
        # Handle manual vendor creation
        if not data.vendor_id and getattr(data, "vendor_name", None):
            vname = data.vendor_name.strip()
            if vname:
                vendor = db.query(Vendor).filter(Vendor.name == vname).first()
                if not vendor:
                    vendor = Vendor(name=vname, vendor_type="hauling")
                    db.add(vendor)
                    db.commit()
                    db.refresh(vendor)
                data.vendor_id = vendor.id
                update_data["vendor_id"] = vendor.id

        for key, value in update_data.items():
            if key not in ["bruto", "tarra", "minus_berat", "panjang", "lebar", "tinggi", "minus_tinggi", "created_at", "vendor_name"]:
                setattr(sj, key, value)
                
        if "created_at" in update_data and update_data["created_at"]:
            sj.created_at = datetime.fromisoformat(update_data["created_at"])

        if project.measurement_type == "tonase":
            if "bruto" in update_data: sj.bruto = update_data["bruto"]
            if "tarra" in update_data: sj.tarra = update_data["tarra"]
            if "minus_berat" in update_data: sj.minus_berat = update_data["minus_berat"]
            
        elif project.measurement_type == "kubikasi":
            if "panjang" in update_data: sj.panjang = update_data["panjang"]
            if "lebar" in update_data: sj.lebar = update_data["lebar"]
            if "tinggi" in update_data: sj.tinggi = update_data["tinggi"]
            if "minus_tinggi" in update_data: sj.minus_tinggi = update_data["minus_tinggi"]
            
        sj_dict = {
            "bruto": sj.bruto,
            "tarra": sj.tarra,
            "minus_berat": sj.minus_berat,
            "panjang": sj.panjang,
            "lebar": sj.lebar,
            "tinggi": sj.tinggi,
            "minus_tinggi": sj.minus_tinggi
        }
        
        netto, volume = SuratJalanService._calculate_measurement(project, sj_dict)
        if netto is not None: sj.netto = netto
        if volume is not None: sj.volume = volume

        # Recalculate Hauling Cost
        hauling_price = None
        hauling_cost = None
        
        if sj.vendor_id:
            sj_date = sj.created_at.date()
            price_record = db.query(ProjectHaulingPrice).filter(
                ProjectHaulingPrice.project_id == project.id,
                or_(ProjectHaulingPrice.vendor_id == sj.vendor_id, ProjectHaulingPrice.vendor_id.is_(None)),
                func.date(ProjectHaulingPrice.effective_date) <= sj_date
            ).order_by(
                ProjectHaulingPrice.vendor_id.isnot(None).desc(),
                ProjectHaulingPrice.effective_date.desc()
            ).first()
            if price_record:
                hauling_price = price_record.price_per_unit
                if project.measurement_type == "tonase" and sj.netto is not None:
                    hauling_cost = float(hauling_price) * float(sj.netto)
                elif project.measurement_type == "kubikasi" and sj.volume is not None:
                    hauling_cost = float(hauling_price) * float(sj.volume)
                elif project.measurement_type == "ritase":
                    hauling_cost = float(hauling_price) * 1.0
                    
        sj.hauling_price = hauling_price
        sj.hauling_cost = hauling_cost

        # Auto-save atau update VendorTruck
        if sj.vendor_id and sj.nopol:
            nopol_clean = sj.nopol.strip().upper()
            if sj.truck_id:
                # Update dimensi truk yang sudah ada
                truck = db.query(VendorTruck).filter(VendorTruck.id == sj.truck_id).first()
                if truck:
                    # Migrate truck to new vendor if requested or if it had no vendor (now always migrate to latest vendor)
                    if sj.vendor_id and truck.vendor_id != sj.vendor_id:
                        truck.vendor_id = sj.vendor_id
                        
                    if not truck.supir_default and sj.nama_supir:
                        truck.supir_default = sj.nama_supir
                    if project.measurement_type == "kubikasi":
                        if sj.panjang is not None: truck.panjang = sj.panjang
                        if sj.lebar is not None: truck.lebar = sj.lebar
                        if sj.tinggi is not None: truck.tinggi = sj.tinggi
            else:
                # Cek apakah nopol sudah ada
                existing_truck = db.query(VendorTruck).filter(
                    VendorTruck.nopol.ilike(nopol_clean)
                ).first()
                if not existing_truck:
                    tipe = sj.truck_type or 'colt_diesel'
                    new_truck = VendorTruck(
                        vendor_id=sj.vendor_id,
                        nopol=sj.nopol.strip(),
                        supir_default=sj.nama_supir,
                        tipe_truk=tipe,
                        panjang=sj.panjang if project.measurement_type == "kubikasi" else None,
                        lebar=sj.lebar if project.measurement_type == "kubikasi" else None,
                        tinggi=sj.tinggi if project.measurement_type == "kubikasi" else None,
                    )
                    db.add(new_truck)
                    db.flush()
                    sj.truck_id = new_truck.id
                else:
                    sj.truck_id = existing_truck.id
                    
                    # Migrate truck to new vendor if requested or if it had no vendor (now always migrate to latest vendor)
                    if sj.vendor_id and existing_truck.vendor_id != sj.vendor_id:
                        existing_truck.vendor_id = sj.vendor_id

                    if not existing_truck.supir_default and sj.nama_supir:
                        existing_truck.supir_default = sj.nama_supir
                    if project.measurement_type == "kubikasi":
                        if sj.panjang is not None: existing_truck.panjang = sj.panjang
                        if sj.lebar is not None: existing_truck.lebar = sj.lebar
                        if sj.tinggi is not None: existing_truck.tinggi = sj.tinggi

        # Handle Deposit Refund and Deduction
        from ..services.vendor_service import VendorService
        if old_vendor_id:
            old_vendor = db.query(Vendor).filter(Vendor.id == old_vendor_id).first()
            if old_vendor:
                VendorService._sync_vendor_balance(db, old_vendor)
        if sj.vendor_id:
            new_vendor = db.query(Vendor).filter(Vendor.id == sj.vendor_id).first()
            if new_vendor:
                VendorService._sync_vendor_balance(db, new_vendor)

        db.commit()
        db.refresh(sj)
        return sj

    @staticmethod
    def delete_surat_jalan(db: Session, current_user: User, sj_id: int) -> None:
        sj = db.query(SuratJalan).filter(SuratJalan.id == sj_id).first()
        if not sj:
            raise HTTPException(status_code=404, detail="Surat jalan tidak ditemukan")
            
        project = db.query(Project).filter(Project.id == sj.project_id).first()
        SuratJalanService._check_project_access(project, current_user)

        vendor = None
        if sj.vendor_id:
            vendor = db.query(Vendor).filter(Vendor.id == sj.vendor_id).first()

        db.delete(sj)
        db.flush()

        if vendor:
            from ..services.vendor_service import VendorService
            VendorService._sync_vendor_balance(db, vendor)

        db.commit()

    @staticmethod
    def get_truck_history(db: Session, current_user: User) -> List[dict]:
        # Return unique trucks by nopol, getting the latest details
        # Using a distinct subquery or group_by. For compatibility, we can just query all and group in Python, 
        # or use order_by and group_by, but MySQL handles group_by differently than SQLite.
        # The safest way that works on both is ordering by created_at desc, and picking the first of each nopol in Python.
        
        sjs = db.query(SuratJalan).filter(SuratJalan.nopol != None, SuratJalan.nopol != '').order_by(SuratJalan.created_at.desc()).all()
        
        trucks = {}
        for sj in sjs:
            nopol_upper = sj.nopol.strip().upper()
            if nopol_upper not in trucks:
                trucks[nopol_upper] = {
                    "nopol": sj.nopol.strip(),
                    "nama_supir": sj.nama_supir,
                    "panjang": sj.panjang,
                    "lebar": sj.lebar,
                    "tinggi": sj.tinggi,
                    "vendor_id": sj.vendor_id,
                    "vendor_name": sj.vendor.name if sj.vendor else None,
                    "truck_id": sj.truck_id,
                    "truck_type": None # Can't fetch easily from SJ, fallback below
                }
                
        return list(trucks.values())
