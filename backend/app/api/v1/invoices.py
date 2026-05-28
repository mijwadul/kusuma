from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ...core.auth import get_current_user
from ...core.database import get_db
from ...models.income_record import IncomeRecord
from ...models.invoice import Invoice
from ...models.user import User

router = APIRouter()

class InvoicePreviewItem(BaseModel):
    id: int
    income_date: date
    material_type: str
    quantity: float
    unit: str
    unit_price: float
    amount: float
    description: str
    license_plate: Optional[str] = None
    driver_name: Optional[str] = None

class InvoicePreviewResponse(BaseModel):
    customer_name: str
    start_date: date
    end_date: date
    items: List[InvoicePreviewItem]
    total_amount: float

class InvoiceCreate(BaseModel):
    customer_name: str
    start_date: date
    end_date: date
    total_amount: float
    notes: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None

class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    invoice_date: date
    start_date: date
    end_date: date
    total_amount: float
    discount_type: Optional[str]
    discount_value: Optional[float]
    discount_amount: Optional[float]
    final_amount: Optional[float]
    status: str
    notes: Optional[str]
    created_at: str

class InvoiceStatusUpdate(BaseModel):
    status: str

@router.get("/preview", response_model=InvoicePreviewResponse)
def preview_invoice(
    customer_name: str = Query(..., description="Nama customer"),
    start_date: date = Query(..., description="Tanggal awal"),
    end_date: date = Query(..., description="Tanggal akhir"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(IncomeRecord)
        .filter(
            IncomeRecord.income_type == "material_sale",
            IncomeRecord.customer_name == customer_name,
            IncomeRecord.income_date >= start_date,
            IncomeRecord.income_date <= end_date,
        )
        .order_by(IncomeRecord.income_date.asc())
        .all()
    )

    items = []
    total = 0.0
    for r in records:
        amt = float(r.amount or 0)
        
        desc = r.description or "-"
        unit_val = r.unit or "ritase"
        qty_val = float(r.quantity or 1)
        price_val = float(r.unit_price or 0)

        has_sj_m3 = (unit_val == "m3" and r.sj_length is not None)
        has_sj_ton = (unit_val == "ton" and r.sj_gross_weight is not None)

        if has_sj_m3:
            sj_info = f"[P:{r.sj_length} L:{r.sj_width} T:{r.sj_height} M:{r.sj_volume_minus}]"
            desc = f"{desc} {sj_info}"
        elif has_sj_ton:
            sj_info = f"[B1:{r.sj_gross_weight} B2:{r.sj_tare_weight} M:{r.sj_weight_minus}]"
            desc = f"{desc} {sj_info}"
        else:
            unit_val = "ritase"

        items.append(
            InvoicePreviewItem(
                id=r.id,
                income_date=r.income_date,
                material_type=r.material_type or "-",
                quantity=qty_val,
                unit=unit_val,
                unit_price=price_val,
                amount=amt,
                description=desc,
                license_plate=r.license_plate,
                driver_name=r.driver_name,
            )
        )
        total += amt

    return InvoicePreviewResponse(
        customer_name=customer_name,
        start_date=start_date,
        end_date=end_date,
        items=items,
        total_amount=total,
    )

@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Generate invoice number (e.g., INV-YYYYMMDD-0001)
    today = date.today()
    prefix = f"INV-{today.strftime('%Y%m%d')}-"
    
    last_invoice = (
        db.query(Invoice)
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.id.desc())
        .first()
    )
    
    seq = 1
    if last_invoice:
        try:
            seq = int(last_invoice.invoice_number.split("-")[-1]) + 1
        except:
            pass

    invoice_number = f"{prefix}{seq:04d}"

    discount_amount = 0.0
    final_amount = data.total_amount

    if data.discount_type == "percentage" and data.discount_value:
        discount_amount = data.total_amount * (data.discount_value / 100)
    elif data.discount_type == "nominal" and data.discount_value:
        discount_amount = data.discount_value

    if data.discount_type:
        final_amount = data.total_amount - discount_amount

    new_invoice = Invoice(
        invoice_number=invoice_number,
        customer_name=data.customer_name,
        invoice_date=today,
        start_date=data.start_date,
        end_date=data.end_date,
        total_amount=data.total_amount,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        discount_amount=discount_amount if data.discount_type else None,
        final_amount=final_amount if data.discount_type else None,
        notes=data.notes,
        created_by=current_user.id if current_user else None,
    )

    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)

    return InvoiceResponse(
        id=new_invoice.id,
        invoice_number=new_invoice.invoice_number,
        customer_name=new_invoice.customer_name,
        invoice_date=new_invoice.invoice_date,
        start_date=new_invoice.start_date,
        end_date=new_invoice.end_date,
        total_amount=new_invoice.total_amount,
        discount_type=new_invoice.discount_type,
        discount_value=new_invoice.discount_value,
        discount_amount=new_invoice.discount_amount,
        final_amount=new_invoice.final_amount,
        status=new_invoice.status,
        notes=new_invoice.notes,
        created_at=str(new_invoice.created_at),
    )

