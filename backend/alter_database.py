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

    columns_to_add = [
        ("sj_length", "FLOAT"),
        ("sj_width", "FLOAT"),
        ("sj_height", "FLOAT"),
        ("sj_volume_minus", "FLOAT"),
        ("sj_gross_weight", "FLOAT"),
        ("sj_tare_weight", "FLOAT"),
        ("sj_weight_minus", "FLOAT"),
    ]

    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE income_records ADD COLUMN {col_name} {col_type}")
            print(f"✅ Kolom {col_name} berhasil ditambahkan ke income_records.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"⚠️ Kolom {col_name} sudah ada, dilewati.")
            else:
                print(f"❌ Error menambahkan kolom {col_name}: {e}")

    conn.commit()
    conn.close()
    print("Selesai mengubah database.")

if __name__ == "__main__":
    alter_db()
