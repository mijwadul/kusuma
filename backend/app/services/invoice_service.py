from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.income_record import IncomeRecord
from ..models.invoice import Invoice
from ..models.surat_jalan import SuratJalan
from ..models.project import Project
from ..models.user import User
from ..core.exceptions import AuthorizationError, NotFoundError, ValidationError
from ..api.v1.invoices import (
    InvoicePreviewItem,
    InvoicePreviewResponse,
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceStatusUpdate,
)

class InvoiceService:
    @staticmethod
    def preview_invoice(db: Session, invoice_type: str, project_id: Optional[int], customer_name: Optional[str], customer_id: Optional[int], start_date: date, end_date: date, invoice_id: Optional[int] = None) -> InvoicePreviewResponse:
        if invoice_type == "project":
            if not project_id:
                raise ValidationError("Project ID is required for project invoice")
            
            project = db.query(Project).filter(Project.id == project_id).first()
            if not project:
                raise NotFoundError("Project not found")

            # Determine unit_price
            unit_price = 0.0
            if project.material_items and len(project.material_items) > 0:
                unit_price = project.material_items[0].unit_price or 0.0

            measurement_type = project.measurement_type or 'tonase'
            
            query = (
                db.query(SuratJalan)
                .filter(
                    SuratJalan.project_id == project_id,
                    func.date(SuratJalan.created_at) >= start_date,
                    func.date(SuratJalan.created_at) <= end_date,
                )
            )

            if invoice_id is not None:
                query = query.filter(
                    (SuratJalan.is_invoiced == False) | 
                    (SuratJalan.is_invoiced == None) | 
                    (SuratJalan.invoice_id == invoice_id)
                )
            else:
                query = query.filter(
                    (SuratJalan.is_invoiced == False) | 
                    (SuratJalan.is_invoiced == None)
                )

            records = query.order_by(SuratJalan.created_at.asc()).all()
            
            items = []
            total = 0.0
            for r in records:
                if measurement_type == 'tonase':
                    qty_val = float(r.netto or 0)
                    unit_val = "ton"
                    sj_info = f"[B1:{r.bruto} B2:{r.tarra} M:{r.minus_berat}]"
                else:
                    qty_val = float(r.volume or 0)
                    unit_val = "m3"
                    sj_info = f"[P:{r.panjang} L:{r.lebar} T:{r.tinggi} M:{r.minus_tinggi}]"
                
                amt = qty_val * unit_price
                desc = f"Surat Jalan {r.nopol or '-'} {sj_info}"

                items.append(
                    InvoicePreviewItem(
                        id=r.id,
                        income_date=r.created_at.date(),
                        material_type=project.name,
                        quantity=qty_val,
                        unit=unit_val,
                        unit_price=unit_price,
                        amount=amt,
                        description=desc,
                        license_plate=r.nopol,
                        driver_name=r.nama_supir,
                        sj_gross_weight=r.bruto,
                        sj_tare_weight=r.tarra,
                        sj_weight_minus=r.minus_berat,
                        sj_net_weight=r.netto,
                        sj_length=r.panjang,
                        sj_width=r.lebar,
                        sj_height=r.tinggi,
                        sj_volume_minus=r.minus_tinggi,
                        sj_volume=r.volume,
                    )
                )
                total += amt

            return InvoicePreviewResponse(
                customer_name=project.client_name or project.name,
                customer_id=None,
                start_date=start_date,
                end_date=end_date,
                items=items,
                total_amount=total,
            )
        else:
            query = (
                db.query(IncomeRecord)
                .filter(
                    IncomeRecord.income_type == "material_sale",
                    IncomeRecord.income_date >= start_date,
                    IncomeRecord.income_date <= end_date,
                )
            )
            
            if customer_id is not None:
                query = query.filter(IncomeRecord.customer_id == customer_id)
            elif customer_name is not None:
                query = query.filter(IncomeRecord.customer_name.ilike(customer_name))
            
            if invoice_id is not None:
                query = query.filter(
                    (IncomeRecord.is_invoiced == False) | 
                    (IncomeRecord.is_invoiced == None) | 
                    (IncomeRecord.invoice_id == invoice_id)
                )
            else:
                query = query.filter(
                    (IncomeRecord.is_invoiced == False) | 
                    (IncomeRecord.is_invoiced == None)
                )
                
            records = query.order_by(IncomeRecord.income_date.asc()).all()

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
                customer_name=customer_name or "",
                customer_id=customer_id,
                start_date=start_date,
                end_date=end_date,
                items=items,
                total_amount=total,
            )

    @staticmethod
    def create_invoice(db: Session, current_user: User, data: InvoiceCreate) -> InvoiceResponse:
        from sqlalchemy import func
        existing_invoice = db.query(Invoice).filter(
            Invoice.customer_name.ilike(data.customer_name),
            Invoice.start_date <= data.end_date,
            Invoice.end_date >= data.start_date
        ).first()
        
        if existing_invoice:
            raise ValidationError(f"Invoice untuk customer ini pada periode yang bersinggungan ({existing_invoice.start_date} s/d {existing_invoice.end_date}) sudah pernah dibuat dengan nomor {existing_invoice.invoice_number}. Silakan edit invoice tersebut alih-alih membuat yang baru.")

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
            invoice_type=data.invoice_type,
            project_id=data.project_id,
            invoice_number=invoice_number,
            customer_name=data.customer_name,
            customer_id=data.customer_id,
            invoice_date=data.invoice_date if data.invoice_date else today,
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

        if data.invoice_type == "project":
            records_query = db.query(SuratJalan).filter(
                SuratJalan.project_id == data.project_id,
                func.date(SuratJalan.created_at) >= data.start_date,
                func.date(SuratJalan.created_at) <= data.end_date,
                (SuratJalan.is_invoiced == False) | (SuratJalan.is_invoiced == None)
            )
            records_to_mark = records_query.all()
            for r in records_to_mark:
                r.is_invoiced = True
                r.invoice_id = new_invoice.id
        else:
            records_query = db.query(IncomeRecord).filter(
                IncomeRecord.income_type == "material_sale",
                IncomeRecord.income_date >= data.start_date,
                IncomeRecord.income_date <= data.end_date,
                (IncomeRecord.is_invoiced == False) | (IncomeRecord.is_invoiced == None)
            )
            
            if data.customer_id is not None:
                records_query = records_query.filter(IncomeRecord.customer_id == data.customer_id)
            else:
                records_query = records_query.filter(IncomeRecord.customer_name.ilike(data.customer_name))
                
            records_to_mark = records_query.all()
            
            for r in records_to_mark:
                r.is_invoiced = True
                r.invoice_id = new_invoice.id
            
        if records_to_mark:
            db.commit()

        return InvoiceResponse(
            id=new_invoice.id,
            invoice_type=new_invoice.invoice_type,
            project_id=new_invoice.project_id,
            invoice_number=new_invoice.invoice_number,
            customer_name=new_invoice.customer_name,
            customer_id=new_invoice.customer_id,
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
            is_downloaded=new_invoice.is_downloaded,
            created_at=str(new_invoice.created_at),
        )

    @staticmethod
    def get_invoices(db: Session) -> List[InvoiceResponse]:
        invoices = db.query(Invoice).order_by(Invoice.invoice_date.desc(), Invoice.id.desc()).all()
        return [
            InvoiceResponse(
                id=inv.id,
                invoice_type=inv.invoice_type,
                project_id=inv.project_id,
                invoice_number=inv.invoice_number,
                customer_name=inv.customer_name,
                customer_id=inv.customer_id,
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

    @staticmethod
    def update_invoice_status(db: Session, current_user: User, invoice_id: int, data: InvoiceStatusUpdate) -> InvoiceResponse:
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not inv:
            raise NotFoundError("Invoice not found")
            
        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm", "finance")
        )
        if not is_admin_or_gm:
            raise AuthorizationError("Not authorized to update invoice status")
            
        inv.status = data.status
        db.commit()
        db.refresh(inv)
        
        return InvoiceResponse(
            id=inv.id,
            invoice_type=inv.invoice_type,
            project_id=inv.project_id,
            invoice_number=inv.invoice_number,
            customer_name=inv.customer_name,
            customer_id=inv.customer_id,
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
            is_downloaded=inv.is_downloaded,
            created_at=str(inv.created_at),
        )

    @staticmethod
    def pay_invoice(db: Session, current_user: User, invoice_id: int) -> InvoiceResponse:
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not inv:
            raise NotFoundError("Invoice not found")
            
        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm", "finance")
        )
        if not is_admin_or_gm:
            raise AuthorizationError("Not authorized to pay invoice")
            
        if inv.status == "paid":
            raise ValidationError("Invoice already paid")
            
        inv.status = "paid"
        db.commit()
        db.refresh(inv)
        
        return InvoiceResponse(
            id=inv.id,
            invoice_type=inv.invoice_type,
            project_id=inv.project_id,
            invoice_number=inv.invoice_number,
            customer_name=inv.customer_name,
            customer_id=inv.customer_id,
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
            is_downloaded=inv.is_downloaded,
            created_at=str(inv.created_at),
        )

    @staticmethod
    def update_invoice(db: Session, current_user: User, invoice_id: int, data: InvoiceUpdate) -> InvoiceResponse:
        from sqlalchemy import func
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not inv:
            raise NotFoundError("Invoice not found")
            
        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm", "finance")
        )
        if not is_admin_or_gm:
            raise AuthorizationError("Not authorized to edit invoice")
            
        if inv.invoice_type == "project":
            records_to_unmark = db.query(SuratJalan).filter(SuratJalan.invoice_id == inv.id).all()
            for r in records_to_unmark:
                r.is_invoiced = False
                r.invoice_id = None
                
            db.flush()
                
            update_data = data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(inv, key, value)
                
            records_query = db.query(SuratJalan).filter(
                SuratJalan.project_id == inv.project_id,
                func.date(SuratJalan.created_at) >= inv.start_date,
                func.date(SuratJalan.created_at) <= inv.end_date,
                (SuratJalan.is_invoiced == False) | (SuratJalan.is_invoiced == None)
            )
            records_to_mark = records_query.all()
            for r in records_to_mark:
                r.is_invoiced = True
                r.invoice_id = inv.id
        else:
            records_to_unmark = db.query(IncomeRecord).filter(IncomeRecord.invoice_id == inv.id).all()
            for r in records_to_unmark:
                r.is_invoiced = False
                r.invoice_id = None
                
            db.flush()
                
            update_data = data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(inv, key, value)
                
            records_query = db.query(IncomeRecord).filter(
                IncomeRecord.income_type == "material_sale",
                IncomeRecord.income_date >= inv.start_date,
                IncomeRecord.income_date <= inv.end_date,
                (IncomeRecord.is_invoiced == False) | (IncomeRecord.is_invoiced == None)
            )
            
            if inv.customer_id is not None:
                records_query = records_query.filter(IncomeRecord.customer_id == inv.customer_id)
            else:
                records_query = records_query.filter(IncomeRecord.customer_name.ilike(inv.customer_name))
                
            records_to_mark = records_query.all()
            for r in records_to_mark:
                r.is_invoiced = True
                r.invoice_id = inv.id
            
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
            invoice_type=inv.invoice_type,
            project_id=inv.project_id,
            invoice_number=inv.invoice_number,
            customer_name=inv.customer_name,
            customer_id=inv.customer_id,
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
            is_downloaded=inv.is_downloaded,
            created_at=str(inv.created_at),
        )

    @staticmethod
    def delete_invoice(db: Session, current_user: User, invoice_id: int) -> None:
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not inv:
            raise NotFoundError("Invoice not found")
            
        is_admin_or_gm = (
            getattr(current_user, "is_admin", False)
            or getattr(current_user, "is_superuser", False)
            or getattr(current_user, "role", "") in ("admin", "gm")
        )
        if not is_admin_or_gm:
            raise AuthorizationError("Not authorized to delete invoice")
            
        if inv.invoice_type == "project":
            records_to_unmark = db.query(SuratJalan).filter(SuratJalan.invoice_id == invoice_id).all()
            for r in records_to_unmark:
                r.is_invoiced = False
                r.invoice_id = None
        else:
            records_to_unmark = db.query(IncomeRecord).filter(IncomeRecord.invoice_id == invoice_id).all()
            for r in records_to_unmark:
                r.is_invoiced = False
                r.invoice_id = None
            
        db.delete(inv)
        db.commit()
