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
        ("material_prices", "vehicle_type", "VARCHAR(50)"),
        ("income_records", "is_invoiced", "BOOLEAN DEFAULT 0"),
        ("income_records", "invoice_id", "INTEGER"),
        ("attendance", "is_payroll_generated", "BOOLEAN DEFAULT 0"),
        ("attendance", "payroll_id", "INTEGER"),
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

    # Fungsi otomatis tandai data lama
    try:
        from app.core.database import SessionLocal
        from app.models.invoice import Invoice
        from app.models.income_record import IncomeRecord
        from app.models.payroll import PayrollRecord, Attendance

        db = SessionLocal()
        
        # 1. Tandai data IncomeRecord yang sudah ter-invoice
        invoices = db.query(Invoice).all()
        marked_income_count = 0
        for inv in invoices:
            records = db.query(IncomeRecord).filter(
                IncomeRecord.income_type == "material_sale",
                IncomeRecord.customer_name == inv.customer_name,
                IncomeRecord.income_date >= inv.start_date,
                IncomeRecord.income_date <= inv.end_date,
                (IncomeRecord.is_invoiced == False) | (IncomeRecord.is_invoiced == None)
            ).all()
            for r in records:
                r.is_invoiced = True
                r.invoice_id = inv.id
                marked_income_count += 1
        
        # 2. Tandai data Attendance yang sudah dibuatkan slip gaji
        payrolls = db.query(PayrollRecord).all()
        marked_attendance_count = 0
        for p in payrolls:
            attendances = db.query(Attendance).filter(
                Attendance.employee_id == p.employee_id,
                Attendance.date >= p.period_start,
                Attendance.date <= p.period_end,
                (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None)
            ).all()
            for a in attendances:
                a.is_payroll_generated = True
                a.payroll_id = p.id
                marked_attendance_count += 1

        db.commit()
        db.close()
        print(f"✅ Migrasi data lama selesai. Berhasil menandai {marked_income_count} penjualan material dan {marked_attendance_count} absensi.")
    except Exception as e:
        print(f"❌ Error migrasi data lama: {e}")

    print("Selesai mengubah database.")

if __name__ == "__main__":
    alter_db()

