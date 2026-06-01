from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ...core.auth import authenticate_user, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user, get_password_hash, require_admin
from ...core.database import get_db
from ...schemas import Token, User, UserCreate, UserUpdate
from ...models import User as UserModel

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

class TokenWithUser(Token):
    user: User

@router.post("/login", response_model=TokenWithUser)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "is_admin": user.is_admin, "is_superuser": user.is_superuser}, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=User)
def get_current_user_info(current_user: UserModel = Depends(get_current_user)):
    return current_user

from ...services.user_service import UserService

# User Management Endpoints (Admin only)
@router.get("/users", response_model=List[User])
def get_users(db: Session = Depends(get_db), admin_user: UserModel = Depends(require_admin)):
    return UserService.get_all_users(db)

@router.post("/users", response_model=User)
def create_user(user: UserCreate, db: Session = Depends(get_db), admin_user: UserModel = Depends(require_admin)):
    return UserService.create_user(db, user)

@router.put("/users/{user_id}", response_model=User)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db), admin_user: UserModel = Depends(require_admin)):
    return UserService.update_user(db, user_id, user_update)

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin_user: UserModel = Depends(require_admin)):
    UserService.delete_user(db, user_id, admin_user.id)
    return {"message": "User deleted successfully"}

@router.post("/change-password")
def change_password(
    current_password: str,
    new_password: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Change password for current user"""
    UserService.change_password(db, current_user, current_password, new_password)
    return {"message": "Password changed successfully"}