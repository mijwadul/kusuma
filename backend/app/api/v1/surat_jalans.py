from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import math

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.user import User
from ...models.project import Project
from ...models.surat_jalan import SuratJalan
from ...schemas.surat_jalan import SuratJalanCreate, SuratJalanUpdate, SuratJalanResponse

router = APIRouter()

def _fmt(dt) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)

@router.post("/surat-jalan", response_model=SuratJalanResponse, status_code=status.HTTP_201_CREATED)
def create_surat_jalan(
    data: SuratJalanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
        
    # Validasi apakah user diassign ke project (jika user adalah field staff)
    if getattr(current_user, "role", "") == "field":
        # Using list iteration for association proxy or collection
        is_assigned = any(u.id == current_user.id for u in project.assigned_users)
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Anda tidak di-assign ke proyek ini")

    # Kalkulasi
    netto = None
    volume = None
    
    if project.measurement_type == "tonase":
        if data.bruto is not None and data.tarra is not None:
            minus_berat = data.minus_berat or 0.0
            netto = data.bruto - data.tarra - minus_berat
            if netto < 0:
                raise HTTPException(status_code=400, detail="Bruto tidak boleh lebih kecil dari Tarra + Potongan")
    elif project.measurement_type == "kubikasi":
        if data.panjang is not None and data.lebar is not None and data.tinggi is not None:
            minus_tinggi = data.minus_tinggi or 0.0
            raw_volume = (data.panjang * data.lebar * max(0, data.tinggi - minus_tinggi)) / 1000000.0
            volume = math.floor(raw_volume * 100) / 100.0
            if volume < 0:
                raise HTTPException(status_code=400, detail="Volume tidak valid")

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
    
    return SuratJalanResponse(
        id=sj.id,
        project_id=sj.project_id,
        field_staff_id=sj.field_staff_id,
        nopol=sj.nopol,
        nama_supir=sj.nama_supir,
        asal_tambang=sj.asal_tambang,
        bruto=sj.bruto,
        tarra=sj.tarra,
        minus_berat=sj.minus_berat,
        netto=sj.netto,
        panjang=sj.panjang,
        lebar=sj.lebar,
        tinggi=sj.tinggi,
        minus_tinggi=sj.minus_tinggi,
        volume=sj.volume,
        created_at=_fmt(sj.created_at)
    )

@router.get("/projects/{project_id}/surat-jalan", response_model=List[SuratJalanResponse])
def get_project_surat_jalans(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
        
    if getattr(current_user, "role", "") == "field":
        is_assigned = any(u.id == current_user.id for u in project.assigned_users)
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke surat jalan proyek ini")

    sjs = db.query(SuratJalan).filter(SuratJalan.project_id == project_id).order_by(SuratJalan.created_at.desc()).all()
    
    result = []
    for sj in sjs:
        result.append(SuratJalanResponse(
            id=sj.id,
            project_id=sj.project_id,
            field_staff_id=sj.field_staff_id,
            nopol=sj.nopol,
            nama_supir=sj.nama_supir,
            asal_tambang=sj.asal_tambang,
            bruto=sj.bruto,
            tarra=sj.tarra,
            minus_berat=sj.minus_berat,
            netto=sj.netto,
            panjang=sj.panjang,
            lebar=sj.lebar,
            tinggi=sj.tinggi,
            minus_tinggi=sj.minus_tinggi,
            volume=sj.volume,
            created_at=_fmt(sj.created_at)
        ))
    return result

@router.put("/surat-jalan/{sj_id}", response_model=SuratJalanResponse)
def update_surat_jalan(
    sj_id: int,
    data: SuratJalanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sj = db.query(SuratJalan).filter(SuratJalan.id == sj_id).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Surat jalan tidak ditemukan")
        
    project = db.query(Project).filter(Project.id == sj.project_id).first()
    
    if getattr(current_user, "role", "") == "field":
        is_assigned = any(u.id == current_user.id for u in project.assigned_users)
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses untuk mengubah surat jalan ini")

    if data.nopol is not None:
        sj.nopol = data.nopol
    if data.nama_supir is not None:
        sj.nama_supir = data.nama_supir
    if data.asal_tambang is not None:
        sj.asal_tambang = data.asal_tambang

    if project.measurement_type == "tonase":
        if data.bruto is not None: sj.bruto = data.bruto
        if data.tarra is not None: sj.tarra = data.tarra
        if data.minus_berat is not None: sj.minus_berat = data.minus_berat
        
        if sj.bruto is not None and sj.tarra is not None:
            mb = sj.minus_berat or 0.0
            netto = sj.bruto - sj.tarra - mb
            if netto < 0:
                raise HTTPException(status_code=400, detail="Bruto tidak boleh lebih kecil dari Tarra + Potongan")
            sj.netto = netto
            
    elif project.measurement_type == "kubikasi":
        if data.panjang is not None: sj.panjang = data.panjang
        if data.lebar is not None: sj.lebar = data.lebar
        if data.tinggi is not None: sj.tinggi = data.tinggi
        if data.minus_tinggi is not None: sj.minus_tinggi = data.minus_tinggi
        
        if sj.panjang is not None and sj.lebar is not None and sj.tinggi is not None:
            mt = sj.minus_tinggi or 0.0
            raw_volume = (sj.panjang * sj.lebar * max(0, sj.tinggi - mt)) / 1000000.0
            volume = math.floor(raw_volume * 100) / 100.0
            if volume < 0:
                raise HTTPException(status_code=400, detail="Volume tidak valid")
            sj.volume = volume

    db.commit()
    db.refresh(sj)
    
    return SuratJalanResponse(
        id=sj.id,
        project_id=sj.project_id,
        field_staff_id=sj.field_staff_id,
        nopol=sj.nopol,
        nama_supir=sj.nama_supir,
        asal_tambang=sj.asal_tambang,
        bruto=sj.bruto,
        tarra=sj.tarra,
        minus_berat=sj.minus_berat,
        netto=sj.netto,
        panjang=sj.panjang,
        lebar=sj.lebar,
        tinggi=sj.tinggi,
        minus_tinggi=sj.minus_tinggi,
        volume=sj.volume,
        created_at=_fmt(sj.created_at)
    )

@router.delete("/surat-jalan/{sj_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_surat_jalan(
    sj_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sj = db.query(SuratJalan).filter(SuratJalan.id == sj_id).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Surat jalan tidak ditemukan")
        
    project = db.query(Project).filter(Project.id == sj.project_id).first()
    
    if getattr(current_user, "role", "") == "field":
        is_assigned = any(u.id == current_user.id for u in project.assigned_users)
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses untuk menghapus surat jalan ini")

    db.delete(sj)
    db.commit()
    return None
