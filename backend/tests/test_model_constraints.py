from app.models.change_execution import (
    ChangeImplementation,
)
from app.models.change_management import (
    ManagedChangeAffectedSystem,
    ManagedChangeRequest,
    ManagedImpactAssessment,
)
from app.models.foundation import (
    Department,
    RiskRule,
    SystemDependency,
    User,
)


def constraint_names(table) -> set[str]:
    return {
        constraint.name
        for constraint in table.constraints
        if constraint.name
    }


def index_names(table) -> set[str]:
    return {
        index.name
        for index in table.indexes
        if index.name
    }


def test_change_request_has_planned_window_constraint():
    names = constraint_names(
        ManagedChangeRequest.__table__
    )

    assert (
        "ck_managed_changes_planned_window"
        in names
    )


def test_affected_system_pair_is_unique():
    names = constraint_names(
        ManagedChangeAffectedSystem.__table__
    )

    assert "uq_change_affected_system" in names


def test_impact_score_has_database_constraint():
    names = constraint_names(
        ManagedImpactAssessment.__table__
    )

    assert (
        "ck_managed_assessments_impact_score"
        in names
    )


def test_department_name_is_unique_per_org():
    names = constraint_names(
        Department.__table__
    )

    assert (
        "uq_departments_organization_name"
        in names
    )


def test_dependency_has_safety_constraints():
    names = constraint_names(
        SystemDependency.__table__
    )

    assert (
        "uq_system_dependencies_source_target"
        in names
    )
    assert (
        "ck_system_dependencies_not_self"
        in names
    )


def test_non_login_directory_users_are_supported():
    assert (
        User.__table__.c.password_hash.nullable
        is True
    )


def test_risk_score_has_database_constraint():
    names = constraint_names(
        RiskRule.__table__
    )

    assert "ck_risk_rules_score_range" in names


def test_pir_result_matches_workflow_values():
    names = constraint_names(
        ChangeImplementation.__table__
    )

    assert (
        "ck_change_implementations_pir_result"
        in names
    )


def test_change_list_query_has_composite_index():
    names = index_names(
        ManagedChangeRequest.__table__
    )

    assert (
        "ix_managed_changes_organization_status_created"
        in names
    )
