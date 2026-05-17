from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

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
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    material_items = relationship("ProjectMaterialItem", back_populates="project", cascade="all, delete-orphan")