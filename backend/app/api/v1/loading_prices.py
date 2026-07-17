from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.auth import require_admin
from ...schemas.user import User
from ...schemas.project_loading_price import ProjectLoadingPriceCreate, ProjectLoadingPriceUpdate, ProjectLoadingPriceResponse
from ...services.user_service import UserService
from ...services.loading_price_service import LoadingPriceService

router = APIRouter()

@router.get("/loading-prices", response_model=List[ProjectLoadingPriceResponse])
def get_all_prices(db: Session = Depends(get_db)):
    return LoadingPriceService.get_all_prices(db)

@router.get("/loading-prices/search", response_model=List[ProjectLoadingPriceResponse])
def get_prices(project_id: Optional[int] = None, vendor_id: Optional[int] = None, db: Session = Depends(get_db)):
    return LoadingPriceService.get_prices(db, project_id, vendor_id)

@router.post("/loading-prices", response_model=ProjectLoadingPriceResponse)
def set_price(data: ProjectLoadingPriceCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return LoadingPriceService.set_price(db, data)

@router.put("/loading-prices/{price_id}", response_model=ProjectLoadingPriceResponse)
def update_price(price_id: int, data: ProjectLoadingPriceUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    price = LoadingPriceService.update_price(db, price_id, data)
    if not price:
        raise HTTPException(status_code=404, detail="Loading price not found")
    return price

@router.delete("/loading-prices/{price_id}")
def delete_price(price_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    success = LoadingPriceService.delete_price(db, price_id)
    if not success:
        raise HTTPException(status_code=404, detail="Loading price not found")
    return {"status": "success", "message": "Loading price deleted successfully"}
