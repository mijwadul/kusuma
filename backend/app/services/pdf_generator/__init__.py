from .payroll import generate_payroll_pdf
from .work_logs import generate_work_logs_pdf
from .fuel import generate_fuel_purchases_pdf
from .income import generate_income_records_pdf
from .expenses import generate_expense_records_pdf
from .invoice import generate_invoice_pdf
from .loading import generate_jasa_loading_pdf

__all__ = [
    "generate_payroll_pdf",
    "generate_work_logs_pdf",
    "generate_fuel_purchases_pdf",
    "generate_income_records_pdf",
    "generate_expense_records_pdf",
    "generate_invoice_pdf",
    "generate_jasa_loading_pdf"
]
