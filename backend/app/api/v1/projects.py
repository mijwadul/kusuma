from typing import List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.material_price import MATERIAL_TYPES, MATERIAL_UNITS, ALL_UNITS
from ...models.user import User

from ...schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from ...schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, AddTruckRequest

from ...services.project_service import ProjectService
from ...services.customer_service import CustomerService

router = APIRouter()

@router.get("/meta")
def get_meta(current_user: User = Depends(get_current_user)):
    return {
        "material_types": MATERIAL_TYPES,
        "material_units": MATERIAL_UNITS,
        "all_units": ALL_UNITS,
        "project_statuses": ["ongoing", "completed", "paused", "cancelled"],
    }

@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProjectService.list_projects(db, status)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProjectService.get_project(db, project_id)


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProjectService.create_project(db, current_user, data)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProjectService.update_project(db, current_user, project_id, data)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ProjectService.delete_project(db, current_user, project_id)
    return None

@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CustomerService.list_customers(db, is_active)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CustomerService.get_customer(db, customer_id)


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CustomerService.create_customer(db, current_user, data)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CustomerService.update_customer(db, current_user, customer_id, data)

@router.post("/customers/{customer_id}/trucks")
def add_customer_truck(
    customer_id: int,
    data: AddTruckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CustomerService.add_customer_truck(db, customer_id, data)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CustomerService.delete_customer(db, current_user, customer_id)
    return None
