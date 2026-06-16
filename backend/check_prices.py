import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.core.database import SessionLocal
from app.models.project_hauling_price import ProjectHaulingPrice

db = SessionLocal()
prices = db.query(ProjectHaulingPrice).all()
for p in prices:
    print(f"ID: {p.id}, Project: {p.project_id}, Vendor: {p.vendor_id}, Price: {p.price_per_unit}")
