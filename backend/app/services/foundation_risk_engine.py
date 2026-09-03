from sqlalchemy.orm import Session

from app.models.foundation import (
    Incident,
    ITSystem,
    RiskRule,
    SystemDependency,
)
from app.schemas.foundation_analysis import (
    FoundationImpactAnalysisInput,
    FoundationImpactAnalysisOutput,
)


def get_rule_score(
    db: Session,
    condition_type: str,
    condition_value: str,
) -> int:
    rule = (
        db.query(RiskRule)
        .filter(
            RiskRule.condition_type
            == condition_type,
            RiskRule.condition_value
            == condition_value,
            RiskRule.is_active == "active",
        )
        .first()
    )

    if not rule:
        return 0

    return rule.score


def get_risk_level(score: int) -> str:
    if score >= 80:
        return "Critical"

    if score >= 60:
        return "High"

    if score >= 35:
        return "Medium"

    return "Low"


def get_decision_recommendation(
    risk_level: str,
) -> str:
    if risk_level == "Low":
        return "Proceed"

    if risk_level == "Medium":
        return "Proceed with Review"

    if risk_level == "High":
        return "Requires Manager Approval"

    if risk_level == "Critical":
        return (
            "Do Not Proceed Without CAB Approval"
        )

    return "Review Required"


