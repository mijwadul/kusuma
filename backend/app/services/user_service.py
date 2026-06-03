from typing import List, Optional
from sqlalchemy.orm import Session
from ..models.user import User as UserModel
from ..schemas import UserCreate, UserUpdate
from ..core.auth import get_password_hash, authenticate_user
from ..core.exceptions import NotFoundError, ValidationError, AuthorizationError

class UserService:
    @staticmethod
    def get_all_users(db: Session) -> List[UserModel]:
        return db.query(UserModel).filter(UserModel.is_active == True).all()

    @staticmethod
    def create_user(db: Session, user: UserCreate) -> UserModel:
        existing = db.query(UserModel).filter(UserModel.email == user.email).first()
        if existing:
            raise ValidationError("Email already registered")
        
        is_admin_user = user.is_admin or user.role in ["admin", "gm"]
        
        db_user = UserModel(
            email=user.email,
            password_hash=get_password_hash(user.password),
            full_name=user.full_name,
            phone=user.phone,
            employee_id=user.employee_id,
            role=user.role,
            is_admin=is_admin_user,
            is_active=user.is_active
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def update_user(db: Session, user_id: int, user_update: UserUpdate) -> UserModel:
        db_user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not db_user:
            raise NotFoundError("User not found")
        
        update_data = user_update.model_dump(exclude_unset=True)
        
        if "password" in update_data and update_data["password"]:
            update_data["password_hash"] = get_password_hash(update_data.pop("password"))
        elif "password" in update_data:
            update_data.pop("password")
        
        if "role" in update_data:
            if update_data["role"] in ["admin", "gm"]:
                update_data["is_admin"] = True
            else:
                update_data["is_admin"] = False
        
        for key, value in update_data.items():
            setattr(db_user, key, value)
        
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def delete_user(db: Session, user_id: int, current_user_id: int) -> None:
        db_user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not db_user:
            raise NotFoundError("User not found")
        
        if db_user.id == current_user_id:
            raise ValidationError("Cannot delete your own account")
        
        db_user.is_active = False
        db.commit()

    @staticmethod
    def change_password(db: Session, user: UserModel, current_password: str, new_password: str) -> None:
        if not authenticate_user(db, user.email, current_password):
            raise AuthorizationError("Incorrect current password")
        
        user.password_hash = get_password_hash(new_password)
        user.password_change_required = False
        db.commit()
        db.refresh(user)
