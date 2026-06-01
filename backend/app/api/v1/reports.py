from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.user import User

from ...schemas.report import RangeReport, CashFlowReport
from ...services.report_service import ReportService

router = APIRouter()

@router.get("/range", response_model=RangeReport)
def get_range_report(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_range_report(db, start_date, end_date)

@router.get("/cashflow", response_model=CashFlowReport)
def get_cash_flow_report(
    start_date: date,
    end_date: date,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_cash_flow_report(db, start_date, end_date, project_id)
