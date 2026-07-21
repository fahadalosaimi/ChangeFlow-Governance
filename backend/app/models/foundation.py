from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    industry = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    departments = relationship("Department", back_populates="organization")
    users = relationship("User", back_populates="organization")
    systems = relationship("ITSystem", back_populates="organization")
    services = relationship("ITService", back_populates="organization")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    users = relationship("User", back_populates="role")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    organization = relationship("Organization", back_populates="departments")
    users = relationship("User", back_populates="department")
    systems = relationship("ITSystem", back_populates="department")
    services = relationship("ITService", back_populates="department")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
    )
    department_id = Column(
        Integer,
        ForeignKey("departments.id"),
        nullable=True,
    )
    role_id = Column(
        Integer,
        ForeignKey("roles.id"),
        nullable=False,
    )

    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    is_active = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship(
        "Organization",
        back_populates="users",
    )
    department = relationship(
        "Department",
        back_populates="users",
    )
    role = relationship(
        "Role",
        back_populates="users",
    )

    owned_systems = relationship(
        "ITSystem",
        back_populates="owner",
    )

    
class ITService(Base):
    __tablename__ = "it_services"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    business_criticality = Column(String(50), default="Medium")

    organization = relationship("Organization", back_populates="services")
    department = relationship("Department", back_populates="services")
    systems = relationship("ITSystem", back_populates="service")


class ITSystem(Base):
    __tablename__ = "it_systems"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("it_services.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    system_type = Column(String(100), nullable=True)
    environment = Column(String(50), default="Production")
    criticality = Column(String(50), default="Medium")
    status = Column(String(50), default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="systems")
    department = relationship("Department", back_populates="systems")
    service = relationship("ITService", back_populates="systems")
    owner = relationship("User", back_populates="owned_systems")

    outgoing_dependencies = relationship(
        "SystemDependency",
        foreign_keys="SystemDependency.source_system_id",
        back_populates="source_system"
    )

    incoming_dependencies = relationship(
        "SystemDependency",
        foreign_keys="SystemDependency.target_system_id",
        back_populates="target_system"
    )


class SystemDependency(Base):
    __tablename__ = "system_dependencies"

    id = Column(Integer, primary_key=True, index=True)

    source_system_id = Column(Integer, ForeignKey("it_systems.id"), nullable=False)
    target_system_id = Column(Integer, ForeignKey("it_systems.id"), nullable=False)

    dependency_type = Column(String(100), nullable=False)
    impact_level = Column(String(50), default="Medium")
    description = Column(Text, nullable=True)

    source_system = relationship(
        "ITSystem",
        foreign_keys=[source_system_id],
        back_populates="outgoing_dependencies"
    )

    target_system = relationship(
        "ITSystem",
        foreign_keys=[target_system_id],
        back_populates="incoming_dependencies"
    )


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    system_id = Column(Integer, ForeignKey("it_systems.id"), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(50), default="Medium")
    status = Column(String(50), default="Resolved")
    occurred_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class RiskRule(Base):
    __tablename__ = "risk_rules"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)
    condition_type = Column(String(100), nullable=False)
    condition_value = Column(String(100), nullable=False)
    score = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(String(20), default="active")
    