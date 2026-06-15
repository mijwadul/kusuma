import io
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, status, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import xlsxwriter

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.user import User
from ...models.project import Project
from ...models.surat_jalan import SuratJalan
from ...schemas.surat_jalan import SuratJalanCreate, SuratJalanUpdate, SuratJalanResponse

from ...services.surat_jalan_service import SuratJalanService

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
    sj = SuratJalanService.create_surat_jalan(db, current_user, data)
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
        created_at=_fmt(sj.created_at),
        vendor_name=sj.vendor.name if sj.vendor else None,
        truck_type=sj.truck_type or (sj.truck.tipe_truk if sj.truck else None)
    )

@router.get("/projects/{project_id}/surat-jalan", response_model=List[SuratJalanResponse])
def get_project_surat_jalans(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sjs = SuratJalanService.get_project_surat_jalans(db, current_user, project_id)
    
    result = []
    for sj in sjs:
        result.append(SuratJalanResponse(
            id=sj.id,
            project_id=sj.project_id,
            field_staff_id=sj.field_staff_id,
            vendor_id=sj.vendor_id,
            truck_id=sj.truck_id,
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
            created_at=_fmt(sj.created_at),
            vendor_name=sj.vendor.name if sj.vendor else None,
            truck_type=sj.truck_type or (sj.truck.tipe_truk if sj.truck else None)
        ))
    return result

@router.put("/surat-jalan/{sj_id}", response_model=SuratJalanResponse)
def update_surat_jalan(
    sj_id: int,
    data: SuratJalanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sj = SuratJalanService.update_surat_jalan(db, current_user, sj_id, data)
    
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
        created_at=_fmt(sj.created_at),
        vendor_name=sj.vendor.name if sj.vendor else None,
        truck_type=sj.truck_type or (sj.truck.tipe_truk if sj.truck else None)
    )

@router.delete("/surat-jalan/{sj_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_surat_jalan(
    sj_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    SuratJalanService.delete_surat_jalan(db, current_user, sj_id)
    return None

@router.get("/surat-jalan/trucks/history")
def get_truck_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SuratJalanService.get_truck_history(db, current_user)

@router.get("/surat-jalan/export/excel")
def export_surat_jalan_excel(
    project_id: int,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
        
    SuratJalanService._check_project_access(project, current_user)
        
    query = db.query(SuratJalan).filter(SuratJalan.project_id == project_id)
    
    if start_date:
        query = query.filter(SuratJalan.created_at >= f"{start_date} 00:00:00")
    if end_date:
        query = query.filter(SuratJalan.created_at <= f"{end_date} 23:59:59")
        
    sjs = query.order_by(SuratJalan.created_at.asc()).all()
    
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet("Surat Jalan")
    
    header_format = workbook.add_format({
        'bold': True, 'bg_color': '#D3D3D3', 'border': 1
    })
    cell_format = workbook.add_format({'border': 1})
    
    headers = ["ID", "Waktu", "Nopol", "Nama Supir", "Asal Tambang"]
    if project.measurement_type == "tonase":
        headers.extend(["Bruto", "Tarra", "Potongan", "Netto (Ton)"])
    else:
        headers.extend(["Panjang", "Lebar", "Tinggi", "Minus Tinggi", "Volume (M3)"])
        
    for col_num, header in enumerate(headers):
        worksheet.write(0, col_num, header, header_format)
        
    for row_num, sj in enumerate(sjs, 1):
        row_data = [
            sj.id,
            _fmt(sj.created_at),
            sj.nopol,
            sj.nama_supir,
            sj.asal_tambang,
        ]
        
        if project.measurement_type == "tonase":
            row_data.extend([sj.bruto, sj.tarra, sj.minus_berat, sj.netto])
        else:
            row_data.extend([sj.panjang, sj.lebar, sj.tinggi, sj.minus_tinggi, sj.volume])
            
        for col_num, val in enumerate(row_data):
            worksheet.write(row_num, col_num, val if val is not None else "", cell_format)
            
    workbook.close()
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=surat_jalan_project_{project_id}.xlsx"
        }
    )
