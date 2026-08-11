from typing import List
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.auth import get_current_user, require_role
from ...core.database import get_db
from ...core.exceptions import NotFoundError
from ...models.user import User
from ...models.bank_account import BankAccount

router = APIRouter()

class BankAccountBase(BaseModel):
    bank_name: str
    account_number: str
    account_name: str
    is_active: bool = True

class BankAccountCreate(BankAccountBase):
    pass

class BankAccountUpdate(BankAccountBase):
    pass

class BankAccountResponse(BankAccountBase):
    id: int

    class Config:
        from_attributes = True


@router.get("", response_model=List[BankAccountResponse])
def get_bank_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(BankAccount).filter(BankAccount.is_active == True).all()

@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
def create_bank_account(
    data: BankAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "gm", "finance"]))
):
    new_account = BankAccount(
        bank_name=data.bank_name,
        account_number=data.account_number,
        account_name=data.account_name,
        is_active=data.is_active
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

@router.put("/{account_id}", response_model=BankAccountResponse)
def update_bank_account(
    account_id: int,
    data: BankAccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "gm", "finance"]))
):
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise NotFoundError("Bank account not found")
        
    account.bank_name = data.bank_name
    account.account_number = data.account_number
    account.account_name = data.account_name
    account.is_active = data.is_active
    
    db.commit()
    db.refresh(account)
    return account

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bank_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "gm", "finance"]))
):
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise NotFoundError("Bank account not found")
        
    account.is_active = False
    db.commit()
    return None
