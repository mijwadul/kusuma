import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from ..services.automation_service import AutomationService

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Asia/Jakarta")

def start_scheduler():
    # Job untuk Payroll Operator - Setiap hari jam 03:00 WIB
    scheduler.add_job(
        AutomationService.auto_generate_payrolls,
        trigger=CronTrigger(hour=3, minute=0, timezone="Asia/Jakarta"),
        id="auto_generate_payrolls",
        name="Generate operator payroll automatically",
        replace_existing=True
    )

    # Job untuk Invoice Material - Setiap hari jam 03:00 WIB
    scheduler.add_job(
        AutomationService.auto_generate_invoices,
        trigger=CronTrigger(hour=3, minute=0, timezone="Asia/Jakarta"),
        id="auto_generate_invoices",
        name="Generate material sales invoices automatically",
        replace_existing=True
    )

    scheduler.start()
    logger.info("Scheduler started successfully. Payroll and Invoice generators scheduled for 03:00 AM WIB.")

def stop_scheduler():
    scheduler.shutdown()
    logger.info("Scheduler stopped.")
