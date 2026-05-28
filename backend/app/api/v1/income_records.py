from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.income_record import IncomeRecord
from ...models.project import Project
from ...models.customer import Customer
from ...schemas.income_record import (
    IncomeRecordCreate,
    IncomeRecordResponse,
    IncomeRecordUpdate,
)

router = APIRouter()


def _build_income_response(record: IncomeRecord, db: Session) -> IncomeRecordResponse:
    """Helper: bangun IncomeRecordResponse dengan project_name dari DB."""
    project_name: Optional[str] = None
    if record.project_id:
        proj = db.query(Project).filter(Project.id == record.project_id).first()
        project_name = proj.name if proj else None

    return IncomeRecordResponse(
        id=record.id,
        income_date=record.income_date,
        income_type=record.income_type,
        description=record.description,
        amount=record.amount,
        project_id=record.project_id,
        payment_term=record.payment_term,
        customer_name=record.customer_name,
        material_type=record.material_type,
        quantity=record.quantity,
        unit=record.unit,
        unit_price=record.unit_price,
        payment_method=record.payment_method,
        license_plate=record.license_plate,
        driver_name=record.driver_name,
        vehicle_type=record.vehicle_type,
        notes=record.notes,
        created_by=record.created_by,
        created_at=record.created_at,
        project_name=project_name,
    )


