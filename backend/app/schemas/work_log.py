from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class WorkLogBase(BaseModel):
    equipment_id: int
    input_method: str = Field(default="HM", pattern="^(HM|MANUAL)$")
    hm_start: Optional[Decimal] = None
    hm_end: Optional[Decimal] = None
    total_hours: Decimal
    rental_discount_hours: Optional[Decimal] = Decimal("0")
    project_id: Optional[int] = None
    operator_name: Optional[str] = None
    work_description: Optional[str] = None
    applied_rate: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    split_details: Optional[str] = None
    work_date: datetime


class WorkLogCreate(WorkLogBase):
    pass


class WorkLogUpdate(BaseModel):
    input_method: Optional[str] = Field(None, pattern="^(HM|MANUAL)$")
    hm_start: Optional[Decimal] = None
    hm_end: Optional[Decimal] = None
    total_hours: Optional[Decimal] = None
    rental_discount_hours: Optional[Decimal] = None
    project_id: Optional[int] = None
    operator_name: Optional[str] = None
    work_description: Optional[str] = None
    work_date: Optional[datetime] = None


class WorkLog(WorkLogBase):
    id: int
    recorded_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WorkLogWithEquipment(WorkLog):
    equipment_name: str
    equipment_type: str
    equipment_location: Optional[str] = None
    rental_rate_per_hour: Optional[Decimal] = Decimal("0")
    rental_billable_hours: Optional[Decimal] = Decimal("0")
    rental_cost_before_discount: Optional[Decimal] = Decimal("0")
    rental_discount_amount: Optional[Decimal] = Decimal("0")
    rental_cost_total: Optional[Decimal] = Decimal("0")


class WorkLogWithProject(WorkLogWithEquipment):
    project_name: Optional[str] = None


class WorkLogStats(BaseModel):
    total_hours_worked: float
    total_work_days: int
    avg_hours_per_day: float
    equipment_count: int
    hm_active_count: int  # Jumlah log dengan HM aktif
    manual_count: int  # Jumlah log manual


class WorkEfficiencyStats(BaseModel):
    total_hours: float
    total_fuel_consumed: float
    fuel_ratio: float  # Liter per Hour
    efficiency_rating: str  # "Excellent", "Good", "Normal", "Poor", "Critical"
