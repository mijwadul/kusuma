import sys
import os

# Menambahkan path agar bisa meng-import dari 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import SessionLocal

def cleanup_orphaned_records():
    print("Mulai membersihkan data orphaned (yatim) di database...")
    db = SessionLocal()
    
    try:
        # Daftar query untuk membersihkan orphaned foreign keys
        queries = [
            {
                "description": "1. Membersihkan attendance.payroll_id",
                "sql": """
                    UPDATE attendance a
                    LEFT JOIN payroll_records pr ON a.payroll_id = pr.id
                    SET a.payroll_id = NULL
                    WHERE a.payroll_id IS NOT NULL AND pr.id IS NULL;
                """
            },
            {
                "description": "2. Membersihkan fuel_prices.project_id",
                "sql": """
                    UPDATE fuel_prices f
                    LEFT JOIN projects p ON f.project_id = p.id
                    SET f.project_id = NULL
                    WHERE f.project_id IS NOT NULL AND p.id IS NULL;
                """
            },
            {
                "description": "3. Membersihkan fuel_prices.paid_by",
                "sql": """
                    UPDATE fuel_prices f
                    LEFT JOIN users u ON f.paid_by = u.id
                    SET f.paid_by = NULL
                    WHERE f.paid_by IS NOT NULL AND u.id IS NULL;
                """
            },
            {
                "description": "4. Membersihkan income_records.invoice_id",
                "sql": """
                    UPDATE income_records i
                    LEFT JOIN invoices inv ON i.invoice_id = inv.id
                    SET i.invoice_id = NULL
                    WHERE i.invoice_id IS NOT NULL AND inv.id IS NULL;
                """
            },
            {
                "description": "5. Membersihkan payroll_records.project_id",
                "sql": """
                    UPDATE payroll_records pr
                    LEFT JOIN projects p ON pr.project_id = p.id
                    SET pr.project_id = NULL
                    WHERE pr.project_id IS NOT NULL AND p.id IS NULL;
                """
            },
            {
                "description": "6. Membersihkan vendor_topups.equipment_id",
                "sql": """
                    UPDATE vendor_topups vt
                    LEFT JOIN equipment e ON vt.equipment_id = e.id
                    SET vt.equipment_id = NULL
                    WHERE vt.equipment_id IS NOT NULL AND e.id IS NULL;
                """
            },
            {
                "description": "7. Membersihkan vendor_topups.project_id",
                "sql": """
                    UPDATE vendor_topups vt
                    LEFT JOIN projects p ON vt.project_id = p.id
                    SET vt.project_id = NULL
                    WHERE vt.project_id IS NOT NULL AND p.id IS NULL;
                """
            }
        ]
        
        total_affected = 0
        for q in queries:
            print(f"Menjalankan: {q['description']}")
            result = db.execute(text(q["sql"]))
            print(f"   -> Berhasil membersihkan {result.rowcount} baris data.")
            total_affected += result.rowcount
            
        db.commit()
        print(f"\nSelesai! Total {total_affected} data referensi yang putus berhasil dibersihkan (di-set ke NULL).")
        print("Sekarang Anda bisa menjalankan perintah Alembic dengan aman.")
        
    except Exception as e:
        db.rollback()
        print(f"Terjadi kesalahan saat membersihkan database: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_orphaned_records()
