from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    client_name = Column(String(200), nullable=True)      # Nama klien / pemesan proyek
    description = Column(Text, nullable=True)             # Deskripsi proyek
    location = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    budget = Column(Float)
    progress = Column(Float, default=0.0)  # percentage
    status = Column(String, default="ongoing")  # ongoing, completed, paused
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    material_items = relationship("ProjectMaterialItem", back_populates="project", cascade="all, delete-orphan")