import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

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
    """Ensure tables exist and default admin can login on fresh setup."""
    Base.metadata.create_all(bind=engine)

    # Jalankan migrasi kolom hanya untuk SQLite (development)
    # Untuk PostgreSQL (production), gunakan Alembic
    if engine.dialect.name == "sqlite":
        _migrate_users_columns_if_needed()
        _migrate_fuel_logs_columns_if_needed()
        _migrate_employees_columns_if_needed()
        _migrate_fuel_prices_columns_if_needed()
        _migrate_work_logs_columns_if_needed()
        _migrate_expenses_if_needed()
        _migrate_income_records_if_needed()
        _migrate_material_prices_if_needed()
        _migrate_customers_if_needed()
        _migrate_projects_columns_if_needed()

    default_admin_email = settings.DEFAULT_ADMIN_EMAIL.strip().lower()
    default_admin_password = settings.DEFAULT_ADMIN_PASSWORD

    db = SessionLocal()
    try:
        from sqlalchemy import func

        existing_admin = (
            db.query(User).filter(func.lower(User.email) == default_admin_email).first()
        )

        if existing_admin is None:
            # Buat admin baru hanya jika belum ada
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
            # Jangan reset password! Hanya pastikan role dan flag sudah benar
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
    """Lifespan event handler (menggantikan @app.on_event yang deprecated)."""
    bootstrap_database()
    yield
    # Tambahkan cleanup saat shutdown di sini jika diperlukan


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# CORS middleware - dikonfigurasi via environment variables
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


def _migrate_users_columns_if_needed():
    """Add missing columns to users table. SQLite only."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "users" not in set(inspector.get_table_names()):
        return

    existing_columns = {col["name"] for col in inspector.get_columns("users")}
    required_columns = {
        "role": "VARCHAR",
        "full_name": "VARCHAR",
        "phone": "VARCHAR",
        "is_superuser": "BOOLEAN",
        "employee_id": "VARCHAR",
        "last_login": "DATETIME",
        "password_change_required": "BOOLEAN",
    }

    with engine.begin() as conn:
        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                conn.execute(
                    text(f'ALTER TABLE users ADD COLUMN "{column_name}" {column_type}')
                )


def _migrate_fuel_logs_columns_if_needed():
    """Patch legacy fuel_logs schema. SQLite only."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "fuel_logs" not in set(inspector.get_table_names()):
        return

    existing_columns = {col["name"] for col in inspector.get_columns("fuel_logs")}
    required_columns = {
        "hour_meter": "FLOAT",
        "liters_filled": "FLOAT",
        "location": "VARCHAR",
        "photo_url": "VARCHAR",
        "recorded_by": "INTEGER",
        "notes": "VARCHAR",
        "refuel_date": "DATETIME",
        "operating_hours": "FLOAT",
    }

    with engine.begin() as conn:
        table_info = conn.execute(text("PRAGMA table_info(fuel_logs)")).fetchall()
        hour_meter_info = next(
            (col for col in table_info if col[1] == "hour_meter"), None
        )

        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                conn.execute(
                    text(
                        f'ALTER TABLE fuel_logs ADD COLUMN "{column_name}" {column_type}'
                    )
                )

        if hour_meter_info and hour_meter_info[3] == 1:
            conn.execute(text("PRAGMA foreign_keys = OFF"))
            conn.execute(text("ALTER TABLE fuel_logs RENAME TO fuel_logs_old"))
            conn.execute(
                text(
                    """
                CREATE TABLE fuel_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    equipment_id INTEGER NOT NULL,
                    hour_meter FLOAT,
                    liters_filled FLOAT NOT NULL,
                    location VARCHAR,
                    photo_url VARCHAR,
                    recorded_by INTEGER,
                    notes VARCHAR,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    operating_hours FLOAT,
                    refuel_date DATETIME NOT NULL,
                    FOREIGN KEY (equipment_id) REFERENCES equipment (id),
                    FOREIGN KEY (recorded_by) REFERENCES users (id)
                )
            """
                )
            )
            conn.execute(
                text(
                    """
                INSERT INTO fuel_logs (
                    id, equipment_id, hour_meter, liters_filled, location,
                    photo_url, recorded_by, notes, created_at, operating_hours, refuel_date
                )
                SELECT
                    id, equipment_id, hour_meter, liters_filled, location,
                    photo_url, recorded_by, notes, created_at, operating_hours, refuel_date
                FROM fuel_logs_old
            """
                )
            )
            conn.execute(text("DROP TABLE fuel_logs_old"))
            conn.execute(text("PRAGMA foreign_keys = ON"))


