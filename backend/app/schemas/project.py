from typing import List, Optional
from pydantic import BaseModel

class MaterialItemSchema(BaseModel):
    material_type: str
    unit: str
    target_quantity: float
    unit_price: Optional[float] = None
    notes: Optional[str] = None

class MaterialItemResponse(MaterialItemSchema):
    id: int
    project_id: int
    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    name: str
    client_name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = None
    status: Optional[str] = "ongoing"
    notes: Optional[str] = None
    material_items: List[MaterialItemSchema] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = None
    progress: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    material_items: Optional[List[MaterialItemSchema]] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    client_name: Optional[str]
    description: Optional[str]
    location: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    budget: Optional[float]
    progress: float
    status: str
    notes: Optional[str]
    created_at: Optional[str]
    material_items: List[MaterialItemResponse] = []
    total_material_value: float = 0.0
    realized_amount: float = 0.0
    budget_used: float = 0.0
    remaining_budget: float = 0.0

    class Config:
        from_attributes = True
