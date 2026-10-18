from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect

from ...core.database import get_db
from ...core.auth import get_current_user, verify_password
from ...models.user import User

router = APIRouter()


class PurgeDatabaseRequest(BaseModel):
    confirmation: str
    password: Optional[str] = None


@router.post("/purge-database")
def purge_database(
    data: PurgeDatabaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tombol Sakti Purge Database:
    Mengosongkan seluruh isi database (surat jalan, transaksi, alat berat, proyek, vendor, payroll, dll.)
    KECUALI tabel 'users' (kredensial login) dan 'alembic_version'.
    """
    # 1. Hak Akses Khusus: Hanya Akun GM (General Manager / Direktur / Superuser)
    is_gm = (
        getattr(current_user, "role", "") in ("gm", "direktur")
        or getattr(current_user, "is_superuser", False)
    )
    if not is_gm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Tindakan ini secara khusus hanya dapat diakses dan dieksekusi oleh akun General Manager (GM).",
        )

    # 2. Validasi Konfirmasi
    if data.confirmation != "PURGE_CONFIRMED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pilihan konfirmasi tidak valid. Mohon pilih opsi konfirmasi persetujuan dengan benar.",
        )

    # 3. Validasi Password Akun jika disertakan
    if data.password:
        if not verify_password(data.password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password verifikasi salah. Tindakan dibatalkan demi keamanan.",
            )

    # 4. Eksekusi Purge
    engine = db.get_bind()
    dialect_name = engine.dialect.name.lower()
    purged_tables: List[str] = []

    try:
        # Nonaktifkan Foreign Key Checks agar relasi antar tabel tidak memblokir penghapusan
        if "mysql" in dialect_name:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        elif "sqlite" in dialect_name:
            db.execute(text("PRAGMA foreign_keys = OFF;"))

        # Dapatkan seluruh nama tabel langsung dari inspector database
        db_inspector = inspect(engine)
        all_table_names = db_inspector.get_table_names()

        # Lindungi tabel kredensial pengguna dan versi migrasi
        protected_tables = {"users", "alembic_version"}

        for tbl_name in all_table_names:
            if tbl_name.lower() in protected_tables:
                continue

            if "mysql" in dialect_name:
                db.execute(text(f"DELETE FROM `{tbl_name}`;"))
            else:
                db.execute(text(f'DELETE FROM "{tbl_name}";'))

            purged_tables.append(tbl_name)

        # Reset autoincrement sequence di sqlite jika ada
        if "sqlite" in dialect_name and "sqlite_sequence" in all_table_names:
            try:
                db.execute(text("DELETE FROM sqlite_sequence WHERE name NOT IN ('users');"))
            except Exception:
                pass

        # Aktifkan kembali Foreign Key Checks
        if "mysql" in dialect_name:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        elif "sqlite" in dialect_name:
            db.execute(text("PRAGMA foreign_keys = ON;"))

        db.commit()

    except Exception as e:
        db.rollback()
        # Pastikan Foreign Key Checks tetap dikembalikan jika terjadi error
        try:
            if "mysql" in dialect_name:
                db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            elif "sqlite" in dialect_name:
                db.execute(text("PRAGMA foreign_keys = ON;"))
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan saat mengosongkan database: {str(e)}",
        )

    return {
        "status": "success",
        "message": f"Database berhasil dibersihkan! Sebanyak {len(purged_tables)} tabel operasional telah dikosongkan. Seluruh akun dan kredensial login tetap aman.",
        "purged_tables": purged_tables,
        "preserved_tables": list(protected_tables),
    }
