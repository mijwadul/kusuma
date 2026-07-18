import os
import sys

# Tambahkan path ke root backend agar bisa melakukan import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.employee import Employee

# Target divisi baru
NEW_DEPARTMENTS = [
    'Alat Berat',
    'Operasional Hauling',
    'Material & Lahan',
    'Corporate & Finance'
]

# Mapping kata kunci ke divisi baru
MAPPING_RULES = {
    'Alat Berat': ['alat berat', 'he', 'heavy equipment', 'mekanik', 'bengkel', 'maintenance'],
    'Operasional Hauling': ['hauling', 'trucking', 'operasional', 'transport', 'driver', 'sopir', 'logistik'],
    'Material & Lahan': ['material', 'lahan', 'tambang', 'survey', 'checker', 'produksi', 'crusher', 'quarry'],
    'Corporate & Finance': ['finance', 'hr', 'admin', 'corporate', 'keuangan', 'hrd', 'pajak', 'tax', 'it', 'general affair', 'ga', 'office', 'direksi', 'manajemen']
}

def map_department(old_dept: str) -> str:
    if not old_dept:
        return 'Corporate & Finance' # Default
    
    old_dept_lower = old_dept.lower().strip()
    
    # Cek apakah sudah sesuai dengan format baru
    for new_dept in NEW_DEPARTMENTS:
        if old_dept_lower == new_dept.lower():
            return new_dept
            
    # Fuzzy matching dengan rules
    for target_dept, keywords in MAPPING_RULES.items():
        for keyword in keywords:
            if keyword in old_dept_lower:
                return target_dept
                
    # Fallback
    return 'Corporate & Finance'

def run_migration():
    db: Session = SessionLocal()
    try:
        employees = db.query(Employee).all()
        updated_count = 0
        unmapped = set()
        
        print("Memulai migrasi departemen karyawan...")
        for emp in employees:
            old_dept = emp.department
            new_dept = map_department(old_dept)
            
            if old_dept != new_dept:
                print(f"Update: ID {emp.id} | '{old_dept}' -> '{new_dept}'")
                emp.department = new_dept
                updated_count += 1
                
                # Catat yang tidak ada di rules (untuk fallback)
                is_mapped = False
                if old_dept:
                    for target, keywords in MAPPING_RULES.items():
                        if any(k in old_dept.lower() for k in keywords):
                            is_mapped = True
                            break
                    if not is_mapped and old_dept.lower() not in [d.lower() for d in NEW_DEPARTMENTS]:
                        unmapped.add(old_dept)
        
        if updated_count > 0:
            db.commit()
            print(f"\nBerhasil mengupdate {updated_count} karyawan.")
        else:
            print("\nSemua data sudah sesuai, tidak ada yang perlu diupdate.")
            
        if unmapped:
            print("\nPERINGATAN: Beberapa departemen lama di-fallback ke 'Corporate & Finance' karena tidak dikenali:")
            for um in unmapped:
                print(f" - {um}")
                
    except Exception as e:
        db.rollback()
        print(f"Terjadi kesalahan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
