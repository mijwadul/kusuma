from sqlalchemy import Boolean, Column, Integer, String
from .base import Base

class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    bank_name = Column(String(100), nullable=False)
    account_number = Column(String(100), nullable=False)
    account_name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
