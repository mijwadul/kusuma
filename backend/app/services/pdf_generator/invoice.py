"""
Invoice PDF Generator - System Kusuma
Dispatches generation between material sale invoices and project invoices.
"""

from .material_invoice import generate_material_invoice_pdf
from .project_invoice import generate_project_invoice_pdf


def generate_invoice_pdf(invoice) -> bytes:
    """
    Generate invoice PDF bytes based on invoice type.
    """
    if getattr(invoice, "invoice_type", "material_sale") == "project":
        return generate_project_invoice_pdf(invoice)
    return generate_material_invoice_pdf(invoice)


__all__ = [
    "generate_invoice_pdf",
    "generate_material_invoice_pdf",
    "generate_project_invoice_pdf",
]
