from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.auth import get_current_user, require_role, require_admin
from ...core.database import get_db
from ...models.user import User
from ...schemas import (
    FuelLogCreate,
    FuelLogUpdate,
    FuelLog as FuelLogSchema,
    FuelLogWithEquipment,
    FuelEfficiencyStats,
    FuelEquipmentReportItem,
    FuelPriceCreate,
    FuelPriceUpdate,
    FuelPrice as FuelPriceSchema,
)
from ...services.fuel_service import FuelService

router = APIRouter()

@router.post("/refuel", response_model=FuelLogSchema)
def create_fuel_log(
    fuel_data: FuelLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["field", "helper", "finance", "checker"]))
):
    return FuelService.create_fuel_log(db, current_user, fuel_data)


@router.get("/logs", response_model=List[FuelLogWithEquipment])
def get_fuel_logs(
    equipment_id: Optional[int] = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FuelService.get_fuel_logs(db, equipment_id, days)


@router.get("/logs/{log_id}", response_model=FuelLogWithEquipment)
def get_fuel_log_by_id(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FuelService.get_fuel_log_by_id(db, log_id)


@router.put("/logs/{log_id}", response_model=FuelLogSchema)
def update_fuel_log(
    log_id: int,
    fuel_data: FuelLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"]))
):
    return FuelService.update_fuel_log(db, log_id, fuel_data)


@router.get("/efficiency", response_model=FuelEfficiencyStats)
def get_fuel_efficiency(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FuelService.get_fuel_efficiency(db, days)


@router.get("/equipment-report", response_model=List[FuelEquipmentReportItem])
def get_fuel_equipment_report(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FuelService.get_fuel_equipment_report(db, days)


@router.get("/efficiency/{equipment_id}", response_model=dict)
def get_equipment_fuel_efficiency(
    equipment_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FuelService.get_equipment_fuel_efficiency(db, equipment_id, days)


@router.delete("/logs/{log_id}", status_code=204)
def delete_fuel_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"]))
):
    FuelService.delete_fuel_log(db, log_id)
    return None


@router.get("/vendors", response_model=List[str])
def get_fuel_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FuelService.get_fuel_vendors(db)


@router.get("/price", response_model=List[FuelPriceSchema])
def get_fuel_prices(
    fuel_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return FuelService.get_fuel_prices(db, fuel_type, start_date, end_date)


@router.post("/price", response_model=FuelPriceSchema)
def create_fuel_price(
    price_data: FuelPriceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"]))
):
    return FuelService.create_fuel_price(db, current_user, price_data)


@router.put("/price/{price_id}/approve", response_model=FuelPriceSchema)
def approve_fuel_purchase(
    price_id: int,
    status: str = "approved",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    return FuelService.approve_fuel_purchase(db, current_user, price_id, status)


@router.put("/price/{price_id}/pay", response_model=FuelPriceSchema)
def pay_fuel_purchase(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"]))
):
    return FuelService.pay_fuel_purchase(db, current_user, price_id)


@router.put("/price/{price_id}", response_model=FuelPriceSchema)
def update_fuel_purchase(
    price_id: int,
    data: FuelPriceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"]))
):
    return FuelService.update_fuel_purchase(db, current_user, price_id, data)


@router.delete("/price/{price_id}", status_code=204)
def delete_fuel_purchase(
    price_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"]))
):
    FuelService.delete_fuel_purchase(db, current_user, price_id)
    return None


@router.get("/stock", response_model=dict)
def get_fuel_stock(db: Session = Depends(get_db)):
    return FuelService.get_fuel_stock(db)
