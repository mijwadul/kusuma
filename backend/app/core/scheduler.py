import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from ..services.automation_service import AutomationService

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Jakarta")


def start_scheduler():
    # Job 1: Payroll OPERATOR - Setiap hari jam 03:00 WIB
    scheduler.add_job(
        AutomationService.auto_generate_operator_payrolls,
        trigger=CronTrigger(hour=3, minute=0, timezone="Asia/Jakarta"),
        id="auto_generate_operator_payrolls",
        name="[Harian 03:00] Generate payroll operator",
        replace_existing=True
    )

    # Job 2: Payroll NON-OPERATOR - Setiap Minggu jam 08:00 WIB
    # day_of_week=6 = Minggu (0=Senin, 6=Minggu)
    scheduler.add_job(
        AutomationService.auto_generate_nonoperator_payrolls,
        trigger=CronTrigger(day_of_week=6, hour=8, minute=0, timezone="Asia/Jakarta"),
        id="auto_generate_nonoperator_payrolls",
        name="[Mingguan Minggu 08:00] Generate payroll non-operator",
        replace_existing=True
    )

    # Job 3: Invoice Material - Setiap hari jam 03:00 WIB
    scheduler.add_job(
        AutomationService.auto_generate_invoices,
        trigger=CronTrigger(hour=3, minute=0, timezone="Asia/Jakarta"),
        id="auto_generate_invoices",
        name="[Harian 03:00] Generate invoice penjualan material",
        replace_existing=True
    )

    scheduler.start()
    logger.info(
        "Scheduler started. Jobs terdaftar:\n"
        "  - Payroll OPERATOR   : setiap hari 03:00 WIB\n"
        "  - Payroll NON-OPERATOR: setiap Minggu 08:00 WIB\n"
        "  - Invoice Material   : setiap hari 03:00 WIB"
    )


def stop_scheduler():
    scheduler.shutdown()
    logger.info("Scheduler stopped.")
