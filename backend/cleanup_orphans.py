import sys
import os

# Add the app to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app.core.database import SessionLocal
from backend.app.models import Expense, VendorTopUp, Vendor, Equipment
from datetime import datetime

def cleanup():
    db = SessionLocal()
    try:
        # Delete all expenses with category 'deposit'
        deleted = db.query(Expense).filter(Expense.category == "deposit").delete()
        print(f"Deleted {deleted} deposit expenses.")

        # Recreate them from approved VendorTopUps
        topups = db.query(VendorTopUp).filter(VendorTopUp.status == "approved").all()
        count = 0
        for topup in topups:
            vendor = db.query(Vendor).filter(Vendor.id == topup.vendor_id).first()
            equipment = db.query(Equipment).filter(Equipment.id == topup.equipment_id).first() if topup.equipment_id else None
            
            expense_dt = topup.topup_date.date() if topup.topup_date else datetime.now().date()
            eq_label = f" - {equipment.name}" if equipment else ""
            
            expense = Expense(
                category="deposit",
                description=f"Deposit Alat - {vendor.name.strip() if vendor else 'Unknown'}{eq_label}: {topup.notes or ''}",
                amount=float(topup.amount),
                expense_date=expense_dt,
                created_by=topup.created_by,
                approval_status="approved",
                approved_by=topup.approved_by,
                approved_at=topup.approved_at or datetime.now(),
                payment_status="paid",
                paid_by=topup.approved_by,
                paid_at=topup.approved_at or datetime.now(),
                project_id=topup.project_id
            )
            db.add(expense)
            count += 1
        db.commit()
        print(f"Recreated {count} deposit expenses from approved topups.")
    except Exception as e:
        print("Error:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
