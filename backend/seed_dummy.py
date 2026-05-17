"""
Script injeksi data dummy untuk periode 1-15 Mei 2026.
Mencakup: Work Logs, Fuel Logs, Attendance, Material Sales
"""
import sys, random
from datetime import date, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, ".")

from app.core.database import SessionLocal
from app.models.work_log import WorkLog
from app.models.fuel_log import FuelLog
from app.models.payroll import Attendance
from app.models.income_record import IncomeRecord

db = SessionLocal()

# ─── Reference Data ────────────────────────────────────────────
EQUIPMENT = [1, 2, 3, 4]            # 001=Breaker, 002=Breaker, 003=Bucket, 004=Bucket
OPERATORS = {
    6: ("Rendi Pratama", 3),         # user_id: (nama, equipment_id utama)
    7: ("Iwan Pratama", 4),
}
ALL_EMPLOYEES = [1, 2, 3, 4, 5, 6, 7, 8]  # employee IDs
FIELD_USER_ID = 4                    # user yang mencatat (Nailul)

CUSTOMERS = [
    "PT Semen Gresik",
    "CV Maju Jaya",
    "PT Bahana Karya",
    "UD Makmur Sejati",
    "Bapak Hendra",
]

MATERIAL_CONFIGS = [
    ("Limestone (urugan)", "m3",    45_000,   60_000),
    ("Dolomite",           "ton",   85_000,  110_000),
    ("Boulder",            "ton",   70_000,   90_000),
    ("Clay",               "ton",   30_000,   45_000),
]

# Operator names for work logs (operator_name column)
OPERATOR_NAMES = ["Rendi Pratama", "Iwan Pratama", "Ahmad Syarif", "Budi Santoso"]

# ─── Date range ────────────────────────────────────────────────
START = date(2026, 5, 1)
END   = date(2026, 5, 15)

def daterange(start, end):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)

def rand_time(d: date, hour_start=6, hour_end=8) -> datetime:
    h = random.randint(hour_start, hour_end)
    m = random.randint(0, 59)
    return datetime(d.year, d.month, d.day, h, m)

# ─── 1. WORK LOGS ──────────────────────────────────────────────
print("[1] Injeksi Work Logs (jam kerja alat)...")
wl_count = 0
hm_tracker = {eq_id: Decimal(str(random.randint(2200, 3000))) for eq_id in EQUIPMENT}

for d in daterange(START, END):
    is_sunday = d.weekday() == 6
    for eq_id in EQUIPMENT:
        if is_sunday and random.random() < 0.7:
            continue  # 70% alat libur hari Minggu
        if random.random() < 0.1:
            continue  # 10% chance breakdown / off

        # HM based input
        hm_start = hm_tracker[eq_id]
        hours = Decimal(str(round(random.uniform(5.5, 9.5), 2)))
        hm_end = hm_start + hours

        operator = OPERATOR_NAMES[eq_id % len(OPERATOR_NAMES)]
        descriptions = [
            "Penggalian material", "Pemuatan material ke truk",
            "Breaker batuan", "Pengangkutan overburden",
            "Perataan area tambang"
        ]

        wl = WorkLog(
            equipment_id=eq_id,
            project_id=None,
            input_method="HM",
            hm_start=hm_start,
            hm_end=hm_end,
            total_hours=hours,
            rental_discount_hours=Decimal("0"),
            operator_name=operator,
            work_description=random.choice(descriptions),
            work_date=datetime(d.year, d.month, d.day, 7, 0),
            recorded_by=FIELD_USER_ID,
        )
        db.add(wl)
        hm_tracker[eq_id] = hm_end
        wl_count += 1

db.flush()
print(f"   ✓ {wl_count} work log records")

# ─── 2. FUEL LOGS ─────────────────────────────────────────────
print("[2] Injeksi Fuel Logs (BBM)...")
fl_count = 0

for d in daterange(START, END):
    # Refuel setiap 3-4 hari per alat
    for eq_id in EQUIPMENT:
        if d.day % 4 != (eq_id % 4):
            continue

        liters = round(random.uniform(80, 180), 1)
        fl = FuelLog(
            equipment_id=eq_id,
            hour_meter=float(hm_tracker[eq_id]),
            liters_filled=liters,
            location="Area Tambang Blok A",
            photo_url=None,
            recorded_by=FIELD_USER_ID,
            notes=f"Pengisian rutin - {liters}L",
            refuel_date=rand_time(d, 6, 9),
            operating_hours=round(random.uniform(5, 9), 1),
        )
        db.add(fl)
        fl_count += 1

