from datetime import date, datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, between, func
from ..models import Employee, PayrollRecord, Project, Attendance, WorkLog, EmployeeLoan, Expense, User, Equipment
from ..schemas import PayrollCalculate, PayrollCalculationResult, PayrollCreate, PayrollUpdate
from ..core.exceptions import NotFoundError, ValidationError, AuthorizationError

class PayrollService:
    @staticmethod
    def calculate_payroll(
        db: Session,
        employee_id: int,
        period_start: date,
        period_end: date,
        overtime_hours: float = 0,
        bonus: float = 0,
        allowance: float = 0,
        loan_deduction: Optional[float] = None,
        other_deduction: float = 0,
    ) -> PayrollCalculationResult:
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise NotFoundError("Employee not found")

        auto_overtime_hours = 0
        basic_salary = 0
        present_days = 0
        
        daily_salary = employee.daily_salary or 0
        hourly_overtime_rate = employee.hourly_overtime_rate or 0

        attendances = (
            db.query(Attendance)
            .filter(
                and_(
                    Attendance.employee_id == employee.id,
                    between(Attendance.date, period_start, period_end),
                    Attendance.status.in_(["present", "late"]),
                    (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None) | (Attendance.payroll_id == None)
                )
            )
            .all()
        )
        present_days = len(attendances)
        
        for att in attendances:
            if att.check_in and att.check_out:
                work_hours = att.work_hours or 0
                if work_hours < 6:
                    basic_salary += (daily_salary * 0.5)
                else:
                    basic_salary += daily_salary
                
                if work_hours > 12:
                    auto_overtime_hours += (work_hours - 12)
            else:
                # Jika absen manual tanpa jam check in/out, hitung full
                basic_salary += daily_salary

        total_overtime_hours = overtime_hours + auto_overtime_hours

        work_days = 0
        current = period_start
        while current <= period_end:
            if current.weekday() < 6: # Monday to Saturday
                work_days += 1
            current += timedelta(days=1)

        absent_days = work_days - present_days

        auto_operator_bonus = 0
        if employee.position and employee.position.lower() == "operator":
            work_logs_with_eq = (
                db.query(WorkLog, Equipment)
                .join(Equipment, WorkLog.equipment_id == Equipment.id)
                .filter(
                    func.lower(WorkLog.operator_name) == func.lower(employee.name),
                    func.date(WorkLog.work_date) >= period_start,
                    func.date(WorkLog.work_date) <= period_end,
                )
                .all()
            )
            
            for wl, equipment in work_logs_with_eq:
                discount_hours = float(wl.rental_discount_hours or 0)
                if discount_hours <= 0:
                    continue
                    
                eq_type = equipment.type.lower() if equipment.type else ""
                
                if "breaker" in eq_type:
                    capacity = equipment.capacity or 0
                    if capacity >= 30:
                        auto_operator_bonus += discount_hours * 200000.0
                    else:
                        rate = float(equipment.rental_rate_per_hour or 0)
                        auto_operator_bonus += discount_hours * (0.5 * rate)
                elif "bucket" in eq_type:
                    capacity = equipment.capacity or 0
                    if capacity >= 30:
                        auto_operator_bonus += discount_hours * 150000.0
                    elif capacity >= 20:
                        auto_operator_bonus += discount_hours * 100000.0
                    else:
                        auto_operator_bonus += discount_hours * 100000.0
                else:
                    auto_operator_bonus += discount_hours * 100000.0

        total_bonus = bonus + auto_operator_bonus
        overtime_amount = hourly_overtime_rate * total_overtime_hours
        total_income = basic_salary + overtime_amount + total_bonus + allowance

        if loan_deduction is not None:
            actual_loan_deduction = min(loan_deduction, employee.loan_balance or 0)
        else:
            total_deduction_setting = (
                db.query(func.sum(EmployeeLoan.deduction_per_period))
                .filter(
                    EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
                )
                .scalar()
                or 0
            )
            total_balance = (
                db.query(func.sum(EmployeeLoan.remaining_balance))
                .filter(
                    EmployeeLoan.employee_id == employee.id, EmployeeLoan.is_active == True
                )
                .scalar()
                or 0
            )
            actual_loan_deduction = min(total_deduction_setting, total_balance)

        debt_deduction = min(employee.debt_to_company or 0, employee.debt_to_company or 0)
        total_deduction = actual_loan_deduction + debt_deduction + other_deduction
        net_salary = total_income - total_deduction

        loan_remaining = max(0, (employee.loan_balance or 0) - actual_loan_deduction)
        debt_remaining = max(0, (employee.debt_to_company or 0) - debt_deduction)

        return PayrollCalculationResult(
            employee_id=employee.id,
            employee_name=employee.name,
            period_start=period_start,
            period_end=period_end,
            work_days=work_days,
            present_days=present_days,
            absent_days=absent_days,
            basic_salary=basic_salary,
            overtime_hours=total_overtime_hours,
            overtime_amount=overtime_amount,
            bonus=total_bonus,
            allowance=allowance,
            total_income=total_income,
            loan_deduction=actual_loan_deduction,
            debt_deduction=debt_deduction,
            other_deduction=other_deduction,
            total_deduction=total_deduction,
            net_salary=net_salary,
            loan_remaining=loan_remaining,
            debt_remaining=debt_remaining,
        )

    @staticmethod
    def create_payroll(db: Session, current_user: User, payroll: PayrollCreate) -> PayrollRecord:
        existing_payroll = db.query(PayrollRecord).filter(
            PayrollRecord.employee_id == payroll.employee_id,
            PayrollRecord.period_start <= payroll.period_end,
            PayrollRecord.period_end >= payroll.period_start
        ).first()
        
        if existing_payroll:
            raise ValidationError(f"Payroll untuk karyawan ini pada periode yang bersinggungan (ID: {existing_payroll.id}, Periode: {existing_payroll.period_start} s/d {existing_payroll.period_end}) sudah ada.")

        calc_result = PayrollService.calculate_payroll(
            db=db,
            employee_id=payroll.employee_id,
            period_start=payroll.period_start,
            period_end=payroll.period_end,
            overtime_hours=payroll.overtime_hours or 0,
            bonus=payroll.bonus or 0,
            allowance=payroll.allowance or 0,
            loan_deduction=payroll.loan_deduction,
            other_deduction=payroll.other_deduction or 0,
        )

        db_payroll = PayrollRecord(
            employee_id=payroll.employee_id,
            period_start=payroll.period_start,
            period_end=payroll.period_end,
            work_days=calc_result.work_days,
            present_days=calc_result.present_days,
            absent_days=calc_result.absent_days,
            overtime_hours=calc_result.overtime_hours,
            overtime_amount=calc_result.overtime_amount,
            basic_salary=calc_result.basic_salary,
            bonus=calc_result.bonus,
            allowance=payroll.allowance or 0,
            total_income=calc_result.total_income,
            loan_deduction=calc_result.loan_deduction,
            debt_deduction=calc_result.debt_deduction,
            other_deduction=payroll.other_deduction or 0,
            total_deduction=calc_result.total_deduction,
            net_salary=calc_result.net_salary,
            project_id=payroll.project_id,
            payment_status="approved" if current_user.role == "gm" or current_user.is_admin or current_user.is_superuser else "pending",
            notes=payroll.notes,
            created_by=current_user.id,
        )

        employee = db.query(Employee).filter(Employee.id == payroll.employee_id).first()
        if current_user.role == "gm" or current_user.is_admin or current_user.is_superuser:
            db_payroll.approved_by = current_user.id
            db_payroll.approved_at = datetime.now()
            if employee:
                employee.loan_balance = calc_result.loan_remaining
                employee.debt_to_company = calc_result.debt_remaining

        db.add(db_payroll)
        db.commit()
        db.refresh(db_payroll)

        attendances_to_mark = db.query(Attendance).filter(
            Attendance.employee_id == payroll.employee_id,
            Attendance.date >= payroll.period_start,
            Attendance.date <= payroll.period_end,
            (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None) | (Attendance.payroll_id == None)
        ).all()
        for att in attendances_to_mark:
            att.is_payroll_generated = True
            att.payroll_id = db_payroll.id
        if attendances_to_mark:
            db.commit()

        return db_payroll

    @staticmethod
    def get_payroll_records(
        db: Session,
        employee_id: Optional[int] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        payment_status: Optional[str] = None,
    ) -> List[PayrollRecord]:
        query = db.query(PayrollRecord)
        if employee_id:
            query = query.filter(PayrollRecord.employee_id == employee_id)
        if period_start and period_end:
            query = query.filter(
                and_(
                    PayrollRecord.period_start >= period_start,
                    PayrollRecord.period_end <= period_end,
                )
            )
        if payment_status:
            query = query.filter(PayrollRecord.payment_status == payment_status)

        records = query.order_by(PayrollRecord.period_start.desc()).all()
        for record in records:
            record.employee_name = record.employee.name if record.employee else None
            if record.project_id:
                project = db.query(Project).filter(Project.id == record.project_id).first()
                record.project_name = project.name if project else None
            else:
                record.project_name = None

        return records

    @staticmethod
    def update_payroll(db: Session, payroll_id: int, data: PayrollUpdate) -> PayrollRecord:
        payroll = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
        if not payroll:
            raise NotFoundError("Payroll record not found")

        if payroll.payment_status == "paid":
            raise ValidationError("Slip gaji dengan status 'paid' tidak dapat diedit. Hubungi superadmin.")

        old_loan_deduction = payroll.loan_deduction or 0
        old_debt_deduction = payroll.debt_deduction or 0

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(payroll, key, value)
        
        payroll.total_income = (payroll.basic_salary or 0) + (payroll.overtime_amount or 0) + (payroll.bonus or 0) + (payroll.allowance or 0)
        payroll.total_deduction = (payroll.loan_deduction or 0) + (payroll.debt_deduction or 0) + (payroll.other_deduction or 0)
        payroll.net_salary = payroll.total_income - payroll.total_deduction
        
        if payroll.payment_status == "approved" and payroll.employee:
            new_loan_deduction = payroll.loan_deduction or 0
            new_debt_deduction = payroll.debt_deduction or 0
            
            diff_loan = new_loan_deduction - old_loan_deduction
            diff_debt = new_debt_deduction - old_debt_deduction
            
            payroll.employee.loan_balance = max(0, (payroll.employee.loan_balance or 0) - diff_loan)
            payroll.employee.debt_to_company = max(0, (payroll.employee.debt_to_company or 0) - diff_debt)

        db.commit()
        db.refresh(payroll)
        
        payroll.employee_name = payroll.employee.name if payroll.employee else None
        return payroll

    @staticmethod
    def approve_payroll(db: Session, current_user: User, payroll_id: int, approval_note: Optional[str] = None) -> PayrollRecord:
        payroll = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
        if not payroll:
            raise NotFoundError("Payroll record not found")

        if payroll.payment_status != "pending":
            raise ValidationError("Payroll already processed")

        payroll.payment_status = "approved"
        payroll.approved_by = current_user.id
        payroll.approved_at = datetime.now()
        payroll.approval_note = approval_note

        employee = payroll.employee
        if employee:
            employee.loan_balance = max(0, (employee.loan_balance or 0) - (payroll.loan_deduction or 0))
            employee.debt_to_company = max(0, (employee.debt_to_company or 0) - (payroll.debt_deduction or 0))

        db.commit()
        db.refresh(payroll)
        return payroll

    @staticmethod
    def pay_payroll(db: Session, current_user: User, payroll_id: int) -> PayrollRecord:
        payroll = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
        if not payroll:
            raise NotFoundError("Payroll record not found")

        if payroll.payment_status == "paid":
            raise ValidationError("Payroll already paid")
            
        if payroll.payment_status == "pending":
            raise ValidationError("Payroll must be approved first")

        payroll.payment_status = "paid"
        payroll.payment_date = date.today()
        
        expense = Expense(
            category="gaji",
            description=f"Pembayaran Gaji: {payroll.employee.name if payroll.employee else '-'} (Periode {payroll.period_start} s/d {payroll.period_end})",
            amount=float(payroll.net_salary or 0),
            expense_date=date.today(),
            created_by=current_user.id,
            approval_status="approved",
            approved_by=current_user.id,
            approved_at=datetime.now(),
            payment_status="paid",
            paid_by=current_user.id,
            paid_at=datetime.now(),
            project_id=payroll.project_id
        )
        db.add(expense)
        
        db.commit()
        db.refresh(payroll)
        return payroll

    @staticmethod
    def unpay_payroll(db: Session, current_user: User, payroll_id: int) -> PayrollRecord:
        payroll = db.query(PayrollRecord).filter(PayrollRecord.id == payroll_id).first()
        if not payroll:
            raise NotFoundError("Payroll record not found")

        if payroll.payment_status != "paid":
            raise ValidationError("Hanya payroll dengan status 'paid' yang dapat diubah menjadi unpaid.")

        payroll.payment_status = "approved"
        payroll.payment_date = None
        
        expense_description = f"Pembayaran Gaji: {payroll.employee.name if payroll.employee else '-'} (Periode {payroll.period_start} s/d {payroll.period_end})"
        expense = db.query(Expense).filter(
            Expense.category == "gaji",
            Expense.description == expense_description,
            Expense.amount == float(payroll.net_salary or 0)
        ).first()
        
        if expense:
            db.delete(expense)
            
        db.commit()
        db.refresh(payroll)
        return payroll

    @staticmethod
    def try_auto_generate_operator_payroll(
        db: Session,
        employee: Employee,
        target_date: date,
    ) -> Optional[PayrollRecord]:
        """
        Mencoba membuat draft payroll otomatis untuk operator jika DUA kondisi terpenuhi:
        1. Operator sudah checkout (attendance.check_out terisi) pada target_date
        2. Ada minimal 1 WorkLog dengan operator_name == employee.name pada target_date

        Jika salah satu kondisi belum terpenuhi, atau payroll untuk tanggal itu sudah ada → skip (return None).
        Method ini aman dipanggil berkali-kali (idempotent).
        """
        import logging
        logger = logging.getLogger(__name__)

        # Hanya untuk karyawan posisi operator
        if not employee.position or "operator" not in employee.position.lower():
            return None

        # Kondisi 1: Cek apakah operator sudah checkout pada target_date
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == employee.id,
            Attendance.date == target_date,
            Attendance.check_out.isnot(None),
        ).first()
        if not attendance:
            logger.debug(
                f"[AutoPayroll] Operator {employee.name} belum checkout pada {target_date}, skip."
            )
            return None

        # Kondisi 2: Cek apakah ada work log alat untuk operator pada target_date
        from ..models.work_log import WorkLog
        has_work_log = db.query(WorkLog).filter(
            func.lower(WorkLog.operator_name) == func.lower(employee.name),
            func.date(WorkLog.work_date) == target_date,
        ).first()
        if not has_work_log:
            logger.debug(
                f"[AutoPayroll] Belum ada work log alat untuk operator {employee.name} pada {target_date}, skip."
            )
            return None

        # Cek apakah payroll untuk tanggal ini sudah ada (avoid duplicate)
        existing = db.query(PayrollRecord).filter(
            PayrollRecord.employee_id == employee.id,
            PayrollRecord.period_start <= target_date,
            PayrollRecord.period_end >= target_date,
        ).first()
        if existing:
            logger.info(
                f"[AutoPayroll] Payroll untuk operator {employee.name} pada {target_date} sudah ada (ID: {existing.id}), skip."
            )
            return None

        # Ambil system user untuk created_by
        system_user = db.query(User).filter(
            User.role.in_(["gm", "admin"]), User.is_active == True
        ).first()
        if not system_user:
            logger.warning("[AutoPayroll] Tidak ada user GM/Admin aktif, tidak bisa membuat payroll otomatis.")
            return None

        # Buat draft payroll untuk 1 hari
        from ..schemas.employee import PayrollCreate
        payroll_data = PayrollCreate(
            employee_id=employee.id,
            period_start=target_date,
            period_end=target_date,
            overtime_hours=0,
            bonus=0,
            allowance=0,
            loan_deduction=None,
            other_deduction=0,
            notes="[Auto-Generated] Dibuat otomatis saat operator checkout dan work log alat tersedia.",
        )

        try:
            new_payroll = PayrollService.create_payroll(db, system_user, payroll_data)
            logger.info(
                f"[AutoPayroll] Draft payroll berhasil dibuat untuk operator {employee.name} "
                f"tanggal {target_date} (Payroll ID: {new_payroll.id})"
            )
            return new_payroll
        except Exception as e:
            logger.error(
                f"[AutoPayroll] Gagal membuat payroll untuk operator {employee.name} "
                f"tanggal {target_date}: {str(e)}"
            )
            return None

    @staticmethod
    def try_auto_generate_nonoperator_weekly_payroll(
        db: Session,
        employee: Employee,
        attendance_date: date,
    ) -> Optional[PayrollRecord]:
        """
        Mencoba membuat draft payroll mingguan otomatis untuk karyawan NON-OPERATOR
        ketika mereka checkout di akhir minggu kerja.

        Trigger berlaku jika attendance.date jatuh pada:
        - Hari SABTU (weekday 5)  → periode minggu ini: Minggu s/d Sabtu
        - Hari SABTU juga berlaku untuk shift sore yang checkout fisik di Minggu,
          karena attendance.date-nya tetap Sabtu (checkin di Sabtu).

        Method ini idempotent: jika payroll untuk periode tersebut sudah ada → skip.
        Scheduled job mingguan (AutomationService) tetap berjalan sebagai fallback
        untuk karyawan yang tidak hadir di Sabtu.
        """
        import logging
        logger = logging.getLogger(__name__)

        # Hanya untuk karyawan NON-operator
        if employee.position and "operator" in employee.position.lower():
            return None

        # Tentukan hari kerja dari attendance_date
        day_of_week = attendance_date.weekday()  # 0=Senin, 5=Sabtu, 6=Minggu

        if day_of_week == 5:
            # Sabtu → periode: Minggu lalu s/d Sabtu ini
            period_end = attendance_date
            period_start = attendance_date - timedelta(days=6)
        else:
            # Bukan Sabtu → tidak ada trigger mingguan
            logger.debug(
                f"[AutoPayroll-Weekly] {employee.name} checkout pada {attendance_date} "
                f"(hari {day_of_week}), bukan hari Sabtu → skip trigger mingguan."
            )
            return None

        logger.info(
            f"[AutoPayroll-Weekly] Checkout Sabtu terdeteksi untuk {employee.name}. "
            f"Mencoba generate payroll mingguan periode {period_start} s/d {period_end}."
        )

        # Cek apakah ada absensi yang belum dibayar dalam periode ini
        ungenerated_attendances = db.query(Attendance).filter(
            Attendance.employee_id == employee.id,
            Attendance.date >= period_start,
            Attendance.date <= period_end,
            Attendance.status.in_(["present", "late"]),
            (Attendance.is_payroll_generated == False) | (Attendance.is_payroll_generated == None),
            Attendance.payroll_id == None,
        ).count()

        if ungenerated_attendances == 0:
            logger.info(
                f"[AutoPayroll-Weekly] Tidak ada absensi baru untuk {employee.name} "
                f"periode {period_start} s/d {period_end}, skip."
            )
            return None

        # Cek apakah payroll periode ini sudah ada (hindari duplikat)
        existing = db.query(PayrollRecord).filter(
            PayrollRecord.employee_id == employee.id,
            PayrollRecord.period_start <= period_end,
            PayrollRecord.period_end >= period_start,
        ).first()
        if existing:
            logger.info(
                f"[AutoPayroll-Weekly] Payroll untuk {employee.name} periode "
                f"{period_start} s/d {period_end} sudah ada (ID: {existing.id}), skip."
            )
            return None

        # Ambil system user untuk created_by
        system_user = db.query(User).filter(
            User.role.in_(["gm", "admin"]), User.is_active == True
        ).first()
        if not system_user:
            logger.warning("[AutoPayroll-Weekly] Tidak ada user GM/Admin aktif, tidak bisa membuat payroll.")
            return None

        from ..schemas.employee import PayrollCreate
        payroll_data = PayrollCreate(
            employee_id=employee.id,
            period_start=period_start,
            period_end=period_end,
            overtime_hours=0,
            bonus=0,
            allowance=0,
            loan_deduction=None,
            other_deduction=0,
            notes=(
                f"[Auto-Generated] Dibuat otomatis saat checkout hari Sabtu "
                f"(periode {period_start} s/d {period_end})."
            ),
        )

        try:
            new_payroll = PayrollService.create_payroll(db, system_user, payroll_data)
            logger.info(
                f"[AutoPayroll-Weekly] Draft payroll mingguan berhasil dibuat untuk "
                f"{employee.name} periode {period_start} s/d {period_end} "
                f"(Payroll ID: {new_payroll.id})"
            )
            return new_payroll
        except Exception as e:
            logger.error(
                f"[AutoPayroll-Weekly] Gagal membuat payroll untuk {employee.name} "
                f"periode {period_start} s/d {period_end}: {str(e)}"
            )
            return None

