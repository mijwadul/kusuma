from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from ...core.auth import get_current_user, require_role
from ...core.database import get_db
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
    customer_id: Optional[int] = None
    start_date: date
    end_date: date
    items: List[InvoicePreviewItem]
    total_amount: float

class InvoiceCreate(BaseModel):
    customer_name: str
    customer_id: Optional[int] = None
    start_date: date
    end_date: date
    total_amount: float
    invoice_date: Optional[date] = None
    notes: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None

class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    invoice_date: Optional[date] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    customer_id: Optional[int] = None
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
    is_downloaded: Optional[bool] = False

    @field_validator('is_downloaded', mode='before')
    @classmethod
    def default_is_downloaded(cls, v):
        return bool(v) if v is not None else False
    created_at: str

class InvoiceStatusUpdate(BaseModel):
    status: str

from ...services.invoice_service import InvoiceService

@router.get("/uninvoiced-customers", response_model=List[str])
def get_uninvoiced_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import distinct
    from ...models.income_record import IncomeRecord
    customers = (
        db.query(distinct(IncomeRecord.customer_name))
        .filter(
            IncomeRecord.income_type == "material_sale",
            (IncomeRecord.is_invoiced == False) | (IncomeRecord.is_invoiced == None),
            IncomeRecord.customer_name.isnot(None),
            IncomeRecord.customer_name != ""
        )
        .all()
    )
    return [c[0] for c in customers if c[0]]

@router.get("/preview", response_model=InvoicePreviewResponse)
def preview_invoice(
    customer_name: Optional[str] = Query(None, description="Nama customer"),
    customer_id: Optional[int] = Query(None, description="ID customer"),
    start_date: date = Query(..., description="Tanggal awal"),
    end_date: date = Query(..., description="Tanggal akhir"),
    invoice_id: Optional[int] = Query(None, description="ID Invoice (jika edit)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InvoiceService.preview_invoice(db, customer_name, customer_id, start_date, end_date, invoice_id)

@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    return InvoiceService.create_invoice(db, current_user, data)

@router.get("", response_model=List[InvoiceResponse])
def get_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InvoiceService.get_invoices(db)

@router.put("/{invoice_id}/status", response_model=InvoiceResponse)
def update_invoice_status(
    invoice_id: int,
    data: InvoiceStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    return InvoiceService.update_invoice_status(db, current_user, invoice_id, data)

@router.put("/{invoice_id}/pay", response_model=InvoiceResponse)
def pay_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    return InvoiceService.pay_invoice(db, current_user, invoice_id)

@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    data: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    return InvoiceService.update_invoice(db, current_user, invoice_id, data)

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["finance", "checker"])),
):
    InvoiceService.delete_invoice(db, current_user, invoice_id)
    return None

from fastapi.responses import Response
from ...services.pdf_service import generate_invoice_pdf

@router.get("/{invoice_id}/export/pdf")
def export_invoice_pdf_endpoint(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ...models.invoice import Invoice
    from ...core.exceptions import NotFoundError
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise NotFoundError("Invoice not found")
        
    # Get items for the invoice
    preview_data = InvoiceService.preview_invoice(
        db=db,
        customer_name=inv.customer_name,
        customer_id=inv.customer_id,
        start_date=inv.start_date,
        end_date=inv.end_date,
        invoice_id=inv.id
    )
    
    # Attach items to invoice object dynamically so the generator can read them
    inv.items = preview_data.items
    
    pdf_bytes = generate_invoice_pdf(inv)
    
    # Mark as downloaded
    inv.is_downloaded = True
    db.commit()
    
    filename = f"Invoice_{inv.invoice_number}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
