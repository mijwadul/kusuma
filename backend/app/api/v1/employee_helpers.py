from ...models import User


def check_finance_access(user: User) -> bool:
    """Check if user has Finance/GM access for financial data"""
    finance_roles = ["gm", "finance", "admin", "checker"]
    return user.role in finance_roles or user.is_admin or user.is_superuser


def check_admin_access(user: User) -> bool:
    """Check if user has Admin/GM access for employee management"""
    admin_roles = ["gm", "admin", "helper"]
    return user.role in admin_roles or user.is_admin or user.is_superuser
