"""
PDF Service Facade

This module re-exports the functions from the pdf_generator package.
"""

from .pdf_generator import (
    generate_payroll_pdf,
    generate_work_logs_pdf,
    generate_fuel_purchases_pdf,
    generate_income_records_pdf,
    generate_expense_records_pdf,
    generate_invoice_pdf
)

__all__ = [
    "generate_payroll_pdf",
    "generate_work_logs_pdf",
    "generate_fuel_purchases_pdf",
    "generate_income_records_pdf",
    "generate_expense_records_pdf",
    "generate_invoice_pdf"
]
