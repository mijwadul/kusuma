import asyncio
import re
from sqlalchemy import select
from app.core.database import async_session
from app.models.surat_jalan import SuratJalan
from app.models.vendor_truck import VendorTruck

def format_nopol(value: str) -> str:
    if not value: return ""
    cleaned = re.sub(r'[^a-zA-Z0-9]', '', value).upper()
    match = re.match(r'^([A-Z]{1,2})(\d{1,4})?([A-Z]{0,3})?', cleaned)
    if match:
        res = match.group(1) or ""
        if match.group(2): res += " " + match.group(2)
        if match.group(3): res += " " + match.group(3)
        return res
    return value.upper()

def format_title_case(value: str) -> str:
    if not value: return ""
    return " ".join(word.capitalize() for word in value.split(" ") if word)

async def fix_data():
    async with async_session() as session:
        # Update Surat Jalan
        result = await session.execute(select(SuratJalan))
        surat_jalans = result.scalars().all()
        sj_updates = 0
        for sj in surat_jalans:
            updated = False
            if sj.nopol:
                new_nopol = format_nopol(sj.nopol)
                if new_nopol != sj.nopol:
                    sj.nopol = new_nopol
                    updated = True
            if sj.nama_supir:
                new_supir = format_title_case(sj.nama_supir)
                if new_supir != sj.nama_supir:
                    sj.nama_supir = new_supir
                    updated = True
            if updated:
                sj_updates += 1
                
        # Update Vendor Trucks
        result_trucks = await session.execute(select(VendorTruck))
        trucks = result_trucks.scalars().all()
        truck_updates = 0
        for t in trucks:
            updated = False
            if t.nopol:
                new_nopol = format_nopol(t.nopol)
                if new_nopol != t.nopol:
                    t.nopol = new_nopol
                    updated = True
            if t.supir_default:
                new_supir = format_title_case(t.supir_default)
                if new_supir != t.supir_default:
                    t.supir_default = new_supir
                    updated = True
            if updated:
                truck_updates += 1

        await session.commit()
        print(f"BERHASIL: Memperbarui {sj_updates} Surat Jalan dan {truck_updates} Truk Vendor.")

if __name__ == "__main__":
    asyncio.run(fix_data())
