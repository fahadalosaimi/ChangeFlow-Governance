from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models.change_request import ChangeRequest
from app.schemas.change import ChangeRequestCreate, ChangeRequestDB
from app.ai_engine.risk_engine import analyze_change_request

router = APIRouter(
    prefix="/change-requests",
    tags=["Change Requests"]
)


@router.get("/stats")
def get_change_request_stats(db: Session = Depends(get_db)):
    total = db.query(ChangeRequest).count()

    low = db.query(ChangeRequest).filter(ChangeRequest.risk_level == "Low").count()
    medium = db.query(ChangeRequest).filter(ChangeRequest.risk_level == "Medium").count()
    high = db.query(ChangeRequest).filter(ChangeRequest.risk_level == "High").count()
    critical = db.query(ChangeRequest).filter(ChangeRequest.risk_level == "Critical").count()

    return {
        "total_changes": total,
        "low_risk": low,
        "medium_risk": medium,
        "high_risk": high,
        "critical_risk": critical
    }


@router.get("/{change_id}", response_model=ChangeRequestDB)
def get_change_request_by_id(change_id: int, db: Session = Depends(get_db)):
    change_request = db.query(ChangeRequest).filter(ChangeRequest.id == change_id).first()

    if not change_request:
        raise HTTPException(
            status_code=404,
            detail="Change request not found"
        )

    return change_request


@router.post("/", response_model=ChangeRequestDB)
def create_change_request(change: ChangeRequestCreate, db: Session = Depends(get_db)):
    analysis = analyze_change_request(change)

    db_change = ChangeRequest(
        title=change.title,
        description=change.description,
        change_type=change.change_type,
        related_systems=json.dumps(change.related_systems),
        planned_date=change.planned_date,
        expected_downtime=change.expected_downtime,
        business_justification=change.business_justification,
        risk_level=analysis.risk_level,
        impact_score=analysis.impact_score
    )

    db.add(db_change)
    db.commit()
    db.refresh(db_change)

    return db_change


@router.get("/", response_model=list[ChangeRequestDB])
def get_change_requests(db: Session = Depends(get_db)):
    return db.query(ChangeRequest).order_by(ChangeRequest.id.desc()).all()


@router.delete("/{change_id}")
def delete_change_request(change_id: int, db: Session = Depends(get_db)):
    change_request = db.query(ChangeRequest).filter(ChangeRequest.id == change_id).first()

    if not change_request:
        raise HTTPException(
            status_code=404,
            detail="Change request not found"
        )

    db.delete(change_request)
    db.commit()

    return {
        "message": "Change request deleted successfully",
        "deleted_id": change_id
    }