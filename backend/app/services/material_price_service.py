import json
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.material_price import MaterialPrice, MATERIAL_TYPES, ALL_UNITS, MATERIAL_UNITS
from ..models.customer import Customer
from ..models.user import User
from ..core.exceptions import AuthorizationError, NotFoundError, ValidationError
from ..schemas.material_price import MaterialPriceCreate, MaterialPriceUpdate

class MaterialPriceService:
    @staticmethod
    def _is_gm(user: User) -> bool:
        return (
            getattr(user, "is_admin", False)
            or getattr(user, "is_superuser", False)
            or getattr(user, "role", "") in ("gm", "admin")
        )

    @staticmethod
    def lookup_price(
        db: Session,
        material_type: str,
        unit: str,
        customer_name: Optional[str] = None,
        vehicle_type: Optional[str] = None,
    ) -> dict:
        if customer_name and customer_name.strip():
            cust = db.query(Customer).filter(Customer.name == customer_name.strip()).first()
            if cust and cust.materials_json:
                try:
                    prefs = json.loads(cust.materials_json)
                    for p in prefs:
                        pref_mat = str(p.get("material_type") or "").strip().lower()
                        rec_mat = str(material_type or "").strip().lower()
                        pref_unit = str(p.get("unit") or "").strip().lower()
                        rec_unit = str(unit or "").strip().lower()
                        
                        if pref_mat == rec_mat and pref_unit == rec_unit:
                            if p.get("vehicle_type") and vehicle_type:
                                pref_veh = str(p.get("vehicle_type")).strip().lower()
                                rec_veh = str(vehicle_type).strip().lower()
                                if pref_veh != rec_veh:
                                    continue
                            if p.get("unit_price"):
                                return {
                                    "found": True,
                                    "price_per_unit": float(p["unit_price"]),
                                    "unit": unit,
                                    "is_custom": True,
                                }
                except Exception:
                    pass

        default = None
        if vehicle_type:
            default = (
                db.query(MaterialPrice)
                .filter(
                    MaterialPrice.material_type == material_type,
                    MaterialPrice.unit == unit,
                    MaterialPrice.customer_name == None,
                    MaterialPrice.vehicle_type == vehicle_type,
                    MaterialPrice.is_active == True,
                )
                .first()
            )
        
        if not default:
            default = (
                db.query(MaterialPrice)
                .filter(
                    MaterialPrice.material_type == material_type,
                    MaterialPrice.unit == unit,
                    MaterialPrice.customer_name == None,
                    MaterialPrice.vehicle_type == None,
                    MaterialPrice.is_active == True,
                )
                .first()
            )

        if default:
            return {
                "found": True,
                "price_per_unit": float(default.price_per_unit),
                "unit": default.unit,
                "is_custom": False,
            }
        
        return {"found": False}

    @staticmethod
    def get_material_meta() -> dict:
        return {
            "material_types": MATERIAL_TYPES,
            "all_units": ALL_UNITS,
            "material_units": MATERIAL_UNITS,
        }

    @staticmethod
    def list_prices(db: Session, material_type: Optional[str] = None, customer_name: Optional[str] = None, is_active: Optional[bool] = None) -> List[MaterialPrice]:
        q = db.query(MaterialPrice)
        if material_type:
            q = q.filter(MaterialPrice.material_type == material_type)
        if customer_name is not None:
            if customer_name == "":
                q = q.filter(MaterialPrice.customer_name == None)
            else:
                q = q.filter(MaterialPrice.customer_name == customer_name)
        if is_active is not None:
            q = q.filter(MaterialPrice.is_active == is_active)
        return q.order_by(
            MaterialPrice.material_type.asc(),
            MaterialPrice.customer_name.asc(),
            MaterialPrice.unit.asc(),
        ).all()

    @staticmethod
    def create_price(db: Session, current_user: User, data: MaterialPriceCreate) -> MaterialPrice:
        if not MaterialPriceService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat mengelola harga material")

        existing = (
            db.query(MaterialPrice)
            .filter(
                MaterialPrice.material_type == data.material_type,
                MaterialPrice.unit == data.unit,
                MaterialPrice.customer_name == None,
                MaterialPrice.vehicle_type == data.vehicle_type,
            )
            .first()
        )
        if existing:
            veh_str = data.vehicle_type if data.vehicle_type else "Semua Kendaraan"
            raise ValidationError(f"Harga default untuk {data.material_type} / {data.unit} ({veh_str}) sudah ada. Gunakan edit.")

        mp = MaterialPrice(
            material_type=data.material_type,
            customer_name=None,
            vehicle_type=data.vehicle_type,
            unit=data.unit,
            price_per_unit=data.price_per_unit,
            is_active=data.is_active,
            notes=data.notes,
            created_by=current_user.id,
        )
        db.add(mp)
        db.commit()
        db.refresh(mp)
        return mp

    @staticmethod
    def update_price(db: Session, current_user: User, price_id: int, data: MaterialPriceUpdate) -> MaterialPrice:
        if not MaterialPriceService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat mengelola harga material")

        mp = db.query(MaterialPrice).filter(MaterialPrice.id == price_id).first()
        if not mp:
            raise NotFoundError("Data harga tidak ditemukan")

        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "customer_name":
                continue
            setattr(mp, field, value)

        db.commit()
        db.refresh(mp)
        return mp

    @staticmethod
    def delete_price(db: Session, current_user: User, price_id: int) -> None:
        if not MaterialPriceService._is_gm(current_user):
            raise AuthorizationError("Hanya GM yang dapat mengelola harga material")

        mp = db.query(MaterialPrice).filter(MaterialPrice.id == price_id).first()
        if not mp:
            raise NotFoundError("Data harga tidak ditemukan")

        db.delete(mp)
        db.commit()