def analyze_foundation_change(
    db: Session,
    change: FoundationImpactAnalysisInput,
    organization_id: int,
) -> FoundationImpactAnalysisOutput:
    score = 0

    risk_factors: list[str] = []
    directly_affected_systems: list[str] = []
    indirectly_affected_systems: list[str] = []
    affected_departments: set[str] = set()
    system_owners: set[str] = set()
    previous_incidents: list[str] = []

    requested_system_ids = set(
        change.affected_system_ids
    )

    affected_systems = (
        db.query(ITSystem)
        .filter(
            ITSystem.organization_id
            == organization_id,
            ITSystem.id.in_(requested_system_ids),
        )
        .all()
    )

    found_system_ids = {
        system.id
        for system in affected_systems
    }

    if found_system_ids != requested_system_ids:
        raise ValueError(
            "One or more affected configuration "
            "items were not found in your organization."
        )

    change_type_score = get_rule_score(
        db,
        "change_type",
        change.change_type,
    )
    score += change_type_score

    if change_type_score > 0:
        risk_factors.append(
            f"Change type '{change.change_type}' "
            "contributes to the overall risk "
            "exposure based on the defined change "
            "governance rules."
        )

    change_mode_score = get_rule_score(
        db,
        "change_mode",
        change.change_mode,
    )
    score += change_mode_score

    if change_mode_score > 0:
        risk_factors.append(
            f"Change mode '{change.change_mode}' "
            "requires additional governance "
            "consideration based on the change "
            "classification."
        )

    for system in affected_systems:
        directly_affected_systems.append(
            system.name
        )

        if system.department:
            affected_departments.add(
                system.department.name
            )

        if system.owner:
            system_owners.add(
                system.owner.full_name
            )

        criticality_score = get_rule_score(
            db,
            "system_criticality",
            system.criticality,
        )
        score += criticality_score

        if criticality_score > 0:
            risk_factors.append(
                f"{system.name} is classified as a "
                f"{system.criticality} criticality "
                "configuration item, which increases "
                "the required level of review."
            )

        incoming_dependencies = (
            db.query(SystemDependency)
            .filter(
                SystemDependency.target_system_id
                == system.id
            )
            .all()
        )

        for dependency in incoming_dependencies:
            source_system = (
                db.query(ITSystem)
                .filter(
                    ITSystem.id
                    == dependency.source_system_id,
                    ITSystem.organization_id
                    == organization_id,
                )
                .first()
            )

            if not source_system:
                continue

            indirectly_affected_systems.append(
                f"{source_system.name} depends on "
                f"{system.name} "
                f"({dependency.impact_level})"
            )

            if source_system.department:
                affected_departments.add(
                    source_system.department.name
                )

            if source_system.owner:
                system_owners.add(
                    source_system.owner.full_name
                )

            dependency_score = get_rule_score(
                db,
                "dependency_impact",
                dependency.impact_level,
            )
            score += dependency_score

            if dependency_score > 0:
                risk_factors.append(
                    f"{source_system.name} has a "
                    f"{dependency.impact_level} "
                    f"dependency on {system.name}, "
                    "indicating potential downstream "
                    "service impact."
                )

        incidents = (
            db.query(Incident)
            .filter(
                Incident.system_id == system.id
            )
            .all()
        )

        for incident in incidents:
            previous_incidents.append(
                f"{incident.title} "
                f"({incident.severity})"
            )

            incident_score = get_rule_score(
                db,
                "previous_incident",
                incident.severity,
            )
            score += incident_score

            if incident_score > 0:
                risk_factors.append(
                    f"Historical incident "
                    f"'{incident.title}' with "
                    f"{incident.severity} severity "
                    "indicates prior operational risk "
                    "on this configuration item."
                )

    if change.expected_downtime_minutes >= 120:
        downtime_condition = (
            "120_minutes_or_more"
        )
        downtime_message = (
            "Expected downtime is 120 minutes "
            "or more."
        )

    elif change.expected_downtime_minutes >= 30:
        downtime_condition = (
            "30_to_119_minutes"
        )
        downtime_message = (
            "Expected downtime is 30 minutes "
            "or more."
        )

    elif change.expected_downtime_minutes > 0:
        downtime_condition = (
            "under_30_minutes"
        )
        downtime_message = (
            "The change includes expected downtime."
        )

    else:
        downtime_condition = "none"
        downtime_message = None

    downtime_score = get_rule_score(
        db,
        "expected_downtime",
        downtime_condition,
    )
    score += downtime_score

    if (
        downtime_score > 0
        and downtime_message
    ):
        risk_factors.append(
            downtime_message
        )

    rollback_value = (
        change.rollback_complexity.lower()
    )

    rollback_score = get_rule_score(
        db,
        "rollback_complexity",
        rollback_value,
    )
    score += rollback_score

    if rollback_score > 0:
        risk_factors.append(
            "Rollback complexity is "
            f"{rollback_value}."
        )

    security_value = (
        change.security_sensitivity.lower()
    )

    security_score = get_rule_score(
        db,
        "security_sensitivity",
        security_value,
    )
    score += security_score

    if security_score > 0:
        risk_factors.append(
            "Security sensitivity is "
            f"{security_value}."
        )

    impact_score = min(score, 100)
    risk_level = get_risk_level(
        impact_score
    )

    decision_recommendation = (
        get_decision_recommendation(
            risk_level
        )
    )

    recommendations = [
        (
            "Review all affected systems and "
            "dependencies before implementation."
        ),
        (
            "Notify system owners and affected "
            "departments before the change."
        ),
        (
            "Validate the change in a staging or "
            "test environment when possible."
        ),
        (
            "Prepare a rollback plan before "
            "approval."
        ),
        (
            "Schedule the change during an "
            "approved maintenance window."
        ),
        (
            "Monitor affected systems after "
            "implementation."
        ),
    ]

    if risk_level in {
        "High",
        "Critical",
    }:
        recommendations.append(
            "Escalate the change for management "
            "or CAB approval before implementation."
        )

    rollback_plan = [
        (
            "Stop the implementation if critical "
            "issues appear."
        ),
        (
            "Restore the latest verified backup "
            "if required."
        ),
        (
            "Revert configuration, database, or "
            "application changes."
        ),
        (
            "Validate directly and indirectly "
            "affected systems after rollback."
        ),
        (
            "Notify affected departments and "
            "system owners about rollback status."
        ),
    ]

    testing_checklist = [
        (
            "Verify availability of directly "
            "affected systems."
        ),
        (
            "Test dependent systems and "
            "integrations."
        ),
        (
            "Validate user login and access if "
            "authentication is involved."
        ),
        (
            "Check business-critical functions."
        ),
        (
            "Monitor logs, alerts, and performance "
            "metrics."
        ),
        (
            "Confirm that reports and integrations "
            "are working correctly."
        ),
    ]

    ai_explanation = (
        f"The change record '{change.title}' has "
        f"been assessed as {risk_level} risk with "
        f"an impact exposure of {impact_score}%. "
        "The assessment is based on service and "
        "configuration data including configuration "
        "item criticality, dependency relationships, "
        "affected business units, historical "
        "incidents, expected downtime, backout "
        "complexity, security sensitivity, and "
        f"change type. The assessment identified "
        f"{len(directly_affected_systems)} directly "
        "affected configuration item(s), "
        f"{len(indirectly_affected_systems)} "
        "downstream dependency impact(s), "
        f"{len(affected_departments)} affected "
        "business unit(s), and "
        f"{len(previous_incidents)} historical "
        "incident(s)."
    )

    return FoundationImpactAnalysisOutput(
        title=change.title,
        risk_level=risk_level,
        impact_score=impact_score,
        decision_recommendation=(
            decision_recommendation
        ),
        directly_affected_systems=(
            directly_affected_systems
        ),
        indirectly_affected_systems=(
            indirectly_affected_systems
        ),
        affected_departments=sorted(
            affected_departments
        ),
        system_owners=sorted(
            system_owners
        ),
        previous_incidents=(
            previous_incidents
        ),
        risk_factors=risk_factors,
        recommendations=recommendations,
        rollback_plan=rollback_plan,
        testing_checklist=testing_checklist,
        ai_explanation=ai_explanation,
    )
