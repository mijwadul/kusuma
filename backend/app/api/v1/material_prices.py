from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.material_price import MaterialPrice, MATERIAL_TYPES, ALL_UNITS
from ...models.user import User
from ...schemas.material_price import (
    MaterialPriceCreate,
    MaterialPriceUpdate,
    MaterialPriceResponse,
    MaterialPriceLookup,
)

router = APIRouter()


def _is_gm(user: User) -> bool:
    return (
        getattr(user, "is_admin", False)
        or getattr(user, "is_superuser", False)
        or getattr(user, "role", "") in ("gm", "admin")
    )


def _lookup_price(
    db: Session,
    material_type: str,
    unit: str,
    customer_name: Optional[str] = None,
    vehicle_type: Optional[str] = None,
):
    """
    Cari harga dengan prioritas:
    1. Harga spesifik customer (dari tabel customers -> materials_json)
    2. Harga default (dari tabel material_prices)
    """
    import json
    from ...models.customer import Customer
    
    # 1. Cari harga khusus customer
    if customer_name and customer_name.strip():
        cust = db.query(Customer).filter(Customer.name == customer_name.strip()).first()
        if cust and cust.materials_json:
            try:
                prefs = json.loads(cust.materials_json)
                for p in prefs:
                    # Bersihkan spasi dan jadikan lowercase untuk pencocokan yang lebih baik
                    pref_mat = str(p.get("material_type") or "").strip().lower()
                    rec_mat = str(material_type or "").strip().lower()
                    pref_unit = str(p.get("unit") or "").strip().lower()
                    rec_unit = str(unit or "").strip().lower()
                    
                    if pref_mat == rec_mat and pref_unit == rec_unit:
                        if p.get("vehicle_type") and vehicle_type:
                            pref_veh = str(p.get("vehicle_type")).strip().lower()
                            rec_veh = str(vehicle_type).strip().lower()
                            if pref_veh != rec_veh:
                                continue
                        if p.get("unit_price"):
                            return {
                                "found": True,
                                "price_per_unit": float(p["unit_price"]),
                                "unit": unit,
                                "is_custom": True,
                            }
            except Exception:
                pass

    # 2. Fallback ke harga default (di mana customer_name = None)
    default = None
    if vehicle_type:
        # Coba cari yang spesifik untuk kendaraan ini
        default = (
            db.query(MaterialPrice)
            .filter(
                MaterialPrice.material_type == material_type,
                MaterialPrice.unit == unit,
                MaterialPrice.customer_name == None,
                MaterialPrice.vehicle_type == vehicle_type,
                MaterialPrice.is_active == True,
            )
            .first()
        )
    
    if not default:
        # Fallback ke harga umum (vehicle_type = None)
        default = (
            db.query(MaterialPrice)
            .filter(
                MaterialPrice.material_type == material_type,
                MaterialPrice.unit == unit,
                MaterialPrice.customer_name == None,
                MaterialPrice.vehicle_type == None,
                MaterialPrice.is_active == True,
            )
            .first()
        )

    if default:
        return {
            "found": True,
            "price_per_unit": float(default.price_per_unit),
            "unit": default.unit,
            "is_custom": False,
        }
    
    return {"found": False}


# ── Metadata endpoint ─────────────────────────────────────────────────────────

@router.get("/meta", response_model=dict)
def get_material_meta(current_user: User = Depends(get_current_user)):
    """Kembalikan daftar jenis material dan satuan yang valid."""
    from ...models.material_price import MATERIAL_UNITS
    return {
        "material_types": MATERIAL_TYPES,
        "all_units": ALL_UNITS,
        "material_units": MATERIAL_UNITS,
    }


# ── Lookup ────────────────────────────────────────────────────────────────────

@router.get("/lookup", response_model=MaterialPriceLookup)
def lookup_price(
    material_type: str = Query(...),
    unit: str = Query(...),
    customer_name: Optional[str] = Query(default=None),
    vehicle_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cari harga untuk kombinasi material + unit + customer + kendaraan.
    Digunakan untuk auto-fill harga di form penjualan.
    """
    result = _lookup_price(db, material_type, unit, customer_name, vehicle_type)
    if not result.get("found"):
        return MaterialPriceLookup(found=False)
    
    return MaterialPriceLookup(
        found=True,
        price_per_unit=result["price_per_unit"],
        unit=result["unit"],
        is_custom=result["is_custom"],
        material_price_id=0, # not needed
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[MaterialPriceResponse])
def list_prices(
    material_type: Optional[str] = Query(default=None),
    customer_name: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daftar semua harga material. Finance & GM dapat mengakses."""
    q = db.query(MaterialPrice)
    if material_type:
        q = q.filter(MaterialPrice.material_type == material_type)
    if customer_name is not None:
        if customer_name == "":
            q = q.filter(MaterialPrice.customer_name == None)
        else:
            q = q.filter(MaterialPrice.customer_name == customer_name)
    if is_active is not None:
        q = q.filter(MaterialPrice.is_active == is_active)
    return q.order_by(
        MaterialPrice.material_type.asc(),
        MaterialPrice.customer_name.asc(),
        MaterialPrice.unit.asc(),
    ).all()


@router.post("", response_model=MaterialPriceResponse, status_code=status.HTTP_201_CREATED)
def create_price(
    data: MaterialPriceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tambah harga material. GM only."""
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat mengelola harga material")

    existing = (
        db.query(MaterialPrice)
        .filter(
            MaterialPrice.material_type == data.material_type,
            MaterialPrice.unit == data.unit,
            MaterialPrice.customer_name == None,
            MaterialPrice.vehicle_type == data.vehicle_type,
        )
        .first()
    )
    if existing:
        veh_str = data.vehicle_type if data.vehicle_type else "Semua Kendaraan"
        raise HTTPException(
            status_code=409,
            detail=f"Harga default untuk {data.material_type} / {data.unit} ({veh_str}) sudah ada. Gunakan edit.",
        )

    mp = MaterialPrice(
        material_type=data.material_type,
        customer_name=None,
        vehicle_type=data.vehicle_type,
        unit=data.unit,
        price_per_unit=data.price_per_unit,
        is_active=data.is_active,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(mp)
    db.commit()
    db.refresh(mp)
    return mp


@router.put("/{price_id}", response_model=MaterialPriceResponse)
def update_price(
    price_id: int,
    data: MaterialPriceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update harga material. GM only."""
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat mengelola harga material")

    mp = db.query(MaterialPrice).filter(MaterialPrice.id == price_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Data harga tidak ditemukan")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "customer_name":
            continue
        setattr(mp, field, value)

    db.commit()
    db.refresh(mp)
    return mp


@router.delete("/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hapus harga material. GM only."""
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat mengelola harga material")

    mp = db.query(MaterialPrice).filter(MaterialPrice.id == price_id).first()
    if not mp:
        raise HTTPException(status_code=404, detail="Data harga tidak ditemukan")

    db.delete(mp)
    db.commit()
    return None
