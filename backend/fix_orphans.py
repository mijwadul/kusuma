from app.core.database import SessionLocal
from app.models import IncomeRecord, Attendance

db = SessionLocal()

orphan_income = db.query(IncomeRecord).filter(
    IncomeRecord.income_type == 'material_sale',
    (IncomeRecord.is_invoiced == False) | (IncomeRecord.is_invoiced == None)
).all()

orphan_att = db.query(Attendance).filter(
    Attendance.status.in_(['present', 'late']),
    (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None)
).all()

print(f'Orphan IncomeRecords: {len(orphan_income)}')
for i in orphan_income:
    print(f' - ID: {i.id}, Date: {i.income_date}, Customer: {i.customer_name}, Amount: {i.amount}')

print(f'Orphan Attendances: {len(orphan_att)}')
for a in orphan_att:
    print(f' - ID: {a.id}, Date: {a.date}, Employee ID: {a.employee_id}')

# Update them
for i in orphan_income:
    i.is_invoiced = True
for a in orphan_att:
    a.is_payroll_generated = True

db.commit()
print("Successfully marked them as processed.")