db.flush()
print(f"   ✓ {fl_count} fuel log records")

# ─── 3. ATTENDANCE ────────────────────────────────────────────
print("[3] Injeksi Attendance (absen karyawan)...")
att_count = 0

STATUS_WEIGHTS = ["present"] * 8 + ["late"] * 1 + ["sick"] * 1  # 80% hadir tepat, 10% terlambat, 10% sakit

for d in daterange(START, END):
    is_sunday = d.weekday() == 6
    for emp_id in ALL_EMPLOYEES:
        # Manager & Security setiap hari, lainnya 6 hari
        if is_sunday and emp_id not in [5]:  # Security tetap masuk
            if random.random() < 0.85:
                continue

        status = random.choice(STATUS_WEIGHTS)
        
        # Skip absen jika sakit (tidak ada check-in)
        if status == "sick":
            att = Attendance(
                employee_id=emp_id,
                date=d,
                check_in=None,
                check_out=None,
                status=status,
                work_hours=0,
                is_overtime=False,
                overtime_hours=0,
            )
            db.add(att)
            att_count += 1
            continue

        # Check in time
        if status == "present":
            ci_hour = random.choice([7, 7, 7, 8])  # mostly 07:00
        else:  # late
            ci_hour = random.randint(8, 10)

        check_in  = datetime(d.year, d.month, d.day, ci_hour, random.randint(0, 30))
        work_dur  = round(random.uniform(7.5, 9.5), 1)
        check_out = check_in + timedelta(hours=work_dur)

        is_overtime = work_dur > 8.5
        ot_hours = round(work_dur - 8.0, 1) if is_overtime else 0.0

        att = Attendance(
            employee_id=emp_id,
            date=d,
            check_in=check_in,
            check_out=check_out,
            status=status,
            work_hours=round(work_dur, 1),
            is_overtime=is_overtime,
            overtime_hours=ot_hours,
            notes=None,
        )
        db.add(att)
        att_count += 1

db.flush()
print(f"   ✓ {att_count} attendance records")

# ─── 4. MATERIAL SALES ────────────────────────────────────────
print("[4] Injeksi Material Sales (penjualan)...")
ms_count = 0

VEHICLE_TYPES = ["Colt Diesel", "Tronton"]
PLATES = ["W 1234 AB", "W 5678 CD", "N 9012 EF", "S 3456 GH", "K 7890 IJ",
          "L 1111 AA", "B 2222 BB", "AE 3333 CC", "AG 4444 DD"]

for d in daterange(START, END):
    is_sunday = d.weekday() == 6
    if is_sunday:
        n_sales = random.randint(0, 2)
    else:
        n_sales = random.randint(3, 8)

    for _ in range(n_sales):
        mat_type, unit, price_lo, price_hi = random.choice(MATERIAL_CONFIGS)
        customer = random.choice(CUSTOMERS)
        qty = round(random.uniform(5, 30), 1)
        price = random.randint(price_lo // 1000, price_hi // 1000) * 1000
        total = round(qty * price, 0)
        vtype = random.choice(VEHICLE_TYPES)
        plate = random.choice(PLATES)

        sale = IncomeRecord(
            income_date=d,
            income_type="material_sale",
            description=f"Penjualan {mat_type} - {customer}",
            amount=total,
            customer_name=customer,
            material_type=mat_type,
            quantity=qty,
            unit=unit,
            unit_price=price,
            payment_method=random.choice(["transfer", "cash"]),
            license_plate=plate,
            vehicle_type=vtype,
            notes=None,
            created_by=FIELD_USER_ID,
        )
        db.add(sale)
        ms_count += 1

db.flush()
print(f"   ✓ {ms_count} material sale records")

# ─── COMMIT ───────────────────────────────────────────────────
db.commit()
db.close()

print()
print("=" * 50)
print("SELESAI! Semua data dummy berhasil diinjeksi.")
print(f"  Work Logs   : {wl_count}")
print(f"  Fuel Logs   : {fl_count}")
print(f"  Attendance  : {att_count}")
print(f"  Sales       : {ms_count}")
print(f"  TOTAL       : {wl_count + fl_count + att_count + ms_count} records")
print("=" * 50)
