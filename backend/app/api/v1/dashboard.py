from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...core.auth import get_current_user
from ...core.database import get_db
from ...schemas import Employee as EmployeeSchema
from ...schemas import Equipment as EquipmentSchema
from ...schemas import ProjectResponse as ProjectSchema
from ...services.dashboard_service import DashboardService

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    return DashboardService.get_dashboard_stats(db)


@router.get("/payroll-summary")
def get_payroll_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return DashboardService.get_payroll_summary(db)


@router.get("/equipment")
def get_equipment(db: Session = Depends(get_db)):
    equipment = DashboardService.get_equipment(db)
    return [EquipmentSchema.model_validate(eq) for eq in equipment]


@router.get("/employees")
def get_employees(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    employees = DashboardService.get_employees(db, current_user)
    return [EmployeeSchema.model_validate(emp) for emp in employees]


@router.get("/projects")
def get_projects(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from ...services.project_service import ProjectService
    return ProjectService.list_projects(db, current_user)


@router.get("/daily-report")
def get_daily_report(
    report_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return DashboardService.get_daily_report(db, report_date)


@router.get("/daily-report/history")
def get_daily_report_history(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return DashboardService.get_daily_report_history(db, days)


@router.get("/finance-summary")
def get_finance_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return DashboardService.get_finance_summary(db)
