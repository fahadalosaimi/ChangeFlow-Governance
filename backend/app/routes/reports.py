from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models.change_request import ChangeRequest
from app.schemas.change import ChangeRequestInput, ImpactReportOutput
from app.services.report_generator import generate_impact_report

router = APIRouter(
    prefix="/reports",
    tags=["Impact Reports"]
)


@router.post("/generate-impact-report", response_model=ImpactReportOutput)
def create_impact_report(change: ChangeRequestInput):
    return generate_impact_report(change)


@router.get("/generate-impact-report/{change_id}", response_model=ImpactReportOutput)
def create_impact_report_from_saved_request(
    change_id: int,
    db: Session = Depends(get_db)
):
    change_request = db.query(ChangeRequest).filter(ChangeRequest.id == change_id).first()

    if not change_request:
        raise HTTPException(
            status_code=404,
            detail="Change request not found"
        )

    related_systems = json.loads(change_request.related_systems)

    change_input = ChangeRequestInput(
        title=change_request.title,
        description=change_request.description,
        change_type=change_request.change_type,
        related_systems=related_systems,
        planned_date=change_request.planned_date,
        expected_downtime=change_request.expected_downtime,
        business_justification=change_request.business_justification
    )

    return generate_impact_report(change_input)