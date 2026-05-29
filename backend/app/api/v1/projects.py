"""
API untuk Project & Customer Management.
Project   → proyek dengan target volume material tertentu (ada permintaan kuantitas)
Customer  → pelanggan tetap (continuous buyer, tanpa target volume)
"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.customer import Customer, ProjectMaterialItem
from ...models.income_record import IncomeRecord
from ...models.material_price import MATERIAL_TYPES, MATERIAL_UNITS, ALL_UNITS
from ...models.project import Project
from ...models.user import User

router = APIRouter()


def _is_gm(user: User) -> bool:
    return (
        getattr(user, "is_admin", False)
        or getattr(user, "is_superuser", False)
        or getattr(user, "role", "") in ("gm", "admin")
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

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
    start_date: Optional[str] = None   # ISO date string
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
    total_material_value: float = 0.0   # sum(target_qty * unit_price)
    realized_amount: float = 0.0        # income_records untuk proyek ini

    class Config:
        from_attributes = True

class CustomerMaterialPreference(BaseModel):
    material_type: str
    unit: str
    unit_price: Optional[float] = None
    vehicle_type: str = "Tronton"

class CustomerTruck(BaseModel):
    license_plate: str
    driver_name: Optional[str] = None
    vehicle_type: str = "Tronton"
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

class AddTruckRequest(BaseModel):
    license_plate: str
    driver_name: Optional[str] = None
    vehicle_type: str = "Colt Diesel"
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

class CustomerCreate(BaseModel):
    name: str
    company: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    material_preferences: List[CustomerMaterialPreference] = []
    trucks: List[CustomerTruck] = []

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    material_preferences: Optional[List[CustomerMaterialPreference]] = None
    trucks: Optional[List[CustomerTruck]] = None

class CustomerResponse(BaseModel):
    id: int
    name: str
    company: Optional[str]
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    is_active: bool
    material_preferences: List[CustomerMaterialPreference] = []
    trucks: List[CustomerTruck] = []
    total_purchases: float = 0.0   # sum dari income_records untuk customer ini
    purchase_count: int = 0

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt(dt) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    return str(dt)

def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

def _build_project_response(proj: Project, db: Session) -> ProjectResponse:
    items = [MaterialItemResponse.model_validate(i) for i in proj.material_items]
    total_val = sum(
        (i.target_quantity * i.unit_price) for i in proj.material_items
        if i.unit_price is not None
    )
    realized = db.query(
        __import__("sqlalchemy", fromlist=["func"]).func.coalesce(
            __import__("sqlalchemy", fromlist=["func"]).func.sum(IncomeRecord.amount), 0
        )
    ).filter(IncomeRecord.project_id == proj.id).scalar()

    return ProjectResponse(
        id=proj.id,
        name=proj.name,
        client_name=proj.client_name,
        description=proj.description,
        location=proj.location,
        start_date=_fmt(proj.start_date),
        end_date=_fmt(proj.end_date),
        budget=proj.budget,
        progress=float(proj.progress or 0),
        status=proj.status or "ongoing",
        notes=proj.notes,
        created_at=_fmt(proj.created_at),
        material_items=items,
        total_material_value=round(float(total_val), 2),
        realized_amount=round(float(realized or 0), 2),
    )

def _build_customer_response(cust: Customer, db: Session) -> CustomerResponse:
    prefs: List[CustomerMaterialPreference] = []
    trucks: List[CustomerTruck] = []
    
    if cust.materials_json:
        try:
            raw = json.loads(cust.materials_json)
            prefs = [CustomerMaterialPreference(**r) for r in raw]
        except Exception:
            pass

    if getattr(cust, "trucks_json", None):
        try:
            raw_trucks = json.loads(cust.trucks_json)
            trucks = [CustomerTruck(**r) for r in raw_trucks]
        except Exception:
            pass

    from sqlalchemy import func as sqlfunc
    total_q = db.query(
        sqlfunc.coalesce(sqlfunc.sum(IncomeRecord.amount), 0)
    ).filter(
        IncomeRecord.customer_name == cust.name,
        IncomeRecord.income_type == "material_sale",
    ).scalar()
    count_q = db.query(IncomeRecord).filter(
        IncomeRecord.customer_name == cust.name,
        IncomeRecord.income_type == "material_sale",
    ).count()

    return CustomerResponse(
        id=cust.id,
        name=cust.name,
        company=cust.company,
        contact_person=cust.contact_person,
        phone=cust.phone,
        email=cust.email,
        address=cust.address,
        notes=cust.notes,
        is_active=bool(cust.is_active),
        material_preferences=prefs,
        trucks=trucks,
        total_purchases=round(float(total_q or 0), 2),
        purchase_count=int(count_q),
    )


# ── META ──────────────────────────────────────────────────────────────────────

@router.get("/meta")
def get_meta(current_user: User = Depends(get_current_user)):
    return {
        "material_types": MATERIAL_TYPES,
        "material_units": MATERIAL_UNITS,
        "all_units": ALL_UNITS,
        "project_statuses": ["ongoing", "completed", "paused", "cancelled"],
    }


# ══════════════════════════════════════════════════════════════════════════════
# PROJECT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════







@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Project)
    if status:
        q = q.filter(Project.status == status)
    projects = q.order_by(Project.created_at.desc()).all()
    return [_build_project_response(p, db) for p in projects]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    return _build_project_response(proj, db)


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat menambah proyek")

    proj = Project(
        name=data.name,
        client_name=data.client_name,
        description=data.description,
        location=data.location,
        start_date=_parse_dt(data.start_date),
        end_date=_parse_dt(data.end_date),
        budget=data.budget,
        status=data.status or "ongoing",
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(proj)
    db.flush()  # get proj.id

    for item in data.material_items:
        db.add(ProjectMaterialItem(
            project_id=proj.id,
            material_type=item.material_type,
            unit=item.unit,
            target_quantity=item.target_quantity,
            unit_price=item.unit_price,
            notes=item.notes,
        ))

    db.commit()
    db.refresh(proj)
    return _build_project_response(proj, db)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat mengupdate proyek")

    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")

    fields = data.model_dump(exclude_unset=True, exclude={"material_items"})
    for k, v in fields.items():
        if k in ("start_date", "end_date"):
            setattr(proj, k, _parse_dt(v))
        else:
            setattr(proj, k, v)

    if data.material_items is not None:
        # replace all
        for old in proj.material_items:
            db.delete(old)
        db.flush()
        for item in data.material_items:
            db.add(ProjectMaterialItem(
                project_id=proj.id,
                material_type=item.material_type,
                unit=item.unit,
                target_quantity=item.target_quantity,
                unit_price=item.unit_price,
                notes=item.notes,
            ))

    db.commit()
    db.refresh(proj)
    return _build_project_response(proj, db)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat menghapus proyek")
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Proyek tidak ditemukan")
    db.delete(proj)
    db.commit()
    return None


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Customer)
    if is_active is not None:
        q = q.filter(Customer.is_active == is_active)
    customers = q.order_by(Customer.name.asc()).all()
    return [_build_customer_response(c, db) for c in customers]


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer tidak ditemukan")
    return _build_customer_response(cust, db)


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat menambah customer")

    prefs_json = json.dumps([p.model_dump() for p in data.material_preferences]) if data.material_preferences else None
    trucks_json = json.dumps([t.model_dump() for t in data.trucks]) if data.trucks else None

    cust = Customer(
        name=data.name,
        company=data.company,
        contact_person=data.contact_person,
        phone=data.phone,
        email=data.email,
        address=data.address,
        notes=data.notes,
        is_active=data.is_active,
        materials_json=prefs_json,
        trucks_json=trucks_json,
        created_by=current_user.id,
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return _build_customer_response(cust, db)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat mengupdate customer")

    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer tidak ditemukan")

    fields = data.model_dump(exclude_unset=True, exclude={"material_preferences", "trucks"})
    for k, v in fields.items():
        setattr(cust, k, v)

    if data.material_preferences is not None:
        cust.materials_json = json.dumps([p.model_dump() for p in data.material_preferences])
        
    if data.trucks is not None:
        cust.trucks_json = json.dumps([t.model_dump() for t in data.trucks])

    db.commit()
    db.refresh(cust)
    return _build_customer_response(cust, db)

@router.post("/customers/{customer_id}/trucks")
def add_customer_truck(
    customer_id: int,
    data: AddTruckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer tidak ditemukan")
        
    trucks = []
    if getattr(cust, "trucks_json", None):
        try:
            raw = json.loads(cust.trucks_json)
            trucks = [CustomerTruck(**r) for r in raw]
        except Exception:
            pass
            
    # Check if already exists and update
    for i, t in enumerate(trucks):
        if t.license_plate.upper() == data.license_plate.upper():
            if data.length is not None: trucks[i].length = data.length
            if data.width is not None: trucks[i].width = data.width
            if data.height is not None: trucks[i].height = data.height
            if data.driver_name: trucks[i].driver_name = data.driver_name
            if data.vehicle_type: trucks[i].vehicle_type = data.vehicle_type
            
            cust.trucks_json = json.dumps([tk.model_dump() for tk in trucks])
            db.commit()
            return {"message": "Truck updated successfully"}
        
    trucks.append(CustomerTruck(
        license_plate=data.license_plate.upper(),
        driver_name=data.driver_name,
        vehicle_type=data.vehicle_type,
        length=data.length,
        width=data.width,
        height=data.height
    ))
    
    cust.trucks_json = json.dumps([t.model_dump() for t in trucks])
    db.commit()
    return {"message": "Truck added successfully"}


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_gm(current_user):
        raise HTTPException(status_code=403, detail="Hanya GM yang dapat menghapus customer")
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer tidak ditemukan")
    db.delete(cust)
    db.commit()
    return None