def _migrate_employees_columns_if_needed():
    """Add missing columns to employees table. SQLite only."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "employees" not in set(inspector.get_table_names()):
        return

    existing_columns = {col["name"] for col in inspector.get_columns("employees")}
    required_columns = {
        "employee_code": "VARCHAR",
        "phone": "VARCHAR",
        "nik": "VARCHAR",
        "address": "TEXT",
        "date_of_birth": "DATE",
        "place_of_birth": "VARCHAR",
        "gender": "VARCHAR",
        "marital_status": "VARCHAR",
        "employment_type": "VARCHAR",
        "join_date": "DATE",
        "resign_date": "DATE",
        "daily_salary": "FLOAT",
        "hourly_overtime_rate": "FLOAT",
        "loan_balance": "FLOAT",
        "loan_deduction_per_period": "FLOAT",
        "debt_to_company": "FLOAT",
        "work_days_per_month": "INTEGER",
        "is_active": "BOOLEAN",
        "bank_name": "VARCHAR",
        "bank_account_number": "VARCHAR",
        "bank_account_name": "VARCHAR",
        "emergency_contact_name": "VARCHAR",
        "emergency_contact_phone": "VARCHAR",
        "emergency_contact_relation": "VARCHAR",
        "user_id": "INTEGER",
    }

    with engine.begin() as conn:
        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                conn.execute(
                    text(
                        f'ALTER TABLE employees ADD COLUMN "{column_name}" {column_type}'
                    )
                )


def _migrate_fuel_prices_columns_if_needed():
    """Create fuel_prices table if it doesn't exist. SQLite only."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "fuel_prices" not in set(inspector.get_table_names()):
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE fuel_prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    price_per_liter FLOAT NOT NULL,
                    fuel_type VARCHAR NOT NULL,
                    effective_date DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER
                )
            """
                )
            )


def _migrate_work_logs_columns_if_needed():
    """Add missing columns to work_logs table. SQLite only."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "work_logs" not in set(inspector.get_table_names()):
        return

    existing_columns = {col["name"] for col in inspector.get_columns("work_logs")}
    required_columns = {
        "rental_discount_hours": "DECIMAL(10,2) DEFAULT 0",
    }

    with engine.begin() as conn:
        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                conn.execute(
                    text(
                        f'ALTER TABLE work_logs ADD COLUMN "{column_name}" {column_type}'
                    )
                )


def _migrate_expenses_if_needed():
    """Create expenses table if it doesn't exist. SQLite only."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    if "expenses" not in set(inspector.get_table_names()):
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE expenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    expense_date DATE NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    description TEXT NOT NULL,
                    amount FLOAT NOT NULL,
                    project_id INTEGER REFERENCES projects(id),
                    receipt_url VARCHAR,
                    notes TEXT,
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                )
            """
                )
            )


def _migrate_income_records_if_needed():
    """Create income_records table if it doesn't exist. SQLite only."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    if "income_records" not in set(inspector.get_table_names()):
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE income_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    income_date DATE NOT NULL,
                    income_type VARCHAR(30) NOT NULL,
                    description TEXT NOT NULL,
                    amount FLOAT NOT NULL,
                    project_id INTEGER REFERENCES projects(id),
                    payment_term VARCHAR(50),
                    customer_name VARCHAR(200),
                    material_type VARCHAR(100),
                    quantity FLOAT,
                    unit VARCHAR(20),
                    unit_price FLOAT,
                    payment_method VARCHAR(20),
                    notes TEXT,
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                )
            """
                )
            )
    
    existing = {col["name"] for col in inspector.get_columns("income_records")}
    new_cols = {
        "license_plate": "VARCHAR(50)",
        "vehicle_type": "VARCHAR(50)"
    }
    with engine.begin() as conn:
        for col, typ in new_cols.items():
            if col not in existing:
                conn.execute(text(f'ALTER TABLE income_records ADD COLUMN "{col}" {typ}'))



def _migrate_material_prices_if_needed():
    """Create material_prices table if it doesn't exist. SQLite only."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    if "material_prices" not in set(inspector.get_table_names()):
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                CREATE TABLE material_prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    material_type VARCHAR(100) NOT NULL,
                    customer_name VARCHAR(200),
                    unit VARCHAR(20) NOT NULL,
                    price_per_unit FLOAT NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    notes TEXT,
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                )
            """
                )
            )



def _migrate_customers_if_needed():
    """Create customers and project_material_items tables if they don't exist. SQLite only."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "customers" not in tables:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) NOT NULL,
                    company VARCHAR(200),
                    contact_person VARCHAR(100),
                    phone VARCHAR(50),
                    email VARCHAR(100),
                    address TEXT,
                    notes TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    materials_json TEXT,
                    created_by INTEGER REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                )
            """))

    if "project_material_items" not in tables:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE project_material_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL REFERENCES projects(id),
                    material_type VARCHAR(100) NOT NULL,
                    unit VARCHAR(20) NOT NULL,
                    target_quantity FLOAT NOT NULL,
                    unit_price FLOAT,
                    notes TEXT
                )
            """))


def _migrate_projects_columns_if_needed():
    """Add new columns to projects table if missing. SQLite only."""
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    if "projects" not in set(inspector.get_table_names()):
        return
    existing = {col["name"] for col in inspector.get_columns("projects")}
    new_cols = {
        "client_name": "VARCHAR(200)",
        "description": "TEXT",
        "notes": "TEXT",
        "created_by": "INTEGER",
    }
    with engine.begin() as conn:
        for col, typ in new_cols.items():
            if col not in existing:
                conn.execute(text(f'ALTER TABLE projects ADD COLUMN "{col}" {typ}'))


# Exception handler — traceback hanya ditampilkan saat DEBUG=True
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
app.include_router(material_prices_router, prefix="/api/v1/material-prices", tags=["material-prices"])
app.include_router(projects_router, prefix="/api/v1/projects-data", tags=["projects"])


@app.get("/")
def read_root():
    return {"message": "Welcome to PT. Kusuma Samudera Berkah API"}
