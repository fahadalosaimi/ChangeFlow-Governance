from sqlalchemy import inspect, text

from app.database import SessionLocal, engine
from app.models.foundation import (
    Department,
    Organization,
    Role,
    User,
)
from app.services.auth_service import hash_password


def ensure_password_column():
    inspector = inspect(engine)

    columns = {
        column["name"]
        for column in inspector.get_columns("users")
    }

    if "password_hash" in columns:
        print("password_hash column already exists.")
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE users "
                "ADD COLUMN password_hash VARCHAR(255)"
            )
        )

    print("password_hash column added successfully.")


def get_or_create_role(
    db,
    name: str,
    description: str,
) -> Role:
    role = (
        db.query(Role)
        .filter(Role.name == name)
        .first()
    )

    if role:
        role.description = description
        return role

    role = Role(
        name=name,
        description=description,
    )

    db.add(role)
    db.flush()

    return role


def upsert_user(
    db,
    organization_id: int,
    department_id: int | None,
    role: Role,
    full_name: str,
    email: str,
    job_title: str,
    password: str,
):
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        user = User(
            organization_id=organization_id,
            department_id=department_id,
            role_id=role.id,
            full_name=full_name,
            email=email,
            job_title=job_title,
            is_active="active",
        )

        db.add(user)

    user.organization_id = organization_id
    user.department_id = department_id
    user.role_id = role.id
    user.full_name = full_name
    user.job_title = job_title
    user.is_active = "active"
    user.password_hash = hash_password(password)

    return user


def main():
    ensure_password_column()

    db = SessionLocal()

    try:
        organization = (
            db.query(Organization)
            .order_by(Organization.id.asc())
            .first()
        )

        if not organization:
            raise RuntimeError(
                "No organization exists. Run the foundation "
                "seed script first."
            )

        department = (
            db.query(Department)
            .filter(Department.name == "IT Operations")
            .first()
        )

        if not department:
            department = (
                db.query(Department)
                .order_by(Department.id.asc())
                .first()
            )

        requester_role = get_or_create_role(
            db,
            "Requester",
            "Creates and follows change requests.",
        )

        manager_role = get_or_create_role(
            db,
            "Change Manager",
            "Reviews and authorizes change requests.",
        )

        admin_role = get_or_create_role(
            db,
            "CMDB Manager",
            (
                "Maintains configuration items, dependencies, "
                "incidents, and risk rules."
            ),
        )

        db.flush()

        department_id = (
            department.id
            if department
            else None
        )

        upsert_user(
            db=db,
            organization_id=organization.id,
            department_id=department_id,
            role=requester_role,
            full_name="Demo Requester",
            email="requester@changeflow.local",
            job_title="Change Requester",
            password="Requester@123",
        )

        upsert_user(
            db=db,
            organization_id=organization.id,
            department_id=department_id,
            role=manager_role,
            full_name="Demo Change Manager",
            email="manager@changeflow.local",
            job_title="Change Manager",
            password="Manager@123",
        )

        upsert_user(
            db=db,
            organization_id=organization.id,
            department_id=department_id,
            role=admin_role,
            full_name="Demo CMDB Manager",
            email="admin@changeflow.local",
            job_title="CMDB Manager",
            password="Admin@123",
        )

        db.commit()

        print("\nAuthentication users created successfully:\n")
        print("Requester: requester@changeflow.local / Requester@123")
        print("Manager:   manager@changeflow.local / Manager@123")
        print("Admin:     admin@changeflow.local / Admin@123")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()