from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.foundation_analysis import (
    FoundationImpactAnalysisInput,
    FoundationImpactAnalysisOutput,
)
from app.services.foundation_risk_engine import analyze_foundation_change


router = APIRouter(
    prefix="/foundation-analysis",
    tags=["Foundation-Based Analysis"],
)


@router.post("/analyze", response_model=FoundationImpactAnalysisOutput)
def analyze_change_with_foundation_data(
    change: FoundationImpactAnalysisInput,
    db: Session = Depends(get_db),
):
    try:
        return analyze_foundation_change(db, change)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))