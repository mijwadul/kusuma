"""
Migration: Tambah kolom equipment_id ke tabel vendor_topups

Jalankan script ini SATU KALI untuk mengupdate schema database.
Setelah dijalankan, setiap deposit vendor harus dikaitkan ke alat berat tertentu.

Cara pakai:
    cd backend
    python alter_vendor_topups_equipment.py
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL tidak ditemukan di .env")
    sys.exit(1)

from sqlalchemy import create_engine, text, inspect

engine = create_engine(DATABASE_URL)

def column_exists(conn, table_name, column_name):
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in cols

def run_migration():
    with engine.connect() as conn:
        # Cek apakah kolom sudah ada
        if column_exists(conn, "vendor_topups", "equipment_id"):
            print("✅ Kolom 'equipment_id' sudah ada di tabel vendor_topups. Tidak perlu migrasi.")
            return

        print("🔄 Menambahkan kolom equipment_id ke tabel vendor_topups...")
        
        # Tambah kolom equipment_id (nullable, agar data lama tetap valid)
        conn.execute(text("""
            ALTER TABLE vendor_topups 
            ADD COLUMN equipment_id INT NULL
        """))
        
        # Tambah foreign key constraint
        try:
            conn.execute(text("""
                ALTER TABLE vendor_topups 
                ADD CONSTRAINT fk_vendor_topups_equipment 
                FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
            """))
            print("✅ Foreign key constraint berhasil ditambahkan.")
        except Exception as e:
            print(f"⚠️  FK constraint gagal (mungkin tidak didukung): {e}")
        
        conn.commit()
        print("✅ Migrasi selesai! Kolom 'equipment_id' berhasil ditambahkan ke vendor_topups.")
        print()
        print("ℹ️  Data topup lama yang tidak punya equipment_id akan tetap valid.")
        print("ℹ️  Topup baru sekarang WAJIB menyertakan equipment_id.")

if __name__ == "__main__":
    run_migration()
