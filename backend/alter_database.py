import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

# Add the backend directory to sys.path so we can import from app
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.config import settings

def alter_db():
    print(f"Menggunakan database: {settings.DATABASE_URL}")
    
    engine = create_engine(settings.DATABASE_URL)
    
    # (table_name, col_name, col_type)
    columns_to_add = [
        ("income_records", "sj_length", "FLOAT"),
        ("income_records", "sj_width", "FLOAT"),
        ("income_records", "sj_height", "FLOAT"),
        ("income_records", "sj_volume_minus", "FLOAT"),
        ("income_records", "sj_gross_weight", "FLOAT"),
        ("income_records", "sj_tare_weight", "FLOAT"),
        ("income_records", "sj_weight_minus", "FLOAT"),
        ("income_records", "driver_name", "VARCHAR(100)"),
        ("fuel_prices", "vendor_name", "VARCHAR(200)"),
        ("fuel_prices", "payment_status", "VARCHAR(20) DEFAULT 'unpaid'"),
        ("fuel_prices", "paid_by", "INTEGER"),
        ("fuel_prices", "paid_at", "DATETIME"),
        ("customers", "trucks_json", "TEXT"),
        ("invoices", "status", "VARCHAR(20) DEFAULT 'unpaid'"),
        ("fuel_prices", "project_id", "INTEGER"),
        ("payroll_records", "project_id", "INTEGER"),
        ("vendor_topups", "project_id", "INTEGER"),
    ]

    with engine.begin() as conn:
        for table_name, col_name, col_type in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                print(f"✅ Kolom {col_name} berhasil ditambahkan ke {table_name}.")
            except OperationalError as e:
                # Menangani error jika kolom sudah ada. MySQL dan SQLite memiliki pesan error berbeda
                error_msg = str(e).lower()
                if "duplicate column" in error_msg or "duplicate column name" in error_msg:
                    print(f"⚠️ Kolom {col_name} sudah ada di {table_name}, dilewati.")
                else:
                    print(f"⚠️ Kolom {col_name} mungkin sudah ada di {table_name} (atau error lain): {e}")
            except Exception as e:
                print(f"❌ Error menambahkan kolom {col_name} ke {table_name}: {e}")

    print("Selesai mengubah database.")

if __name__ == "__main__":
    alter_db()
