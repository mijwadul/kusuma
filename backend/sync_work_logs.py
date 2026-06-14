import sys
import os

# Menambahkan path agar bisa meng-import dari 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from decimal import Decimal
from app.core.database import SessionLocal
from app.models import WorkLog, Vendor
from app.services.vendor_service import VendorService

def sync_work_logs_and_vendors():
    print("Mulai menghitung ulang sisa deposit dan tagihan work logs...")
    db = SessionLocal()
    
    try:
        # 1. Recalculate WorkLogs
        logs = db.query(WorkLog).filter(WorkLog.applied_rate != None).all()
        updated_logs = 0
        
        for wl in logs:
            # Lewati data yang punya perhitungan harga bertingkat (split rate)
            if wl.split_details is not None:
                continue
                
            total_hours = Decimal(str(wl.total_hours or 0))
            discount_hours = Decimal(str(wl.rental_discount_hours or 0))
            
            # Normalisasi discount
            if discount_hours < 0:
                discount_hours = Decimal("0")
            if discount_hours > total_hours:
                discount_hours = total_hours
                
            billable_hours = total_hours - discount_hours
            rate = Decimal(str(wl.applied_rate))
            correct_cost = billable_hours * rate
            
            current_cost = Decimal(str(wl.total_cost or 0))
            if current_cost != correct_cost:
                wl.total_cost = correct_cost
                updated_logs += 1
                
        db.commit()
        print(f"-> Berhasil memperbaiki nominal {updated_logs} data log kerja (Work Logs).")
        
        # 2. Sync Vendor Balances
        vendors = db.query(Vendor).all()
        for v in vendors:
            VendorService._sync_vendor_balance(db, v)
            
        print(f"-> Berhasil men-sinkronisasi saldo deposit untuk {len(vendors)} vendor.")
        print("\nSelesai! Sisa deposit sekarang seharusnya sudah akurat.")
        
    except Exception as e:
        db.rollback()
        print(f"Terjadi kesalahan saat melakukan sinkronisasi: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    sync_work_logs_and_vendors()
