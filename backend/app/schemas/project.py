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
    measurement_type: Optional[str] = "tonase"
    loading_rate: Optional[float] = 0.0
    notes: Optional[str] = None
    material_items: List[MaterialItemSchema] = []
    assigned_user_ids: List[int] = []
    assigned_employee_ids: List[int] = []

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
    measurement_type: Optional[str] = None
    loading_rate: Optional[float] = None
    notes: Optional[str] = None
    material_items: Optional[List[MaterialItemSchema]] = None
    assigned_user_ids: Optional[List[int]] = None
    assigned_employee_ids: Optional[List[int]] = None

class UserBasicResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    role: str
    class Config:
        from_attributes = True

class EmployeeBasicResponse(BaseModel):
    id: int
    name: str
    position: Optional[str]
    class Config:
        from_attributes = True

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
    measurement_type: str
    loading_rate: float = 0.0
    notes: Optional[str]
    created_at: Optional[str]
    material_items: List[MaterialItemResponse] = []
    assigned_users: List[UserBasicResponse] = []
    assigned_employees: List[EmployeeBasicResponse] = []
    total_material_value: float = 0.0
    realized_amount: float = 0.0
    budget_used: float = 0.0
    remaining_budget: float = 0.0
    uninvoiced_count: int = 0

    class Config:
        from_attributes = True
