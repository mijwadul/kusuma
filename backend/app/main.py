import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.v1.auth import router as auth_router
from .api.v1.dashboard import router as dashboard_router
from .api.v1.employees import router as employees_router
from .api.v1.equipment import router as equipment_router
from .api.v1.expenses import router as expenses_router
from .api.v1.fuel import router as fuel_router
from .api.v1.income_records import router as income_records_router
from .api.v1.work_logs import router as work_logs_router
from .api.v1.reports import router as reports_router
from .api.v1.material_prices import router as material_prices_router
from .api.v1.projects import router as projects_router
from .core.auth import get_password_hash
from .core.config import settings
from .core.database import SessionLocal, engine
from .models import Base, User


def bootstrap_database():
    """Ensure tables exist and seed default admin on fresh setup."""
    Base.metadata.create_all(bind=engine)
    


    default_admin_email = settings.DEFAULT_ADMIN_EMAIL.strip().lower()
    default_admin_password = settings.DEFAULT_ADMIN_PASSWORD

    db = SessionLocal()
    try:
        from sqlalchemy import func

        existing_admin = (
            db.query(User).filter(func.lower(User.email) == default_admin_email).first()
        )

        if existing_admin is None:
            db.add(
                User(
                    email=default_admin_email,
                    password_hash=get_password_hash(default_admin_password),
                    role="gm",
                    is_admin=True,
                    is_superuser=True,
                    is_active=True,
                    password_change_required=True,
                )
            )
        else:
            if existing_admin.role != "gm":
                existing_admin.role = "gm"
            if not existing_admin.is_admin:
                existing_admin.is_admin = True
            if not existing_admin.is_superuser:
                existing_admin.is_superuser = True

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler."""
    bootstrap_database()
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback_str = traceback.format_exc()
    print(f"ERROR: {exc}")
    print(f"TRACEBACK: {traceback_str}")

    content: dict = {"detail": "Internal server error. Hubungi administrator."}
    if settings.DEBUG:
        content["detail"] = str(exc)
        content["traceback"] = traceback_str

    return JSONResponse(status_code=500, content=content)


app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(equipment_router, prefix="/api/v1/equipment", tags=["equipment"])
app.include_router(fuel_router, prefix="/api/v1/fuel", tags=["fuel"])
app.include_router(work_logs_router, prefix="/api/v1/work-logs", tags=["work-logs"])
app.include_router(employees_router, prefix="/api/v1/employees", tags=["employees"])
app.include_router(expenses_router, prefix="/api/v1/expenses", tags=["expenses"])
app.include_router(
    income_records_router, prefix="/api/v1/income-records", tags=["income-records"]
)
app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])
from .api.v1.projects import router as projects_router
from .api.v1.invoices import router as invoices_router
from .api.v1.vendors import router as vendors_router

# ... inside router inclusion block ...
app.include_router(material_prices_router, prefix="/api/v1/material-prices", tags=["material-prices"])
app.include_router(projects_router, prefix="/api/v1/projects-data", tags=["projects"])
app.include_router(invoices_router, prefix="/api/v1/invoices", tags=["invoices"])
app.include_router(vendors_router, prefix="/api/v1/vendors", tags=["vendors"])

@app.get("/")
def read_root():
    return {"message": "Welcome to PT. Kusuma Samudera Berkah API"}