@router.get("", response_model=List[InvoiceResponse])
def get_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoices = db.query(Invoice).order_by(Invoice.id.desc()).all()
    return [
        InvoiceResponse(
            id=inv.id,
            invoice_number=inv.invoice_number,
            customer_name=inv.customer_name,
            invoice_date=inv.invoice_date,
            start_date=inv.start_date,
            end_date=inv.end_date,
            total_amount=inv.total_amount,
            discount_type=inv.discount_type,
            discount_value=inv.discount_value,
            discount_amount=inv.discount_amount,
            final_amount=inv.final_amount,
            status=inv.status,
            notes=inv.notes,
            created_at=str(inv.created_at),
        )
        for inv in invoices
    ]

@router.put("/{invoice_id}/status", response_model=InvoiceResponse)
def update_invoice_status(
    invoice_id: int,
    data: InvoiceStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm", "finance")
    )
    if not is_admin_or_gm:
        raise HTTPException(status_code=403, detail="Not authorized to update invoice status")
        
    inv.status = data.status
    db.commit()
    db.refresh(inv)
    
    return InvoiceResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        customer_name=inv.customer_name,
        invoice_date=inv.invoice_date,
        start_date=inv.start_date,
        end_date=inv.end_date,
        total_amount=inv.total_amount,
        discount_type=inv.discount_type,
        discount_value=inv.discount_value,
        discount_amount=inv.discount_amount,
        final_amount=inv.final_amount,
        status=inv.status,
        notes=inv.notes,
        created_at=str(inv.created_at),
    )

@router.put("/{invoice_id}/pay", response_model=InvoiceResponse)
def pay_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm", "finance")
    )
    if not is_admin_or_gm:
        raise HTTPException(status_code=403, detail="Not authorized to pay invoice")
        
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")
        
    inv.status = "paid"
    # Note: Using updated_at or creating a new paid_at field might be better, 
    # but for now updating status triggers updated_at
    db.commit()
    db.refresh(inv)
    
    return InvoiceResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        customer_name=inv.customer_name,
        invoice_date=inv.invoice_date,
        start_date=inv.start_date,
        end_date=inv.end_date,
        total_amount=inv.total_amount,
        discount_type=inv.discount_type,
        discount_value=inv.discount_value,
        discount_amount=inv.discount_amount,
        final_amount=inv.final_amount,
        status=inv.status,
        notes=inv.notes,
        created_at=str(inv.created_at),
    )

@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm", "finance")
    )
    if not is_admin_or_gm:
        raise HTTPException(status_code=403, detail="Not authorized to edit invoice")
        
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(inv, key, value)
        
    # Re-calculate final_amount if needed
    if "total_amount" in update_data or "discount_type" in update_data or "discount_value" in update_data:
        if inv.discount_type == "percentage" and inv.discount_value:
            inv.discount_amount = inv.total_amount * (inv.discount_value / 100)
        elif inv.discount_type == "nominal" and inv.discount_value:
            inv.discount_amount = inv.discount_value
        else:
            inv.discount_amount = 0.0
            
        if inv.discount_type:
            inv.final_amount = inv.total_amount - inv.discount_amount
        else:
            inv.final_amount = None
            inv.discount_amount = None
            inv.discount_value = None

    db.commit()
    db.refresh(inv)
    
    return InvoiceResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        customer_name=inv.customer_name,
        invoice_date=inv.invoice_date,
        start_date=inv.start_date,
        end_date=inv.end_date,
        total_amount=inv.total_amount,
        discount_type=inv.discount_type,
        discount_value=inv.discount_value,
        discount_amount=inv.discount_amount,
        final_amount=inv.final_amount,
        status=inv.status,
        notes=inv.notes,
        created_at=str(inv.created_at),
    )

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    is_admin_or_gm = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "is_superuser", False)
        or getattr(current_user, "role", "") in ("admin", "gm")
    )
    if not is_admin_or_gm:
        raise HTTPException(status_code=403, detail="Not authorized to delete invoice")
        
    db.delete(inv)
    db.commit()
    return None
