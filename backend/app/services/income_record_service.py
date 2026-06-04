import json
import math
from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.income_record import IncomeRecord
from ..models.project import Project
from ..models.customer import Customer
from ..models.user import User
from ..core.exceptions import AuthorizationError, NotFoundError, ValidationError
from ..schemas.income_record import IncomeRecordCreate, IncomeRecordUpdate, BulkSuratJalanUpdate, IncomeRecordResponse
from ..services.material_price_service import MaterialPriceService

class IncomeRecordService:
    @staticmethod
    def _build_income_response(record: IncomeRecord, db: Session) -> IncomeRecordResponse:
        project_name: Optional[str] = None
        if record.project_id:
            proj = db.query(Project).filter(Project.id == record.project_id).first()
            project_name = proj.name if proj else None

        return IncomeRecordResponse(
            id=record.id,
            income_date=record.income_date,
            income_type=record.income_type,
            description=record.description,
            amount=record.amount,
            project_id=record.project_id,
            payment_term=record.payment_term,
            customer_name=record.customer_name,
            material_type=record.material_type,
            quantity=record.quantity,
            unit=record.unit,
            unit_price=record.unit_price,
            payment_method=record.payment_method,
            license_plate=record.license_plate,
            driver_name=record.driver_name,
            vehicle_type=record.vehicle_type,
            notes=record.notes,
            created_by=record.created_by,
            created_at=record.created_at,
            project_name=project_name,
        )

    @staticmethod
    def get_income_records(
        db: Session,
        income_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        income_type: Optional[str] = None
    ) -> List[IncomeRecordResponse]:
        query = db.query(IncomeRecord)

        if income_date is not None:
            query = query.filter(IncomeRecord.income_date == income_date)
        if start_date is not None:
            query = query.filter(IncomeRecord.income_date >= start_date)
        if end_date is not None:
            query = query.filter(IncomeRecord.income_date <= end_date)
        if income_type is not None:
            query = query.filter(IncomeRecord.income_type == income_type)

        records = query.order_by(
            IncomeRecord.income_date.desc(), IncomeRecord.id.desc()
        ).all()
        return [IncomeRecordService._build_income_response(r, db) for r in records]

    @staticmethod
    def create_income_record(db: Session, current_user: User, data: IncomeRecordCreate) -> IncomeRecordResponse:
        if data.income_type == "material_sale":
            existing = db.query(IncomeRecord).filter(
                IncomeRecord.income_type == data.income_type,
                IncomeRecord.income_date == data.income_date,
                IncomeRecord.customer_name == data.customer_name,
                IncomeRecord.license_plate == data.license_plate,
                IncomeRecord.material_type == data.material_type,
                IncomeRecord.quantity == data.quantity,
                IncomeRecord.amount == data.amount
            ).first()
            if existing:
                raise ValidationError("Surat jalan / Penjualan dengan data yang identik persis sudah ada di sistem.")
        else:
            existing = db.query(IncomeRecord).filter(
                IncomeRecord.income_type == data.income_type,
                IncomeRecord.income_date == data.income_date,
                IncomeRecord.amount == data.amount,
                IncomeRecord.description == data.description
            ).first()
            if existing:
                raise ValidationError("Data pemasukan dengan nominal dan deskripsi yang sama di tanggal ini sudah ada.")

        customer_id_val = data.customer_id
        customer_name_val = data.customer_name

        if data.income_type == "material_sale" and data.customer_name:
            cust_name = data.customer_name.strip()
            customer = db.query(Customer).filter(Customer.name.ilike(cust_name)).first()
            if not customer:
                customer = Customer(name=cust_name, created_by=current_user.id if current_user else None)
                db.add(customer)
                db.flush()
            
            customer_id_val = customer.id
            customer_name_val = customer.name
            
            if data.license_plate:
                plate = data.license_plate.strip().upper()
                trucks = []
                if customer.trucks_json:
                    try:
                        trucks = json.loads(customer.trucks_json)
                    except Exception:
                        pass
                
                updated = False
                found = False
                for t in trucks:
                    if t.get("license_plate", "").upper() == plate:
                        found = True
                        if data.driver_name and t.get("driver_name") != data.driver_name:
                            t["driver_name"] = data.driver_name
                            updated = True
                        if data.vehicle_type and t.get("vehicle_type") != data.vehicle_type:
                            t["vehicle_type"] = data.vehicle_type
                            updated = True
                        break
                
                if not found:
                    trucks.append({
                        "license_plate": plate,
                        "driver_name": data.driver_name or "",
                        "vehicle_type": data.vehicle_type or "Colt Diesel"
                    })
                    updated = True
                    
                if updated:
                    customer.trucks_json = json.dumps(trucks)
                    db.add(customer)

        record = IncomeRecord(
            income_date=data.income_date,
            income_type=data.income_type,
            description=data.description,
            amount=data.amount,
            project_id=data.project_id,
            payment_term=data.payment_term,
            customer_id=customer_id_val,
            customer_name=customer_name_val,
            material_type=data.material_type,
            quantity=data.quantity,
            unit=data.unit,
            unit_price=data.unit_price,
            payment_method=data.payment_method,
            license_plate=data.license_plate,
            driver_name=data.driver_name,
            vehicle_type=data.vehicle_type,
            
            sj_length=data.sj_length,
            sj_width=data.sj_width,
            sj_height=data.sj_height,
            sj_volume_minus=data.sj_volume_minus,
            sj_gross_weight=data.sj_gross_weight,
            sj_tare_weight=data.sj_tare_weight,
            sj_weight_minus=data.sj_weight_minus,
            
            notes=data.notes,
            created_by=current_user.id if current_user else None,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return IncomeRecordService._build_income_response(record, db)

    @staticmethod
    def bulk_update_surat_jalan(db: Session, data: BulkSuratJalanUpdate) -> dict:
        updated_count = 0
        for item in data.items:
            record = db.query(IncomeRecord).filter(IncomeRecord.id == item.id).first()
            if not record:
                continue
                
            record.unit = item.unit
            
            if item.unit == "m3":
                record.sj_length = item.sj_length
                record.sj_width = item.sj_width
                record.sj_height = item.sj_height
                record.sj_volume_minus = item.sj_volume_minus or 0.0
                
                p = float(item.sj_length or 0)
                l = float(item.sj_width or 0)
                t = float(item.sj_height or 0)
                m = float(item.sj_volume_minus or 0)
                
                record.quantity = (p * l * max(0, t - m)) / 1000000.0
                
            elif item.unit == "ton":
                record.sj_gross_weight = item.sj_gross_weight or 0.0
                record.sj_tare_weight = item.sj_tare_weight or 0.0
                record.sj_weight_minus = item.sj_weight_minus or 0.0
                
                b1 = float(item.sj_gross_weight or 0)
                b2 = float(item.sj_tare_weight or 0)
                m = float(item.sj_weight_minus or 0)
                record.quantity = max(0, b1 - b2 - m)
                
            if item.unit == "m3" and record.customer_name and record.license_plate and data.truck_updates:
                tu = next((t for t in data.truck_updates if t.license_plate == record.license_plate), None)
                if tu:
                    customer = db.query(Customer).filter(Customer.name.ilike(record.customer_name)).first()
                    if customer and customer.trucks_json:
                        try:
                            trucks = json.loads(customer.trucks_json)
                            truck_updated = False
                            for t_dict in trucks:
                                if t_dict.get("license_plate", "").upper() == tu.license_plate.upper():
                                    if tu.length is not None and t_dict.get("length") != tu.length:
                                        t_dict["length"] = tu.length
                                        truck_updated = True
                                    if tu.width is not None and t_dict.get("width") != tu.width:
                                        t_dict["width"] = tu.width
                                        truck_updated = True
                                    if tu.height is not None and t_dict.get("height") != tu.height:
                                        t_dict["height"] = tu.height
                                        truck_updated = True
                                    break
                            if truck_updated:
                                customer.trucks_json = json.dumps(trucks)
                                db.add(customer)
                        except Exception:
                            pass
            
            price_info = MaterialPriceService.lookup_price(
                db=db,
                material_type=record.material_type,
                unit=record.unit,
                customer_name=record.customer_name,
                vehicle_type=record.vehicle_type
            )
                
            if price_info.get("found"):
                record.unit_price = float(price_info["price_per_unit"])
            else:
                raise ValidationError(
                    f"Harga untuk material {record.material_type} dengan satuan {record.unit} belum diatur. Silakan atur harga di menu Atur Harga (GM) terlebih dahulu."
                )
                
            if record.quantity is not None:
                record.quantity = math.floor(record.quantity * 100) / 100.0
                
            record.amount = float(record.quantity or 0) * record.unit_price
            updated_count += 1

        db.commit()
        return {"message": f"Berhasil mengupdate {updated_count} riwayat surat jalan"}

    @staticmethod
    def debug_price(db: Session, record_id: int) -> dict:
        record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
        if not record: return {"error": "not found"}
        
        cust = db.query(Customer).filter(Customer.name == record.customer_name).first()
        prefs = []
        if cust and cust.materials_json:
            prefs = json.loads(cust.materials_json)
            
        price_info = MaterialPriceService.lookup_price(
            db=db,
            material_type=record.material_type,
            unit=record.unit,
            customer_name=record.customer_name,
            vehicle_type=record.vehicle_type
        )
        
        return {
            "record": {
                "material_type": record.material_type,
                "unit": record.unit,
                "customer_name": record.customer_name,
                "vehicle_type": record.vehicle_type,
                "quantity": record.quantity,
                "unit_price": record.unit_price,
                "amount": record.amount
            },
            "customer_prefs": prefs,
            "price_info": price_info
        }

    @staticmethod
    def update_income_record(db: Session, current_user: User, record_id: int, data: IncomeRecordUpdate) -> IncomeRecordResponse:
        record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
        if not record:
            raise NotFoundError("Income record not found")

        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm")
        )
        if not is_admin_or_gm and record.created_by != current_user.id:
            raise AuthorizationError("Not authorized to update this record")

        update_data = data.model_dump(exclude_unset=True)
        
        if update_data.get("income_type") == "material_sale" or (record.income_type == "material_sale" and "customer_name" in update_data):
            cust_name = update_data.get("customer_name", record.customer_name)
            if cust_name:
                cust_name = cust_name.strip()
                customer = db.query(Customer).filter(Customer.name.ilike(cust_name)).first()
                if not customer:
                    customer = Customer(name=cust_name, created_by=current_user.id if current_user else None)
                    db.add(customer)
                    db.flush()
                update_data["customer_name"] = customer.name
                update_data["customer_id"] = customer.id

        for field, value in update_data.items():
            setattr(record, field, value)
            
        if record.income_type == "material_sale" and record.customer_name and record.license_plate:
            cust_name = record.customer_name.strip()
            customer = db.query(Customer).filter(Customer.name.ilike(cust_name)).first()
            if customer:
                plate = record.license_plate.strip().upper()
                trucks = []
                if customer.trucks_json:
                    try:
                        trucks = json.loads(customer.trucks_json)
                    except Exception:
                        pass
                
                updated = False
                found = False
                for t in trucks:
                    if t.get("license_plate", "").upper() == plate:
                        found = True
                        if record.driver_name and t.get("driver_name") != record.driver_name:
                            t["driver_name"] = record.driver_name
                            updated = True
                        if record.vehicle_type and t.get("vehicle_type") != record.vehicle_type:
                            t["vehicle_type"] = record.vehicle_type
                            updated = True
                        break
                
                if not found:
                    trucks.append({
                        "license_plate": plate,
                        "driver_name": record.driver_name or "",
                        "vehicle_type": record.vehicle_type or "Colt Diesel"
                    })
                    updated = True
                    
                if updated:
                    customer.trucks_json = json.dumps(trucks)
                    db.add(customer)

        db.commit()
        db.refresh(record)
        return IncomeRecordService._build_income_response(record, db)

    @staticmethod
    def delete_income_record(db: Session, current_user: User, record_id: int) -> None:
        record = db.query(IncomeRecord).filter(IncomeRecord.id == record_id).first()
        if not record:
            raise NotFoundError("Income record not found")

        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm")
        )
        if not is_admin_or_gm:
            raise AuthorizationError("Admin/GM access required")

        db.delete(record)
        db.commit()
