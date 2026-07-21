from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from app.database import Base


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    change_type = Column(String(100), nullable=False)
    related_systems = Column(Text, nullable=False)
    planned_date = Column(String(100), nullable=True)
    expected_downtime = Column(String(100), nullable=True)
    business_justification = Column(Text, nullable=True)
    risk_level = Column(String(50), nullable=True)
    impact_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)