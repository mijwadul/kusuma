from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from ...core.auth import require_admin
from ...schemas.user import User
from ...schemas.project_loading_price import ProjectLoadingPriceCreate, ProjectLoadingPriceUpdate, ProjectLoadingPriceResponse
from ...services.user_service import UserService
from ...services.loading_price_service import LoadingPriceService

router = APIRouter()

@router.get("/projects/{project_id}/loading-prices", response_model=List[ProjectLoadingPriceResponse])
def get_project_prices(project_id: int, db: Session = Depends(get_db)):
    return LoadingPriceService.get_project_prices(db, project_id)

@router.post("/projects/{project_id}/loading-prices", response_model=ProjectLoadingPriceResponse)
def set_project_price(project_id: int, data: ProjectLoadingPriceCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if data.project_id != project_id:
        raise HTTPException(status_code=400, detail="Project ID mismatch")
    return LoadingPriceService.set_project_price(db, data)

@router.put("/projects/{project_id}/loading-prices/{price_id}", response_model=ProjectLoadingPriceResponse)
def update_project_price(project_id: int, price_id: int, data: ProjectLoadingPriceUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    price = LoadingPriceService.update_project_price(db, price_id, data)
    if not price:
        raise HTTPException(status_code=404, detail="Loading price not found")
    return price

@router.delete("/projects/{project_id}/loading-prices/{price_id}")
def delete_project_price(project_id: int, price_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    success = LoadingPriceService.delete_project_price(db, price_id)
    if not success:
        raise HTTPException(status_code=404, detail="Loading price not found")
    return {"status": "success", "message": "Loading price deleted successfully"}
