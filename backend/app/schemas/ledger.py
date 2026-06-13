from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime

class LedgerItem(BaseModel):
    id: str  # e.g., "topup_1", "worklog_2", "rate_3"
    type: str  # "topup", "worklog", "rate_change"
    date: datetime
    description: str
    amount: Decimal  # Positive for topups, negative for worklogs, 0 for rate change
    running_balance: Decimal
    
    # Optional metadata depending on type
    hours: Optional[float] = None
    applied_rate: Optional[Decimal] = None
    old_rate: Optional[Decimal] = None
    new_rate: Optional[Decimal] = None
    split_details: Optional[str] = None

    class Config:
        from_attributes = True
