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
    def _get_system_user(db: Session) -> User | None:
        """Ambil user admin sebagai user sistem untuk auto-generate."""
        user = db.query(User).filter(User.role.in_(["gm", "admin"]), User.is_active == True).first()
        if not user:
            logger.warning("Tidak menemukan user admin/GM untuk autorisasi pembuat sistem.")
        return user

    @staticmethod
    def _generate_payroll_for_employees(db: Session, employee_ids: list[int], label: str):
        """
        Logika inti: ambil absensi yang belum digenerate payroll untuk daftar employee_ids tertentu,
        lalu buat payroll draft per karyawan.
        """
        from ..models.payroll import Attendance

        uninvoiced_attendances = db.query(Attendance).filter(
            Attendance.employee_id.in_(employee_ids),
            (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None),
            Attendance.payroll_id == None
        ).all()

        if not uninvoiced_attendances:
            logger.info(f"[{label}] Tidak ada absensi baru yang perlu dibuatkan payroll.")
            return

        # Kelompokkan berdasarkan employee_id
        emp_attendance_map = {}
        for att in uninvoiced_attendances:
            if att.employee_id not in emp_attendance_map:
                emp_attendance_map[att.employee_id] = []
            emp_attendance_map[att.employee_id].append(att.date)

        system_user = AutomationService._get_system_user(db)

        for emp_id, dates in emp_attendance_map.items():
            min_date = min(dates)
            max_date = max(dates)

            logger.info(f"[{label}] Auto-generating payroll untuk Employee ID: {emp_id} periode {min_date} s/d {max_date}")

            payroll_data = PayrollCreate(
                employee_id=emp_id,
                period_start=min_date,
                period_end=max_date,
                overtime_hours=0,
                bonus=0,
                allowance=0,
                loan_deduction=None,
                other_deduction=0,
                notes=f"[Auto-Generated] {label}."
            )

            try:
                PayrollService.create_payroll(db, system_user, payroll_data)
                logger.info(f"[{label}] Berhasil membuat draft payroll untuk Employee ID: {emp_id}")
            except Exception as e:
                logger.error(f"[{label}] Gagal membuat payroll untuk Employee ID {emp_id}: {str(e)}")

    @staticmethod
    def auto_generate_operator_payrolls():
        """
        Harian (jam 03:00 WIB): Generate payroll hanya untuk karyawan OPERATOR
        (position mengandung kata 'operator', case-insensitive).
        """
        logger.info("Memulai proses auto-generate payrolls OPERATOR...")
        db: Session = SessionLocal()
        try:
            # Cari semua karyawan aktif yang posisinya adalah operator
            operator_employees = db.query(Employee).filter(
                Employee.is_active == True,
                Employee.position.ilike("%operator%")
            ).all()

            if not operator_employees:
                logger.info("Tidak ada karyawan operator aktif ditemukan.")
                return

            operator_ids = [e.id for e in operator_employees]
            logger.info(f"Ditemukan {len(operator_ids)} karyawan operator: {[e.name for e in operator_employees]}")

            AutomationService._generate_payroll_for_employees(db, operator_ids, "Payroll Harian Operator")

        except Exception as e:
            logger.error(f"Error pada auto_generate_operator_payrolls: {str(e)}")
        finally:
            db.close()
            logger.info("Selesai proses auto-generate payrolls operator.")

    @staticmethod
    def auto_generate_nonoperator_payrolls():
        """
        Mingguan (Minggu jam 08:00 WIB): Generate payroll untuk karyawan NON-OPERATOR
        berdasarkan absensi periode Minggu s/d Sabtu seminggu sebelumnya.
        """
        logger.info("Memulai proses auto-generate payrolls NON-OPERATOR (mingguan)...")
        db: Session = SessionLocal()
        try:
            today = date.today()  # Ini adalah hari Minggu saat job berjalan
            # Minggu ini (hari ini) = period_end = Sabtu kemarin
            last_saturday = today - timedelta(days=1)
            # Minggu lalu = period_start = 7 hari sebelum Minggu ini
            last_sunday = today - timedelta(days=7)

            logger.info(f"Periode payroll non-operator: {last_sunday} s/d {last_saturday}")

            # Cari semua karyawan aktif yang BUKAN operator
            non_operator_employees = db.query(Employee).filter(
                Employee.is_active == True,
                ~Employee.position.ilike("%operator%")
            ).all()

            if not non_operator_employees:
                logger.info("Tidak ada karyawan non-operator aktif ditemukan.")
                return

            non_operator_ids = [e.id for e in non_operator_employees]
            logger.info(f"Ditemukan {len(non_operator_ids)} karyawan non-operator.")

            AutomationService._generate_payroll_for_employees(db, non_operator_ids, "Payroll Mingguan Non-Operator")

        except Exception as e:
            logger.error(f"Error pada auto_generate_nonoperator_payrolls: {str(e)}")
        finally:
            db.close()
            logger.info("Selesai proses auto-generate payrolls non-operator.")

    @staticmethod
    def auto_generate_invoices():
        """
        Harian (jam 03:00 WIB): Generate invoice untuk penjualan material yang belum ditagihkan.
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

            system_user = AutomationService._get_system_user(db)

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
