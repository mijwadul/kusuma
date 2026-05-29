import sqlite3
import os

def alter_db():
    db_path = os.path.join(os.path.dirname(__file__), "kusuma.db")
    print(f"Menggunakan database: {db_path}")
    
    if not os.path.exists(db_path):
        print("Database kusuma.db tidak ditemukan di folder backend!")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # (table_name, col_name, col_type)
    columns_to_add = [
        ("income_records", "sj_length", "FLOAT"),
        ("income_records", "sj_width", "FLOAT"),
        ("income_records", "sj_height", "FLOAT"),
        ("income_records", "sj_volume_minus", "FLOAT"),
        ("income_records", "sj_gross_weight", "FLOAT"),
        ("income_records", "sj_tare_weight", "FLOAT"),
        ("income_records", "sj_weight_minus", "FLOAT"),
        ("income_records", "driver_name", "VARCHAR(100) DEFAULT NULL"),
        ("fuel_prices", "vendor_name", "VARCHAR(200) DEFAULT NULL"),
        ("fuel_prices", "payment_status", "VARCHAR(20) DEFAULT 'unpaid'"),
        ("fuel_prices", "paid_by", "INTEGER"),
        ("fuel_prices", "paid_at", "DATETIME"),
        ("customers", "trucks_json", "TEXT DEFAULT NULL"),
        ("invoices", "status", "VARCHAR(20) DEFAULT 'unpaid'"),
    ]

    for table_name, col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
            print(f"✅ Kolom {col_name} berhasil ditambahkan ke {table_name}.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"⚠️ Kolom {col_name} sudah ada di {table_name}, dilewati.")
            else:
                print(f"❌ Error menambahkan kolom {col_name} ke {table_name}: {e}")

    conn.commit()
    conn.close()
    print("Selesai mengubah database.")

if __name__ == "__main__":
    alter_db()
