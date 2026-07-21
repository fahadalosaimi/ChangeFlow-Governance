from app.schemas.change import ChangeRequestInput, ChangeAnalysisOutput


def analyze_change_request(change: ChangeRequestInput) -> ChangeAnalysisOutput:
    change_type = change.change_type.lower()

    change_type_scores = {
        "documentation": 5,
        "configuration": 15,
        "application": 20,
        "network": 25,
        "database": 30,
        "security": 35,
        "cloud": 25,
        "infrastructure": 35,
        "system_upgrade": 40,
    }

    downtime_scores = {
        "none": 0,
        "less_than_30_minutes": 10,
        "30_minutes_to_2_hours": 20,
        "more_than_2_hours": 30,
    }

    implementation_scores = {
        "outside_working_hours": 5,
        "during_working_hours": 20,
        "peak_hours": 30,
    }

    rollback_scores = {
        "easy": 5,
        "moderate": 15,
        "difficult": 25,
        "no_clear_plan": 35,
    }

    security_scores = {
        "low": 5,
        "medium": 15,
        "high": 25,
        "critical": 35,
    }

    affected_systems = change.related_systems
    risk_factors = []

    change_type_score = change_type_scores.get(change_type, 15)
    implementation_score = implementation_scores.get(change.implementation_time, 5)
    rollback_score = rollback_scores.get(change.rollback_complexity, 15)
    security_score = security_scores.get(change.security_sensitivity, 15)

    downtime_key = "none"
    if change.expected_downtime:
        downtime_key = change.expected_downtime.lower().replace(" ", "_")

    downtime_score = downtime_scores.get(downtime_key, 10)

    if len(affected_systems) == 1:
        affected_systems_score = 5
    elif 2 <= len(affected_systems) <= 3:
        affected_systems_score = 15
    elif 4 <= len(affected_systems) <= 6:
        affected_systems_score = 25
    else:
        affected_systems_score = 35

    # Documentation changes should be treated as low technical impact.
    if change_type == "documentation":
        system_criticality_score = 5
    else:
        critical_keywords = [
            "oracle",
            "database",
            "payroll",
            "hr",
            "security",
            "firewall",
            "network",
        ]

        high_keywords = [
            "bi",
            "report",
            "portal",
            "cloud",
            "application",
        ]

        system_criticality_score = 15

        for system in affected_systems:
            system_lower = system.lower()

            if any(keyword in system_lower for keyword in critical_keywords):
                system_criticality_score = max(system_criticality_score, 35)
            elif any(keyword in system_lower for keyword in high_keywords):
                system_criticality_score = max(system_criticality_score, 25)

    impact_score = round(
        (change_type_score / 40) * 20
        + (system_criticality_score / 35) * 25
        + (affected_systems_score / 35) * 15
        + (downtime_score / 30) * 15
        + (implementation_score / 30) * 10
        + (rollback_score / 35) * 10
        + (security_score / 35) * 5
    )

    # Strong adjustment for simple documentation-only changes.
    if (
        change_type == "documentation"
        and downtime_key == "none"
        and change.implementation_time == "outside_working_hours"
        and change.rollback_complexity == "easy"
        and change.security_sensitivity == "low"
    ):
        impact_score = 22

    impact_score = min(impact_score, 100)

    if impact_score <= 30:
        risk_level = "Low"
    elif impact_score <= 60:
        risk_level = "Medium"
    elif impact_score <= 85:
        risk_level = "High"
    else:
        risk_level = "Critical"

    if change_type_score >= 30:
        risk_factors.append(f"The change type '{change.change_type}' has a high technical impact.")

    if system_criticality_score >= 35:
        risk_factors.append("One or more affected systems are considered critical.")

    if len(affected_systems) >= 3:
        risk_factors.append("The change affects multiple systems.")

    if downtime_score >= 20:
        risk_factors.append("The change includes expected downtime.")

    if rollback_score >= 25:
        risk_factors.append("Rollback complexity is high or unclear.")

    if security_score >= 25:
        risk_factors.append("The change has high security sensitivity.")

    if implementation_score >= 20:
        risk_factors.append("The change is planned during working or peak hours.")

    if change_type == "documentation":
        risk_factors.append("The change is limited to documentation and does not modify production systems.")

    affected_departments = []

    for system in affected_systems:
        system_lower = system.lower()

        if "hr" in system_lower:
            affected_departments.append("HR Department")
        if "payroll" in system_lower:
            affected_departments.append("Finance Department")
        if "bi" in system_lower or "report" in system_lower:
            affected_departments.append("BI Team")
        if "oracle" in system_lower or "database" in system_lower:
            affected_departments.append("Database Team")
        if "network" in system_lower:
            affected_departments.append("Network Team")
        if "security" in system_lower or "firewall" in system_lower:
            affected_departments.append("Cybersecurity Team")

    if not affected_departments:
        affected_departments.append("Related Business Team")

    affected_departments = list(set(affected_departments))

    if change_type == "documentation":
        recommendations = [
            "Review the updated documentation before publishing.",
            "Confirm that the content matches the current system process.",
            "Notify users or affected teams about the updated guide.",
            "Keep the previous documentation version for reference.",
        ]

        rollback_plan = [
            "Restore the previous documentation version.",
            "Notify users if incorrect information was published.",
            "Review and correct the updated content.",
        ]

        testing_checklist = [
            "Verify document accuracy.",
            "Check formatting and readability.",
            "Confirm links and references are working.",
            "Validate the document with the related team.",
        ]
    else:
        recommendations = [
            "Perform a full backup before implementation.",
            "Notify all affected teams before the change.",
            "Test the change in a staging environment.",
            "Schedule the change outside working hours.",
            "Prepare a rollback plan before approval.",
            "Monitor system performance after implementation.",
        ]

        rollback_plan = [
            "Stop the implementation process if critical issues appear.",
            "Restore the latest backup.",
            "Revert configuration or database changes.",
            "Validate affected systems after rollback.",
            "Notify affected teams about the rollback status.",
        ]

        testing_checklist = [
            "Verify system availability.",
            "Test user login.",
            "Validate main business functions.",
            "Check related system integrations.",
            "Monitor performance and error logs.",
            "Confirm that affected reports are working correctly.",
        ]

    management_summary = (
        f"The proposed change '{change.title}' is assessed as {risk_level} risk "
        f"with an impact score of {impact_score}%. It may affect {len(affected_systems)} system(s) "
        f"and requires proper coordination before implementation."
    )

    technical_summary = (
        f"The change involves {change.change_type} activities affecting: "
        f"{', '.join(affected_systems)}. Recommended technical controls include review, validation, "
        f"stakeholder notification, and proper documentation of the change."
    )

    ai_explanation = (
        f"This change is classified as {risk_level} Risk because it involves "
        f"a {change.change_type} change affecting {len(affected_systems)} system(s): "
        f"{', '.join(affected_systems)}. The score is influenced by change type, system criticality, "
        f"expected downtime, rollback complexity, security sensitivity, and number of affected systems."
    )

    return ChangeAnalysisOutput(
        risk_level=risk_level,
        impact_score=impact_score,
        risk_factors=risk_factors,
        affected_systems=affected_systems,
        affected_departments=affected_departments,
        recommendations=recommendations,
        rollback_plan=rollback_plan,
        testing_checklist=testing_checklist,
        management_summary=management_summary,
        technical_summary=technical_summary,
        ai_explanation=ai_explanation,
    )