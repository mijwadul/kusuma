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
from .core.limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


def bootstrap_database():
    """Ensure tables exist and seed default admin on fresh setup."""
    
    # Database migration is now executed manually
    # Database migration is now executed manually
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # Recalculate existing Surat Jalan netto/volume on startup
            try:
                import math
                sjs = conn.execute(text("SELECT id, project_id, bruto, tarra, minus_berat, panjang, lebar, tinggi, minus_tinggi FROM surat_jalan")).fetchall()
                for sj in sjs:
                    project = conn.execute(text("SELECT measurement_type FROM projects WHERE id = :pid"), {"pid": sj.project_id}).fetchone()
                    if not project: continue
                    if project[0] == "tonase":
                        if sj.bruto is not None and sj.tarra is not None:
                            mb = sj.minus_berat or 0.0
                            net = max(0, (sj.bruto - sj.tarra - mb) / 1000.0)
                            conn.execute(text("UPDATE surat_jalan SET netto = :n WHERE id = :id"), {"n": net, "id": sj.id})
                    elif project[0] == "kubikasi":
                        if sj.panjang is not None and sj.lebar is not None and sj.tinggi is not None:
                            mt = sj.minus_tinggi or 0.0
                            raw_vol = (sj.panjang * sj.lebar * max(0, sj.tinggi - mt)) / 1000000.0
                            vol = math.floor(raw_vol * 100) / 100.0
                            conn.execute(text("UPDATE surat_jalan SET volume = :v WHERE id = :id"), {"v": vol, "id": sj.id})
                conn.commit()
            except Exception:
                pass

    except Exception:
        pass

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
    from .core.scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)
app.state.limiter = limiter

app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


from .core.exceptions import AppException

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too Many Requests. Please try again later."},
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
from .api.v1.surat_jalans import router as surat_jalans_router
from .api.v1.hauling import router as hauling_router

# ... inside router inclusion block ...
app.include_router(material_prices_router, prefix="/api/v1/material-prices", tags=["material-prices"])
app.include_router(projects_router, prefix="/api/v1/projects-data", tags=["projects"])
app.include_router(invoices_router, prefix="/api/v1/invoices", tags=["invoices"])
app.include_router(vendors_router, prefix="/api/v1/vendors", tags=["vendors"])
app.include_router(hauling_router, prefix="/api/v1/hauling", tags=["hauling"])
app.include_router(surat_jalans_router, prefix="/api/v1", tags=["surat-jalan"])

@app.get("/")
def read_root():
    return {"message": "Welcome to PT. Kusuma Samudera Berkah API"}
