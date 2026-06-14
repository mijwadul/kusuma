import math
from typing import List
from sqlalchemy.orm import Session
from ..models.surat_jalan import SuratJalan
from ..models.project import Project
from ..models.user import User
from ..schemas.surat_jalan import SuratJalanCreate, SuratJalanUpdate
from fastapi import HTTPException

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
                netto = bruto - tarra - minus_berat
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

        sj = SuratJalan(
            project_id=data.project_id,
            field_staff_id=current_user.id,
            nopol=data.nopol,
            nama_supir=data.nama_supir,
            asal_tambang=data.asal_tambang,
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
        
        db.add(sj)
        db.commit()
        db.refresh(sj)
        return sj

    @staticmethod
    def get_project_surat_jalans(db: Session, current_user: User, project_id: int) -> List[SuratJalan]:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
            
        SuratJalanService._check_project_access(project, current_user)

        return db.query(SuratJalan).filter(SuratJalan.project_id == project_id).order_by(SuratJalan.created_at.desc()).all()

    @staticmethod
    def update_surat_jalan(db: Session, current_user: User, sj_id: int, data: SuratJalanUpdate) -> SuratJalan:
        sj = db.query(SuratJalan).filter(SuratJalan.id == sj_id).first()
        if not sj:
            raise HTTPException(status_code=404, detail="Surat jalan tidak ditemukan")
            
        project = db.query(Project).filter(Project.id == sj.project_id).first()
        SuratJalanService._check_project_access(project, current_user)

        update_data = data.model_dump(exclude_unset=True)
        
        for key, value in update_data.items():
            if key not in ["bruto", "tarra", "minus_berat", "panjang", "lebar", "tinggi", "minus_tinggi"]:
                setattr(sj, key, value)

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

        db.delete(sj)
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
                    "tinggi": sj.tinggi
                }
                
        return list(trucks.values())
