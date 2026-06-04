from datetime import date
from typing import Dict, Tuple, List
from sqlalchemy.orm import Session

from ...models.fuel_price import FuelPrice
from ...models.fuel_log import FuelLog
from ...models.income_record import IncomeRecord
from ...models.invoice import Invoice

def calculate_fifo_fuel_costs(db: Session) -> Dict[int, float]:
    """
    Menghitung biaya per log BBM berdasarkan metode First-In-First-Out (FIFO).
    Mengembalikan dictionary: { fuel_log_id: total_cost_in_rupiah }
    """
    all_fuel_purchases = db.query(FuelPrice).filter(
        FuelPrice.approval_status == "approved"
    ).order_by(FuelPrice.effective_date.asc()).all()
    
    all_fuel_logs = db.query(FuelLog).order_by(FuelLog.refuel_date.asc(), FuelLog.id.asc()).all()

    events = []
    for fp in all_fuel_purchases:
        events.append({"type": "purchase", "date": fp.effective_date, "data": fp})
    for fl in all_fuel_logs:
        events.append({"type": "consume", "date": fl.refuel_date, "data": fl})
        
    # Sort events by date
    events.sort(key=lambda x: x["date"])
    
    inventory = []
    log_costs = {}
    
    for ev in events:
        if ev["type"] == "purchase":
            fp = ev["data"]
            if fp.liters and fp.liters > 0:
                inventory.append({
                    "price": float(fp.price_per_liter),
                    "remaining_liters": float(fp.liters)
                })
        else:
            fl = ev["data"]
            liters_needed = float(fl.liters_filled or 0)
            cost = 0.0
            
            while liters_needed > 0 and inventory:
                batch = inventory[0]
                if batch["remaining_liters"] <= liters_needed:
                    cost += batch["remaining_liters"] * batch["price"]
                    liters_needed -= batch["remaining_liters"]
                    inventory.pop(0)
                else:
                    cost += liters_needed * batch["price"]
                    batch["remaining_liters"] -= liters_needed
                    liters_needed = 0
                    
            if liters_needed > 0:
                # If inventory is empty but we still need fuel, use the last known price
                fallback_price = all_fuel_purchases[-1].price_per_liter if all_fuel_purchases else 0
                cost += liters_needed * float(fallback_price)
                
            log_costs[fl.id] = cost
            
    return log_costs

def calculate_material_sales_income(db: Session, start_date: date, end_date: date) -> Tuple[float, List[IncomeRecord]]:
    """
    Menghitung total pendapatan material (Accrual-basis) berdasarkan rentang tanggal IncomeRecord.
    Menggunakan harga invoice jika IncomeRecord sudah ditagihkan (invoiced).
    Mengembalikan tuple: (total_sales_value, uninvoiced_material_records)
    """
    material_rows = (
        db.query(IncomeRecord)
        .filter(
            IncomeRecord.income_date >= start_date,
            IncomeRecord.income_date <= end_date,
            IncomeRecord.income_type == "material_sale",
        )
        .order_by(IncomeRecord.income_date.asc())
        .all()
    )

    invoices_all = db.query(Invoice).all() # Load all to map relationships
    uninvoiced_material_sales = []
    
    # Identify which records are uninvoiced
    for ir in material_rows:
        is_invoiced = False
        for inv in invoices_all:
            if inv.customer_name and ir.customer_name and inv.customer_name.lower() == ir.customer_name.lower() and inv.start_date <= ir.income_date <= inv.end_date:
                is_invoiced = True
                break
        
        if not is_invoiced:
            uninvoiced_material_sales.append(ir)
            
    # Calculate Material Sales properly
    # Get invoices that cover this range (using invoice_date in range? No, we just need invoices that match the period)
    invoices_in_range = [inv for inv in invoices_all if start_date <= inv.invoice_date <= end_date]
    
    total_invoiced_material = sum(
        float(inv.final_amount if inv.final_amount is not None else (inv.total_amount or 0)) 
        for inv in invoices_in_range
    )
    total_uninvoiced_material = sum(float(ir.amount or 0) for ir in uninvoiced_material_sales)
    
    total_material_sales = total_invoiced_material + total_uninvoiced_material

    return total_material_sales, uninvoiced_material_sales
