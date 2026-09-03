from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models.foundation import (
    Organization,
    Role,
    Department,
    User,
    ITService,
    ITSystem,
    SystemDependency,
    Incident,
    RiskRule,
)



def get_or_create(db, model, defaults=None, **kwargs):
    instance = db.query(model).filter_by(**kwargs).first()

    if instance:
        return instance

    params = dict(kwargs)
    if defaults:
        params.update(defaults)

    instance = model(**params)
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance


def seed_database():
    db = SessionLocal()

    try:
        organization = get_or_create(
            db,
            Organization,
            name="ChangeFlow Demo Organization",
            defaults={
                "industry": "General Enterprise",
                "description": "A demo organization used to test the ChangeFlow AI platform.",
            },
        )

        roles_data = [
            ("Admin", "Full system administrator."),
            ("Requester", "Can create and submit change requests."),
            ("Change Manager", "Reviews and manages change lifecycle."),
            ("System Owner", "Owns and reviews changes for specific systems."),
            ("Approver", "Can approve or reject change requests."),
            ("Viewer", "Can view reports and dashboards."),
        ]

        roles = {}
        for name, description in roles_data:
            roles[name] = get_or_create(
                db,
                Role,
                name=name,
                defaults={"description": description},
            )

        departments_data = [
            ("IT Operations", "Responsible for daily IT operations and service continuity."),
            ("Infrastructure", "Responsible for servers, networks, and hosting platforms."),
            ("Cybersecurity", "Responsible for security controls and cyber risk."),
            ("Applications", "Responsible for enterprise applications."),
            ("Data and Analytics", "Responsible for reporting, analytics, and data platforms."),
            ("Human Resources", "Business department using HR systems."),
            ("Finance", "Business department using financial systems."),
            ("Customer Services", "Business department supporting customer-facing systems."),
        ]

        departments = {}
        for name, description in departments_data:
            departments[name] = get_or_create(
                db,
                Department,
                organization_id=organization.id,
                name=name,
                defaults={"description": description},
            )

        users_data = [
            (
                "System Admin",
                "admin@changeflow.local",
                "Platform Administrator",
                "Admin",
                "IT Operations",
            ),
            (
                "Sara Change Manager",
                "sara.cm@changeflow.local",
                "Change Manager",
                "Change Manager",
                "IT Operations",
            ),
            (
                "Omar Infrastructure Owner",
                "omar.infra@changeflow.local",
                "Infrastructure Lead",
                "System Owner",
                "Infrastructure",
            ),
            (
                "Noura Security Owner",
                "noura.security@changeflow.local",
                "Cybersecurity Lead",
                "System Owner",
                "Cybersecurity",
            ),
            (
                "Khalid Application Owner",
                "khalid.apps@changeflow.local",
                "Applications Lead",
                "System Owner",
                "Applications",
            ),
            (
                "Lama Data Owner",
                "lama.data@changeflow.local",
                "Data Analytics Lead",
                "System Owner",
                "Data and Analytics",
            ),
            (
                "Faisal HR Requester",
                "faisal.hr@changeflow.local",
                "HR Specialist",
                "Requester",
                "Human Resources",
            ),
            (
                "Maha Finance Requester",
                "maha.finance@changeflow.local",
                "Finance Specialist",
                "Requester",
                "Finance",
            ),
        ]

        users = {}
        for full_name, email, job_title, role_name, department_name in users_data:
            users[full_name] = get_or_create(
                db,
                User,
                email=email,
                defaults={
                    "organization_id": organization.id,
                    "department_id": departments[department_name].id,
                    "role_id": roles[role_name].id,
                    "full_name": full_name,
                    "job_title": job_title,
                    "is_active": "active",
                },
            )

        services_data = [
            (
                "Employee Self-Service",
                "Allows employees to access HR services.",
                "High",
                "Human Resources",
            ),
            (
                "Finance Operations",
                "Supports financial and payment processes.",
                "Critical",
                "Finance",
            ),
            (
                "Identity and Access Management",
                "Provides authentication and access control.",
                "Critical",
                "Cybersecurity",
            ),
            (
                "Business Intelligence",
                "Provides reporting and analytics.",
                "High",
                "Data and Analytics",
            ),
            (
                "Core Network Services",
                "Provides secure network connectivity.",
                "Critical",
                "Infrastructure",
            ),
            (
                "Customer Digital Services",
                "Supports customer-facing digital channels.",
                "High",
                "Customer Services",
            ),
            (
                "Enterprise Applications",
                "Supports internal business applications.",
                "High",
                "Applications",
            ),
        ]

        services = {}
        for name, description, criticality, department_name in services_data:
            services[name] = get_or_create(
                db,
                ITService,
                organization_id=organization.id,
                name=name,
                defaults={
                    "department_id": departments[department_name].id,
                    "description": description,
                    "business_criticality": criticality,
                },
            )

        systems_data = [
            (
                "HR Portal",
                "Employee self-service portal.",
                "Web Application",
                "Production",
                "Medium",
                "Human Resources",
                "Employee Self-Service",
                "Khalid Application Owner",
            ),
            (
                "Oracle Database",
                "Central enterprise database platform.",
                "Database",
                "Production",
                "Critical",
                "Infrastructure",
                "Enterprise Applications",
                "Omar Infrastructure Owner",
            ),
            (
                "Payroll System",
                "Processes employee payroll.",
                "Enterprise Application",
                "Production",
                "High",
                "Finance",
                "Finance Operations",
                "Khalid Application Owner",
            ),
            (
                "Finance ERP",
                "Core finance and accounting platform.",
                "ERP",
                "Production",
                "Critical",
                "Finance",
                "Finance Operations",
                "Khalid Application Owner",
            ),
            (
                "BI Reports",
                "Reporting and dashboard system.",
                "Analytics",
                "Production",
                "Medium",
                "Data and Analytics",
                "Business Intelligence",
                "Lama Data Owner",
            ),
            (
                "Network Firewall",
                "Main network security gateway.",
                "Network Security",
                "Production",
                "Critical",
                "Cybersecurity",
                "Core Network Services",
                "Noura Security Owner",
            ),
            (
                "Authentication Service",
                "Central authentication service.",
                "Identity Service",
                "Production",
                "Critical",
                "Cybersecurity",
                "Identity and Access Management",
                "Noura Security Owner",
            ),
            (
                "Active Directory",
                "Directory and identity management platform.",
                "Directory Service",
                "Production",
                "Critical",
                "Cybersecurity",
                "Identity and Access Management",
                "Noura Security Owner",
            ),
            (
                "Email Service",
                "Corporate email platform.",
                "Collaboration",
                "Production",
                "High",
                "IT Operations",
                "Enterprise Applications",
                "Omar Infrastructure Owner",
            ),
            (
                "API Gateway",
                "Integration gateway between systems.",
                "Integration",
                "Production",
                "High",
                "Applications",
                "Enterprise Applications",
                "Khalid Application Owner",
            ),
            (
                "Customer Portal",
                "Customer-facing web portal.",
                "Web Application",
                "Production",
                "High",
                "Customer Services",
                "Customer Digital Services",
                "Khalid Application Owner",
            ),
            (
                "Backup System",
                "Enterprise backup and recovery system.",
                "Backup",
                "Production",
                "High",
                "Infrastructure",
                "Core Network Services",
                "Omar Infrastructure Owner",
            ),
            (
                "Monitoring System",
                "System monitoring and alerting platform.",
                "Monitoring",
                "Production",
                "Medium",
                "IT Operations",
                "Core Network Services",
                "Omar Infrastructure Owner",
            ),
            (
                "Service Desk",
                "IT support and ticketing system.",
                "ITSM",
                "Production",
                "Medium",
                "IT Operations",
                "Enterprise Applications",
                "Sara Change Manager",
            ),
        ]

        systems = {}
        for (
            name,
            description,
            system_type,
            environment,
            criticality,
            department_name,
            service_name,
            owner_name,
        ) in systems_data:
            systems[name] = get_or_create(
                db,
                ITSystem,
                organization_id=organization.id,
                name=name,
                defaults={
                    "department_id": departments[department_name].id,
                    "service_id": services[service_name].id,
                    "owner_id": users[owner_name].id,
                    "description": description,
                    "system_type": system_type,
                    "environment": environment,
                    "criticality": criticality,
                    "status": "Active",
                },
            )

        dependencies_data = [
            ("HR Portal", "Oracle Database", "Database Dependency", "High"),
            ("HR Portal", "Authentication Service", "Authentication Dependency", "High"),
            ("Payroll System", "Oracle Database", "Database Dependency", "High"),
            ("Payroll System", "Authentication Service", "Authentication Dependency", "Medium"),
            ("Finance ERP", "Oracle Database", "Database Dependency", "Critical"),
            ("Finance ERP", "API Gateway", "Integration Dependency", "High"),
            ("BI Reports", "Oracle Database", "Reporting Data Source", "Medium"),
            ("Customer Portal", "API Gateway", "Integration Dependency", "High"),
            ("Customer Portal", "Authentication Service", "Authentication Dependency", "High"),
            ("API Gateway", "Network Firewall", "Network Dependency", "Critical"),
            ("Email Service", "Active Directory", "Directory Dependency", "High"),
            ("Service Desk", "Email Service", "Notification Dependency", "Medium"),
            ("Monitoring System", "Network Firewall", "Monitoring Dependency", "Medium"),
            ("Backup System", "Oracle Database", "Backup Dependency", "High"),
        ]

        for source_name, target_name, dependency_type, impact_level in dependencies_data:
            existing_dependency = (
                db.query(SystemDependency)
                .filter(
                    SystemDependency.source_system_id == systems[source_name].id,
                    SystemDependency.target_system_id == systems[target_name].id,
                )
                .first()
            )

            if not existing_dependency:
                db.add(
                    SystemDependency(
                        source_system_id=systems[source_name].id,
                        target_system_id=systems[target_name].id,
                        dependency_type=dependency_type,
                        impact_level=impact_level,
                        description=f"{source_name} depends on {target_name}.",
                    )
                )

        db.commit()

        incidents_data = [
            (
                "Oracle Database",
                "Database performance degradation",
                "High",
                "Slow response time affected multiple business systems.",
                30,
            ),
            (
                "Network Firewall",
                "Firewall policy misconfiguration",
                "Critical",
                "Incorrect rule caused temporary access disruption.",
                45,
            ),
            (
                "Authentication Service",
                "Authentication outage",
                "Critical",
                "Users were unable to login to multiple applications.",
                60,
            ),
            (
                "HR Portal",
                "HR Portal login issue",
                "Medium",
                "Some employees experienced login failures.",
                20,
            ),
            (
                "API Gateway",
                "Integration timeout issue",
                "High",
                "Several integrated services experienced timeout errors.",
                15,
            ),
            (
                "Email Service",
                "Email delivery delay",
                "Medium",
                "Internal email delivery was delayed.",
                10,
            ),
        ]

        for system_name, title, severity, description, days_ago in incidents_data:
            existing_incident = (
                db.query(Incident)
                .filter(
                    Incident.system_id == systems[system_name].id,
                    Incident.title == title,
                )
                .first()
            )

            if not existing_incident:
                occurred_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days_ago)
                resolved_at = occurred_at + timedelta(hours=3)

                db.add(
                    Incident(
                        system_id=systems[system_name].id,
                        title=title,
                        severity=severity,
                        description=description,
                        status="Resolved",
                        occurred_at=occurred_at,
                        resolved_at=resolved_at,
                    )
                )

        db.commit()

        risk_rules_data = [
            (
                "Critical system rule",
                "system_criticality",
                "Critical",
                30,
                "Add 30 points when the affected system is critical.",
            ),
            (
                "High system rule",
                "system_criticality",
                "High",
                20,
                "Add 20 points when the affected system has high criticality.",
            ),
            (
                "Medium system rule",
                "system_criticality",
                "Medium",
                10,
                "Add 10 points when the affected system has medium criticality.",
            ),
            (
                "Database change rule",
                "change_type",
                "database",
                25,
                "Database changes usually require stronger review.",
            ),
            (
                "Security change rule",
                "change_type",
                "security",
                25,
                "Security changes may affect access and protection controls.",
            ),
            (
                "Network change rule",
                "change_type",
                "network",
                20,
                "Network changes may affect connectivity.",
            ),
            (
                "Application change rule",
                "change_type",
                "application",
                15,
                "Application changes may affect business functions.",
            ),
            (
                "Documentation change rule",
                "change_type",
                "documentation",
                5,
                "Documentation changes usually have lower technical risk.",
            ),
            (
                "Critical dependency rule",
                "dependency_impact",
                "Critical",
                20,
                "Critical dependencies increase the impact score.",
            ),
            (
                "High dependency rule",
                "dependency_impact",
                "High",
                15,
                "High impact dependencies increase the impact score.",
            ),
            (
                "Previous critical incident rule",
                "previous_incident",
                "Critical",
                20,
                "Previous critical incidents increase the risk.",
            ),
            (
                "Previous high incident rule",
                "previous_incident",
                "High",
                15,
                "Previous high severity incidents increase the risk.",
            ),
            (
                "Emergency change rule",
                "change_mode",
                "Emergency",
                25,
                "Emergency changes require urgent and careful handling.",
            ),
        ]

        for name, condition_type, condition_value, score, description in risk_rules_data:
            get_or_create(
                db,
                RiskRule,
                name=name,
                defaults={
                    "condition_type": condition_type,
                    "condition_value": condition_value,
                    "score": score,
                    "description": description,
                    "is_active": "active",
                },
            )

        print("Seed data inserted successfully.")
        print("Organization:", db.query(Organization).count())
        print("Departments:", db.query(Department).count())
        print("Users:", db.query(User).count())
        print("Services:", db.query(ITService).count())
        print("Systems:", db.query(ITSystem).count())
        print("Dependencies:", db.query(SystemDependency).count())
        print("Incidents:", db.query(Incident).count())
        print("Risk Rules:", db.query(RiskRule).count())

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()