from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Employee, EmployeeLoan, User
from ..schemas import EmployeeCreate, EmployeeUpdate, EmployeeListResponse, EmployeePublic, Employee as EmployeeSchema
from ..core.exceptions import NotFoundError, ValidationError, AuthorizationError

class EmployeeService:
    @staticmethod
    def get_employees(
        db: Session, 
        current_user: User,
        skip: int = 0, 
        limit: int = 100,
        department: Optional[str] = None,
        status: Optional[str] = None,
        show_inactive: bool = False
    ) -> List[Any]:
        query = db.query(Employee)
        
        if not show_inactive:
            query = query.filter(Employee.is_active == True)
            
        if department:
            query = query.filter(Employee.department == department)
        if status:
            query = query.filter(Employee.status == status)
            
        employees = query.offset(skip).limit(limit).all()
        
        # Check finance access
        finance_roles = ["gm", "finance", "admin", "checker"]
        has_finance_access = current_user.role in finance_roles or current_user.is_admin or current_user.is_superuser
        
        employee_ids = [emp.id for emp in employees]
        loan_map = {}
        if has_finance_access and employee_ids:
            loan_stats = (
                db.query(
                    EmployeeLoan.employee_id,
                    func.sum(EmployeeLoan.remaining_balance).label("total_balance"),
                    func.sum(EmployeeLoan.deduction_per_period).label("total_deduction"),
                )
                .filter(
                    EmployeeLoan.employee_id.in_(employee_ids),
                    EmployeeLoan.is_active == True,
                )
                .group_by(EmployeeLoan.employee_id)
                .all()
            )
            for stat in loan_stats:
                loan_map[stat.employee_id] = stat

        result = []
        for emp in employees:
            emp_data = {
                "id": emp.id,
                "employee_code": emp.employee_code,
                "name": emp.name,
                "position": emp.position,
                "department": emp.department,
                "status": emp.status,
                "is_active": emp.is_active,
                "has_loan": (emp.loan_balance or 0) > 0,
                "has_debt": (emp.debt_to_company or 0) > 0,
            }
            if has_finance_access:
                emp_data["daily_salary"] = emp.daily_salary
                stat = loan_map.get(emp.id)
                if stat:
                    emp_data["loan_balance"] = stat.total_balance
                    emp_data["loan_deduction_per_period"] = stat.total_deduction
                else:
                    emp_data["loan_balance"] = 0
                    emp_data["loan_deduction_per_period"] = 0
            
            result.append(EmployeeListResponse(**emp_data))
        
        return result

    @staticmethod
    def get_employee(db: Session, current_user: User, employee_id: int) -> Any:
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise NotFoundError("Employee not found")
            
        finance_roles = ["gm", "finance", "admin", "checker"]
        has_finance_access = current_user.role in finance_roles or current_user.is_admin or current_user.is_superuser
        
        if has_finance_access:
            return EmployeeSchema.model_validate(employee)
        else:
            return EmployeePublic.model_validate(employee)

    @staticmethod
    def create_employee(db: Session, employee: EmployeeCreate) -> EmployeeSchema:
        existing = db.query(Employee).filter(
            Employee.email == employee.email,
            Employee.is_active == True
        ).first()
        if existing:
            raise ValidationError("Email already registered")

        if employee.nik:
            existing_nik = db.query(Employee).filter(
                Employee.nik == employee.nik,
                Employee.is_active == True
            ).first()
            if existing_nik:
                raise ValidationError("NIK already registered")

        db_employee = Employee(**employee.model_dump(exclude_unset=True))
        db.add(db_employee)
        db.commit()
        db.refresh(db_employee)
        return db_employee

    @staticmethod
    def update_employee(db: Session, current_user: User, employee_id: int, employee_update: EmployeeUpdate) -> EmployeeSchema:
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise NotFoundError("Employee not found")

        update_data = employee_update.model_dump(exclude_unset=True)
        
        finance_roles = ["gm", "finance", "admin", "checker"]
        has_finance_access = current_user.role in finance_roles or current_user.is_admin or current_user.is_superuser

        if not has_finance_access:
            financial_fields = [
                "daily_salary",
                "hourly_overtime_rate",
                "loan_balance",
                "loan_deduction_per_period",
                "debt_to_company",
                "work_days_per_month",
            ]
            for field in financial_fields:
                if field in update_data:
                    del update_data[field]

        for key, value in update_data.items():
            setattr(employee, key, value)

        db.commit()
        db.refresh(employee)
        return employee

    @staticmethod
    def delete_employee(db: Session, employee_id: int) -> None:
        employee = db.query(Employee).filter(Employee.id == employee_id).first()
        if not employee:
            raise NotFoundError("Employee not found")

        employee.is_active = False
        employee.status = "terminated"
        employee.email = f"deleted_{employee_id}_{employee.email}"
        if employee.nik:
            employee.nik = f"deleted_{employee_id}_{employee.nik}"
        db.commit()
