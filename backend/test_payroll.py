import sys
from sqlalchemy import text
sys.path.append(r'd:\Titip\System Kusuma\kusuma\backend')

from app.core.database import SessionLocal

db = SessionLocal()
result = db.execute(text("SELECT id, date, is_payroll_generated, payroll_id FROM attendance WHERE employee_id=14 AND date >= '2026-05-31'"))
for row in result:
    print(dict(row._mapping))
