import logging
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from .payroll_service import PayrollService
from .invoice_service import InvoiceService
from ..models.employee import Employee
from ..models.income_record import IncomeRecord
from ..models.user import User
from ..schemas.employee import PayrollCreate
from ..api.v1.invoices import InvoiceCreate
from ..core.database import SessionLocal

logger = logging.getLogger(__name__)

class AutomationService:
    @staticmethod
    def auto_generate_payrolls():
        """
        Mengecek karyawan/operator yang memiliki absensi namun belum di-generate payroll-nya.
        """
        logger.info("Memulai proses auto-generate payrolls...")
        db: Session = SessionLocal()
        try:
            # Ambil semua absensi yang belum digenerate payroll-nya
            from ..models.payroll import Attendance
            uninvoiced_attendances = db.query(Attendance).filter(
                (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None),
                Attendance.payroll_id == None
            ).all()

            if not uninvoiced_attendances:
                logger.info("Tidak ada absensi baru yang perlu dibuatkan payroll.")
                return

            # Kelompokkan berdasarkan employee_id
            emp_attendance_map = {}
            for att in uninvoiced_attendances:
                if att.employee_id not in emp_attendance_map:
                    emp_attendance_map[att.employee_id] = []
                emp_attendance_map[att.employee_id].append(att.date)

            system_user = db.query(User).filter(User.role == "admin").first()
            if not system_user:
                 logger.warning("Tidak menemukan user admin untuk autorisasi pembuat sistem.")

            for emp_id, dates in emp_attendance_map.items():
                min_date = min(dates)
                max_date = max(dates)
                
                logger.info(f"Auto-generating payroll untuk Employee ID: {emp_id} periode {min_date} s/d {max_date}")

                payroll_data = PayrollCreate(
                    employee_id=emp_id,
                    period_start=min_date,
                    period_end=max_date,
                    overtime_hours=0,
                    bonus=0,
                    allowance=0,
                    loan_deduction=None,
                    other_deduction=0,
                    notes="[Auto-Generated] Payroll otomatis oleh sistem."
                )
                
                try:
                    # Sistem user dilempar tapi payment_status akan pending kalau rolenya bukan admin super.
                    # Kita anggap system_user memiliki wewenang untuk draft
                    PayrollService.create_payroll(db, system_user, payroll_data)
                    logger.info(f"Berhasil membuat draft payroll untuk Employee ID: {emp_id}")
                except Exception as e:
                    logger.error(f"Gagal membuat payroll untuk Employee ID {emp_id}: {str(e)}")

        except Exception as e:
            logger.error(f"Error pada auto_generate_payrolls: {str(e)}")
        finally:
            db.close()
            logger.info("Selesai proses auto-generate payrolls.")

    @staticmethod
    def auto_generate_invoices():
        """
        Mengecek surat jalan penjualan material yang belum ditagihkan.
        """
        logger.info("Memulai proses auto-generate invoices...")
        db: Session = SessionLocal()
        try:
            uninvoiced_records = db.query(IncomeRecord).filter(
                IncomeRecord.income_type == "material_sale",
                (IncomeRecord.is_invoiced == False) | (IncomeRecord.is_invoiced == None),
                IncomeRecord.customer_name.isnot(None),
                IncomeRecord.customer_name != ""
            ).all()

            if not uninvoiced_records:
                logger.info("Tidak ada penjualan material baru yang perlu dibuatkan invoice.")
                return

            # Kelompokkan berdasarkan customer_name dan customer_id
            customer_map = {}
            for rec in uninvoiced_records:
                key = (rec.customer_name, rec.customer_id)
                if key not in customer_map:
                    customer_map[key] = {
                        "dates": [],
                        "total_amount": 0.0
                    }
                customer_map[key]["dates"].append(rec.income_date)
                customer_map[key]["total_amount"] += float(rec.amount or 0)

            system_user = db.query(User).filter(User.role == "admin").first()

            for (cust_name, cust_id), data in customer_map.items():
                min_date = min(data["dates"])
                max_date = max(data["dates"])
                total_amount = data["total_amount"]
                
                logger.info(f"Auto-generating invoice untuk {cust_name} periode {min_date} s/d {max_date}")

                invoice_data = InvoiceCreate(
                    customer_name=cust_name,
                    customer_id=cust_id,
                    start_date=min_date,
                    end_date=max_date,
                    total_amount=total_amount,
                    invoice_date=date.today(),
                    notes="[Auto-Generated] Invoice otomatis oleh sistem.",
                    discount_type=None,
                    discount_value=None
                )

                try:
                    InvoiceService.create_invoice(db, system_user, invoice_data)
                    logger.info(f"Berhasil membuat draft invoice untuk {cust_name}")
                except Exception as e:
                    logger.error(f"Gagal membuat invoice untuk {cust_name}: {str(e)}")

        except Exception as e:
            logger.error(f"Error pada auto_generate_invoices: {str(e)}")
        finally:
            db.close()
            logger.info("Selesai proses auto-generate invoices.")
