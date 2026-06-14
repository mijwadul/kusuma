from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

project_assignments = Table(
    "project_assignments",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
)

project_employees = Table(
    "project_employees",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("employee_id", Integer, ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True)
)

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    client_name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    location = Column(String(255))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    budget = Column(Float)
    progress = Column(Float, default=0.0)
    status = Column(String(30), default="ongoing")
    is_active = Column(Boolean, default=True)
    measurement_type = Column(String(30), default="tonase") # 'tonase' or 'kubikasi'
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    material_items = relationship("ProjectMaterialItem", back_populates="project", cascade="all, delete-orphan")
    assigned_users = relationship("User", secondary=project_assignments, backref="assigned_projects")
    assigned_employees = relationship("Employee", secondary=project_employees, backref="assigned_projects")