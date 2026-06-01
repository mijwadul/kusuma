import json
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.customer import Customer
from ..models.income_record import IncomeRecord
from ..models.user import User
from ..core.exceptions import AuthorizationError, NotFoundError
from ..schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, AddTruckRequest, CustomerTruck, CustomerMaterialPreference

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

    total_q = db.query(
        func.coalesce(func.sum(IncomeRecord.amount), 0)
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

class CustomerService:
    @staticmethod
    def _is_gm(user: User) -> bool:
        return (
            getattr(user, "is_admin", False)
            or getattr(user, "is_superuser", False)
            or getattr(user, "role", "") in ("gm", "admin")
        )

    @staticmethod
    def list_customers(db: Session, is_active: Optional[bool] = None) -> List[CustomerResponse]:
        q = db.query(Customer)
        if is_active is not None:
            q = q.filter(Customer.is_active == is_active)
        customers = q.order_by(Customer.name.asc()).all()
        return [_build_customer_response(c, db) for c in customers]

    @staticmethod
    def get_customer(db: Session, customer_id: int) -> CustomerResponse:
        cust = db.query(Customer).filter(Customer.id == customer_id).first()
        if not cust:
            raise NotFoundError("Customer tidak ditemukan")
        return _build_customer_response(cust, db)

    @staticmethod
    def create_customer(db: Session, current_user: User, data: CustomerCreate) -> CustomerResponse:
        if not CustomerService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat menambah customer")

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

    @staticmethod
    def update_customer(db: Session, current_user: User, customer_id: int, data: CustomerUpdate) -> CustomerResponse:
        if not CustomerService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat mengupdate customer")

        cust = db.query(Customer).filter(Customer.id == customer_id).first()
        if not cust:
            raise NotFoundError("Customer tidak ditemukan")

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

    @staticmethod
    def add_customer_truck(db: Session, customer_id: int, data: AddTruckRequest) -> dict:
        cust = db.query(Customer).filter(Customer.id == customer_id).first()
        if not cust:
            raise NotFoundError("Customer tidak ditemukan")
            
        trucks = []
        if getattr(cust, "trucks_json", None):
            try:
                raw = json.loads(cust.trucks_json)
                trucks = [CustomerTruck(**r) for r in raw]
            except Exception:
                pass
                
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

    @staticmethod
    def delete_customer(db: Session, current_user: User, customer_id: int) -> None:
        if not CustomerService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat menghapus customer")
        cust = db.query(Customer).filter(Customer.id == customer_id).first()
        if not cust:
            raise NotFoundError("Customer tidak ditemukan")
        db.delete(cust)
        db.commit()
