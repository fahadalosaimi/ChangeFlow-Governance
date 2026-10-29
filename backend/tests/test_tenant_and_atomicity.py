import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, enable_sqlite_foreign_keys
from app.models import (
    change_execution,
    change_management,
    foundation,
    notification,
)
from app.models.change_management import (
    ManagedChangeRequest,
)
from app.models.foundation import (
    ITSystem,
    Organization,
    RiskRule,
    Role,
    User,
)
from app.routes import (
    change_management as change_routes,
)
from app.routes import foundation as foundation_routes
from app.schemas.change_management import (
    ManagedChangeCreate,
)
from app.schemas.foundation import (
    ITSystemCreate,
)
from app.schemas.foundation_analysis import (
    FoundationImpactAnalysisInput,
)
from app.services.foundation_risk_engine import (
    analyze_foundation_change,
)


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={
            "check_same_thread": False,
        },
    )
    event.listen(engine, "connect", enable_sqlite_foreign_keys)
    Base.metadata.create_all(engine)

    session = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def seed_two_organizations(db):
    organization_one = Organization(
        name="Organization One",
        slug="organization-one",
    )
    organization_two = Organization(
        name="Organization Two",
        slug="organization-two",
    )
    db.add_all(
        [
            organization_one,
            organization_two,
        ]
    )
    db.flush()
    requester_role = Role(name="Requester", organization_id=organization_one.id)
    db.add(requester_role)
    db.flush()

    requester = User(
        organization_id=organization_one.id,
        role_id=requester_role.id,
        full_name="Requester One",
        email="requester.one@example.com",
        password_hash=None,
        is_active="active",
        membership_source="legacy",
    )

    system_one = ITSystem(
        organization_id=organization_one.id,
        name="System One",
        criticality="High",
        environment="Production",
        status="Active",
    )
    system_two = ITSystem(
        organization_id=organization_two.id,
        name="System Two",
        criticality="Critical",
        environment="Production",
        status="Active",
    )

    db.add_all(
        [
            requester,
            system_one,
            system_two,
            RiskRule(
                name="High criticality",
                condition_type=(
                    "system_criticality"
                ),
                condition_value="High",
                score=20,
                is_active="active",
            ),
        ]
    )
    db.commit()

    return (
        organization_one,
        organization_two,
        requester,
        system_one,
        system_two,
    )


def test_risk_engine_rejects_cross_org_system(
    db,
):
    (
        organization_one,
        _organization_two,
        _requester,
        _system_one,
        system_two,
    ) = seed_two_organizations(db)

    payload = FoundationImpactAnalysisInput(
        title="Cross organization change",
        description=(
            "Attempt to assess a configuration "
            "item from another organization."
        ),
        change_type="application",
        change_mode="Normal",
        affected_system_ids=[system_two.id],
        expected_downtime_minutes=0,
        rollback_complexity="Medium",
        security_sensitivity="Medium",
    )

    with pytest.raises(
        ValueError,
        match="your organization",
    ):
        analyze_foundation_change(
            db,
            payload,
            organization_one.id,
        )


def test_foundation_list_is_org_scoped(db):
    (
        organization_one,
        _organization_two,
        requester,
        system_one,
        _system_two,
    ) = seed_two_organizations(db)

    systems = foundation_routes.get_systems(
        current_user=requester,
        db=db,
    )

    assert [item.id for item in systems] == [
        system_one.id
    ]
    assert (
        systems[0].organization_id
        == organization_one.id
    )


def test_create_system_rejects_other_org(db):
    (
        _organization_one,
        organization_two,
        requester,
        _system_one,
        _system_two,
    ) = seed_two_organizations(db)

    with pytest.raises(HTTPException) as error:
        foundation_routes.create_system(
            payload=ITSystemCreate(
                organization_id=(
                    organization_two.id
                ),
                name="Unauthorized System",
                criticality="Medium",
            ),
            current_user=requester,
            db=db,
        )

    assert error.value.status_code == 403


def test_change_creation_is_not_partially_committed(
    db,
    monkeypatch,
):
    (
        organization_one,
        _organization_two,
        requester,
        system_one,
        _system_two,
    ) = seed_two_organizations(db)

    payload = ManagedChangeCreate(
        title="Atomic change creation",
        description=(
            "Verify that a notification failure "
            "does not leave a partial change."
        ),
        change_type="application",
        change_mode="Normal",
        priority="Medium",
        affected_system_ids=[system_one.id],
        expected_downtime_minutes=0,
        rollback_complexity="Medium",
        security_sensitivity="Medium",
    )

    def fail_notification(*_args, **_kwargs):
        raise RuntimeError(
            "Notification service failed."
        )

    monkeypatch.setattr(
        change_routes,
        "notify_change_managers",
        fail_notification,
    )

    with pytest.raises(RuntimeError):
        change_routes.create_managed_change_request(
            payload=payload,
            current_user=requester,
            db=db,
        )

    db.rollback()

    assert (
        db.query(ManagedChangeRequest).count()
        == 0
    )
