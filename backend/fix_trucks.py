import os
import sys

# Add the backend directory to sys.path so we can import 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.vendor_truck import VendorTruck
from app.models.surat_jalan import SuratJalan
from app.models.vendor import Vendor
from app.services.vendor_service import VendorService

def fix_truck_vendors():
    db = SessionLocal()
    try:
        trucks = db.query(VendorTruck).all()
        affected_vendors = set()
        updates = 0
        
        for truck in trucks:
            # Find latest SJ for this truck's nopol
            latest_sj = db.query(SuratJalan).filter(
                SuratJalan.nopol.ilike(truck.nopol)
            ).order_by(SuratJalan.created_at.desc()).first()
            
            if latest_sj and latest_sj.vendor_id and truck.vendor_id != latest_sj.vendor_id:
                print(f"Migrating truck {truck.nopol} from vendor {truck.vendor_id} to {latest_sj.vendor_id}")
                affected_vendors.add(truck.vendor_id)
                affected_vendors.add(latest_sj.vendor_id)
                
                truck.vendor_id = latest_sj.vendor_id
                updates += 1
                
        if updates > 0:
            db.commit()
            print(f"Updated {updates} trucks. Resyncing balances...")
            
            for v_id in affected_vendors:
                if v_id:
                    v = db.query(Vendor).filter(Vendor.id == v_id).first()
                    if v:
                        VendorService._sync_vendor_balance(db, v)
                        print(f"Resynced vendor: {v.name}")
        else:
            print("No trucks needed migration.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_truck_vendors()
