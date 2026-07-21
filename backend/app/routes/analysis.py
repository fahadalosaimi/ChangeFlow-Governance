from fastapi import APIRouter
from app.schemas.change import ChangeRequestInput, ChangeAnalysisOutput
from app.ai_engine.risk_engine import analyze_change_request

router = APIRouter(
    prefix="/analysis",
    tags=["AI Analysis"]
)


@router.post("/analyze-change", response_model=ChangeAnalysisOutput)
def analyze_change(change: ChangeRequestInput):
    return analyze_change_request(change)