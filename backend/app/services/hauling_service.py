from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from ..models.vendor_truck import VendorTruck
from ..models.project_hauling_price import ProjectHaulingPrice
from ..models.vendor import Vendor
from ..models.project import Project
from ..schemas.vendor_truck import VendorTruckCreate, VendorTruckUpdate
from ..schemas.project_hauling_price import ProjectHaulingPriceCreate, ProjectHaulingPriceUpdate
from ..models.user import User

class HaulingService:
    @staticmethod
    def get_vendor_trucks(db: Session, vendor_id: int) -> List[VendorTruck]:
        return db.query(VendorTruck).filter(VendorTruck.vendor_id == vendor_id).all()

    @staticmethod
    def create_vendor_truck(db: Session, data: VendorTruckCreate) -> VendorTruck:
        vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor tidak ditemukan")
            
        truck = VendorTruck(**data.model_dump())
        db.add(truck)
        db.commit()
        db.refresh(truck)
        return truck

    @staticmethod
    def update_vendor_truck(db: Session, truck_id: int, data: VendorTruckUpdate) -> VendorTruck:
        truck = db.query(VendorTruck).filter(VendorTruck.id == truck_id).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truk tidak ditemukan")
            
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(truck, key, value)
            
        db.commit()
        db.refresh(truck)
        return truck

    @staticmethod
    def delete_vendor_truck(db: Session, truck_id: int) -> None:
        truck = db.query(VendorTruck).filter(VendorTruck.id == truck_id).first()
        if not truck:
            raise HTTPException(status_code=404, detail="Truk tidak ditemukan")
        db.delete(truck)
        db.commit()

    @staticmethod
    def get_project_prices(db: Session, project_id: int) -> List[ProjectHaulingPrice]:
        return db.query(ProjectHaulingPrice).filter(ProjectHaulingPrice.project_id == project_id).all()

    @staticmethod
    def set_project_price(db: Session, data: ProjectHaulingPriceCreate) -> ProjectHaulingPrice:
        price = db.query(ProjectHaulingPrice).filter(
            ProjectHaulingPrice.project_id == data.project_id,
            ProjectHaulingPrice.vendor_id == data.vendor_id
        ).first()
        
        if price:
            price.price_per_unit = data.price_per_unit
        else:
            price = ProjectHaulingPrice(**data.model_dump())
            db.add(price)
            
        db.commit()
        db.refresh(price)
        return price
