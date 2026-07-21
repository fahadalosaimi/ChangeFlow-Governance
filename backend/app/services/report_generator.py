from app.schemas.change import ChangeRequestInput, ImpactReportOutput
from app.ai_engine.risk_engine import analyze_change_request


def get_decision_recommendation(risk_level: str) -> tuple[str, str]:
    if risk_level == "Low":
        return (
            "Proceed",
            "The change has low technical impact and can proceed with normal review."
        )

    if risk_level == "Medium":
        return (
            "Proceed with Review",
            "The change has moderate impact and should be reviewed by the responsible technical team before implementation."
        )

    if risk_level == "High":
        return (
            "Requires Manager Approval",
            "The change has high impact and should be approved by the IT manager or change manager before implementation."
        )

    if risk_level == "Critical":
        return (
            "Do Not Proceed Without CAB Approval",
            "The change is critical and should not proceed without formal Change Advisory Board approval, rollback planning, and stakeholder coordination."
        )

    return (
        "Review Required",
        "The change requires additional review before implementation."
    )


def generate_impact_report(change: ChangeRequestInput) -> ImpactReportOutput:
    analysis = analyze_change_request(change)

    decision_recommendation, decision_reason = get_decision_recommendation(
        analysis.risk_level
    )

    executive_summary = (
        f"The proposed change '{change.title}' has been analyzed and classified as "
        f"{analysis.risk_level} risk with an impact score of {analysis.impact_score}%. "
        f"The change may affect {len(analysis.affected_systems)} system(s) and requires "
        f"coordination with the affected teams before implementation."
    )

    final_note = (
        "This report is generated to support IT decision-making before implementing "
        "the proposed change. The final approval should be reviewed by the responsible "
        "IT team or change management authority."
    )

    return ImpactReportOutput(
        report_title=f"Impact Assessment Report - {change.title}",
        change_title=change.title,
        risk_level=analysis.risk_level,
        impact_score=analysis.impact_score,
        decision_recommendation=decision_recommendation,
        decision_reason=decision_reason,
        executive_summary=executive_summary,
        technical_summary=analysis.technical_summary,
        ai_explanation=analysis.ai_explanation,
        risk_factors=analysis.risk_factors,
        affected_systems=analysis.affected_systems,
        affected_departments=analysis.affected_departments,
        recommendations=analysis.recommendations,
        rollback_plan=analysis.rollback_plan,
        testing_checklist=analysis.testing_checklist,
        final_note=final_note
    )