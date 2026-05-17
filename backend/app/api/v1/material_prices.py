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
) -> Optional[MaterialPrice]:
    """
    Cari harga dengan prioritas:
    1. Harga spesifik customer (customer_name match, unit match)
    2. Harga default (customer_name IS NULL, unit match)
    """
    # 1. Cari harga khusus customer
    if customer_name and customer_name.strip():
        specific = (
            db.query(MaterialPrice)
            .filter(
                MaterialPrice.material_type == material_type,
                MaterialPrice.unit == unit,
                MaterialPrice.customer_name == customer_name.strip(),
                MaterialPrice.is_active == True,
            )
            .first()
        )
        if specific:
            return specific

    # 2. Fallback ke harga default
    default = (
        db.query(MaterialPrice)
        .filter(
            MaterialPrice.material_type == material_type,
            MaterialPrice.unit == unit,
            MaterialPrice.customer_name == None,
            MaterialPrice.is_active == True,
        )
        .first()
    )
    return default


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cari harga untuk kombinasi material + unit + customer.
    Digunakan untuk auto-fill harga di form penjualan.
    """
    mp = _lookup_price(db, material_type, unit, customer_name)
    if not mp:
        return MaterialPriceLookup(found=False)
    is_custom = mp.customer_name is not None
    return MaterialPriceLookup(
        found=True,
        price_per_unit=mp.price_per_unit,
        unit=mp.unit,
        is_custom=is_custom,
        material_price_id=mp.id,
    )


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[MaterialPriceResponse])
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


@router.post("/", response_model=MaterialPriceResponse, status_code=status.HTTP_201_CREATED)
def create_price(
    data: MaterialPriceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tambah harga material. GM only."""
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat mengelola harga material")

    # Cek duplikasi: kombinasi material + unit + customer harus unik
    existing = (
        db.query(MaterialPrice)
        .filter(
            MaterialPrice.material_type == data.material_type,
            MaterialPrice.unit == data.unit,
            MaterialPrice.customer_name == data.customer_name,
        )
        .first()
    )
    if existing:
        label = data.customer_name or "default"
        raise HTTPException(
            status_code=409,
            detail=f"Harga untuk {data.material_type} / {data.unit} / customer '{label}' sudah ada. Gunakan edit.",
        )

    mp = MaterialPrice(
        material_type=data.material_type,
        customer_name=data.customer_name,
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
