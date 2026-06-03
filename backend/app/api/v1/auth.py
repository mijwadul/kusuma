from datetime import timedelta, datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Cookie
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from jose import jwt, JWTError
from ...core.auth import (
    authenticate_user, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, 
    get_current_user, get_password_hash, require_admin,
    create_refresh_token, SECRET_KEY, ALGORITHM, REFRESH_TOKEN_EXPIRE_DAYS
)
from ...core.limiter import limiter
from ...core.database import get_db
from ...schemas import Token, User, UserCreate, UserUpdate
from ...models import User as UserModel

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

class TokenWithUser(Token):
    user: User

@router.post("/login", response_model=TokenWithUser)
@limiter.limit("5/minute")
def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
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
    
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        data={"sub": user.email},
        expires_delta=refresh_token_expires
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        expires=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="lax",
        secure=False, # Set True in production with HTTPS
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.post("/refresh")
def refresh_token(request: Request, response: Response, refresh_token: Optional[str] = Cookie(None), db: Session = Depends(get_db)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    user = db.query(UserModel).filter(func.lower(UserModel.email) == email.lower()).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "is_admin": user.is_admin, "is_superuser": user.is_superuser}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="refresh_token")
    return {"message": "Logged out successfully"}

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