"""
Invoice PDF Generator - System Kusuma
Dispatches generation between material sale invoices and project invoices.
"""

from typing import Optional
from .material_invoice import generate_material_invoice_pdf
from .project_invoice import generate_project_invoice_pdf


def generate_invoice_pdf(
    invoice,
    include_kuitansi: bool = False,
    kuitansi_options: Optional[dict] = None
) -> bytes:
    """
    Generate invoice PDF bytes based on invoice type, with optional Kuitansi page.
    """
    if getattr(invoice, "invoice_type", "material_sale") == "project":
        return generate_project_invoice_pdf(invoice, include_kuitansi=include_kuitansi, kuitansi_options=kuitansi_options)
    return generate_material_invoice_pdf(invoice, include_kuitansi=include_kuitansi, kuitansi_options=kuitansi_options)


__all__ = [
    "generate_invoice_pdf",
    "generate_material_invoice_pdf",
    "generate_project_invoice_pdf",
]

