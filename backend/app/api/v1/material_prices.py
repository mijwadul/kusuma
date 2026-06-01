from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user, require_admin
from ...core.database import get_db
from ...models.user import User
from ...schemas.material_price import (
    MaterialPriceCreate,
    MaterialPriceUpdate,
    MaterialPriceResponse,
    MaterialPriceLookup,
)
from ...services.material_price_service import MaterialPriceService

router = APIRouter()

# Kept for backward compatibility if any modules import it directly from here
def _lookup_price(db, material_type, unit, customer_name=None, vehicle_type=None):
    return MaterialPriceService.lookup_price(db, material_type, unit, customer_name, vehicle_type)


@router.get("/meta", response_model=dict)
def get_material_meta(current_user: User = Depends(get_current_user)):
    return MaterialPriceService.get_material_meta()


@router.get("/lookup", response_model=MaterialPriceLookup)
def lookup_price(
    material_type: str = Query(...),
    unit: str = Query(...),
    customer_name: Optional[str] = Query(default=None),
    vehicle_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = MaterialPriceService.lookup_price(db, material_type, unit, customer_name, vehicle_type)
    if not result.get("found"):
        return MaterialPriceLookup(found=False)
    
    return MaterialPriceLookup(
        found=True,
        price_per_unit=result["price_per_unit"],
        unit=result["unit"],
        is_custom=result["is_custom"],
        material_price_id=0,
    )


@router.get("", response_model=List[MaterialPriceResponse])
def list_prices(
    material_type: Optional[str] = Query(default=None),
    customer_name: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MaterialPriceService.list_prices(db, material_type, customer_name, is_active)


@router.post("", response_model=MaterialPriceResponse, status_code=status.HTTP_201_CREATED)
def create_price(
    data: MaterialPriceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return MaterialPriceService.create_price(db, current_user, data)


@router.put("/{price_id}", response_model=MaterialPriceResponse)
def update_price(
    price_id: int,
    data: MaterialPriceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return MaterialPriceService.update_price(db, current_user, price_id, data)


@router.delete("/{price_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    MaterialPriceService.delete_price(db, current_user, price_id)
    return None