@router.get("", response_model=List[IncomeRecordResponse])
def get_income_records(
    income_date: Optional[date] = Query(
        default=None, description="Filter by exact date"
    ),
    start_date: Optional[date] = Query(
        default=None, description="Filter start date (inklusif)"
    ),
    end_date: Optional[date] = Query(
        default=None, description="Filter end date (inklusif)"
    ),
    income_type: Optional[str] = Query(
        default=None, description="Filter: project_payment | material_sale"
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Daftar pemasukan dengan filter tanggal dan tipe."""
    query = db.query(IncomeRecord)

    if income_date is not None:
        query = query.filter(IncomeRecord.income_date == income_date)
    if start_date is not None:
        query = query.filter(IncomeRecord.income_date >= start_date)
    if end_date is not None:
        query = query.filter(IncomeRecord.income_date <= end_date)
    if income_type is not None:
        query = query.filter(IncomeRecord.income_type == income_type)

    records = query.order_by(
        IncomeRecord.income_date.desc(), IncomeRecord.id.desc()
    ).all()
    return [_build_income_response(r, db) for r in records]


@router.post(
    "", response_model=IncomeRecordResponse, status_code=status.HTTP_201_CREATED
)
def create_income_record(
    data: IncomeRecordCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Buat catatan pemasukan baru."""
    # Auto create customer and truck if it's a material_sale
    if data.income_type == "material_sale" and data.customer_name:
        import json
        cust_name = data.customer_name.strip()
        customer = db.query(Customer).filter(Customer.name.ilike(cust_name)).first()
        if not customer:
            customer = Customer(name=cust_name, created_by=current_user.id if current_user else None)
            db.add(customer)
            db.flush()
        
        if data.license_plate:
            plate = data.license_plate.strip().upper()
            trucks = []
            if customer.trucks_json:
                try:
                    trucks = json.loads(customer.trucks_json)
                except Exception:
                    pass
            
            updated = False
            found = False
            for t in trucks:
                if t.get("license_plate", "").upper() == plate:
                    found = True
                    if data.driver_name and t.get("driver_name") != data.driver_name:
                        t["driver_name"] = data.driver_name
                        updated = True
                    if data.vehicle_type and t.get("vehicle_type") != data.vehicle_type:
                        t["vehicle_type"] = data.vehicle_type
                        updated = True
                    break
            
            if not found:
                trucks.append({
                    "license_plate": plate,
                    "driver_name": data.driver_name or "",
                    "vehicle_type": data.vehicle_type or "Colt Diesel"
                })
                updated = True
                
            if updated:
                customer.trucks_json = json.dumps(trucks)
                db.add(customer)

    record = IncomeRecord(
        income_date=data.income_date,
        income_type=data.income_type,
        description=data.description,
        amount=data.amount,
        project_id=data.project_id,
        payment_term=data.payment_term,
        customer_name=data.customer_name,
        material_type=data.material_type,
        quantity=data.quantity,
        unit=data.unit,
        unit_price=data.unit_price,
        payment_method=data.payment_method,
        license_plate=data.license_plate,
        driver_name=data.driver_name,
        vehicle_type=data.vehicle_type,
        
        sj_length=data.sj_length,
        sj_width=data.sj_width,
        sj_height=data.sj_height,
        sj_volume_minus=data.sj_volume_minus,
        sj_gross_weight=data.sj_gross_weight,
        sj_tare_weight=data.sj_tare_weight,
        sj_weight_minus=data.sj_weight_minus,
        
        notes=data.notes,
        created_by=current_user.id if current_user else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _build_income_response(record, db)


from ...schemas.income_record import BulkSuratJalanUpdate
from ...models.material_price import MaterialPrice
from .material_prices import _lookup_price

@router.put("/bulk-sj", response_model=dict)
def bulk_update_surat_jalan(
    data: BulkSuratJalanUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update bulk Surat Jalan fields untuk banyak record pemasukan sekaligus."""
    
    # Update truck master data if provided
    if data.truck_updates:
        import json
        for tu in data.truck_updates:
            # Cari customer yang punya truck ini
            # Karena ini bulk update dan kita ga pass customer_id di truck_updates,
            # kita bisa cari dari IncomeRecord yang diupdate, atau cari customer dari record pertama
            pass # We'll do truck updates more precisely below if needed, or wait, we need customer ID.
            
    # Actually, the truck updates can be handled per-record since each record has customer_name
    
    updated_count = 0
    for item in data.items:
        record = db.query(IncomeRecord).filter(IncomeRecord.id == item.id).first()
        if not record:
            continue
            
        record.unit = item.unit
        
        # Kalkulasi kuantitas
        if item.unit == "m3":
            record.sj_length = item.sj_length
            record.sj_width = item.sj_width
            record.sj_height = item.sj_height
            record.sj_volume_minus = item.sj_volume_minus or 0.0
            
            p = float(item.sj_length or 0)
            l = float(item.sj_width or 0)
            t = float(item.sj_height or 0)
            m = float(item.sj_volume_minus or 0)
            
            # Konversi dari CM ke M3
            record.quantity = (p * l * max(0, t - m)) / 1000000.0
            
        elif item.unit == "ton":
            record.sj_gross_weight = item.sj_gross_weight or 0.0
            record.sj_tare_weight = item.sj_tare_weight or 0.0
            record.sj_weight_minus = item.sj_weight_minus or 0.0
            
            b1 = float(item.sj_gross_weight or 0)
            b2 = float(item.sj_tare_weight or 0)
            m = float(item.sj_weight_minus or 0)
            record.quantity = max(0, b1 - b2 - m)
            
        # Update truck master data if it's m3 and we have truck_updates
        if item.unit == "m3" and record.customer_name and record.license_plate and data.truck_updates:
            import json
            tu = next((t for t in data.truck_updates if t.license_plate == record.license_plate), None)
            if tu:
                customer = db.query(Customer).filter(Customer.name.ilike(record.customer_name)).first()
                if customer and customer.trucks_json:
                    try:
                        trucks = json.loads(customer.trucks_json)
                        truck_updated = False
                        for t_dict in trucks:
                            if t_dict.get("license_plate", "").upper() == tu.license_plate.upper():
                                if tu.length is not None and t_dict.get("length") != tu.length:
                                    t_dict["length"] = tu.length
                                    truck_updated = True
                                if tu.width is not None and t_dict.get("width") != tu.width:
                                    t_dict["width"] = tu.width
                                    truck_updated = True
                                if tu.height is not None and t_dict.get("height") != tu.height:
                                    t_dict["height"] = tu.height
                                    truck_updated = True
                                break
                        if truck_updated:
                            customer.trucks_json = json.dumps(trucks)
                            db.add(customer)
                    except Exception:
                        pass
        
        # Ambil harga satuan menggunakan _lookup_price
        price_info = _lookup_price(
            db=db,
            material_type=record.material_type,
            unit=record.unit,
            customer_name=record.customer_name,
            vehicle_type=record.vehicle_type
        )
        
        with open("debug_price_log.txt", "a") as f:
            f.write(f"Record {record.id}: MT={record.material_type}, U={record.unit}, Cust={record.customer_name}, Veh={record.vehicle_type} --> Result: {price_info}\n")
            
        if price_info.get("found"):
            record.unit_price = float(price_info["price_per_unit"])
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Harga untuk material {record.material_type} dengan satuan {record.unit} belum diatur. Silakan atur harga di menu Atur Harga (GM) terlebih dahulu."
            )
            
        # Perhitungan pemotongan (truncate) 2 angka di belakang koma, BUKAN pembulatan
        if record.quantity is not None:
            import math
            record.quantity = math.floor(record.quantity * 100) / 100.0
            
        record.amount = float(record.quantity or 0) * record.unit_price
        updated_count += 1

    db.commit()
    return {"message": f"Berhasil mengupdate {updated_count} riwayat surat jalan"}

@router.get("/debug-price")
def debug_price(record_id: int, db: Session = Depends(get_db)):
    record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
    if not record: return {"error": "not found"}
    
    from ...models.customer import Customer
    import json
    cust = db.query(Customer).filter(Customer.name == record.customer_name).first()
    prefs = []
    if cust and cust.materials_json:
        prefs = json.loads(cust.materials_json)
        
    price_info = _lookup_price(
        db=db,
        material_type=record.material_type,
        unit=record.unit,
        customer_name=record.customer_name,
        vehicle_type=record.vehicle_type
    )
    
    return {
        "record": {
            "material_type": record.material_type,
            "unit": record.unit,
            "customer_name": record.customer_name,
            "vehicle_type": record.vehicle_type,
            "quantity": record.quantity,
            "unit_price": record.unit_price,
            "amount": record.amount
        },
        "customer_prefs": prefs,
        "price_info": price_info
    }

@router.put("/{record_id}", response_model=IncomeRecordResponse)
def update_income_record(
    record_id: int,
    data: IncomeRecordUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update catatan pemasukan. Hanya admin/GM atau pembuat yang bisa mengubah."""
    record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Income record not found")

    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if not is_admin_or_gm and record.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this record",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)
        
    # Auto update truck if customer and license_plate are present
    if record.income_type == "material_sale" and record.customer_name and record.license_plate:
        import json
        cust_name = record.customer_name.strip()
        customer = db.query(Customer).filter(Customer.name.ilike(cust_name)).first()
        if customer:
            plate = record.license_plate.strip().upper()
            trucks = []
            if customer.trucks_json:
                try:
                    trucks = json.loads(customer.trucks_json)
                except Exception:
                    pass
            
            updated = False
            found = False
            for t in trucks:
                if t.get("license_plate", "").upper() == plate:
                    found = True
                    if record.driver_name and t.get("driver_name") != record.driver_name:
                        t["driver_name"] = record.driver_name
                        updated = True
                    if record.vehicle_type and t.get("vehicle_type") != record.vehicle_type:
                        t["vehicle_type"] = record.vehicle_type
                        updated = True
                    break
            
            if not found:
                trucks.append({
                    "license_plate": plate,
                    "driver_name": record.driver_name or "",
                    "vehicle_type": record.vehicle_type or "Colt Diesel"
                })
                updated = True
                
            if updated:
                customer.trucks_json = json.dumps(trucks)
                db.add(customer)

    db.commit()
    db.refresh(record)
    return _build_income_response(record, db)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Hapus catatan pemasukan. Hanya admin/GM/superuser."""
    record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Income record not found")

    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if not is_admin_or_gm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin/GM access required",
        )

    db.delete(record)
    db.commit()
    return None

