import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def read_bool(
    name: str,
    default: bool,
) -> bool:
    raw_value = os.getenv(
        name,
        str(default),
    ).strip().lower()

    if raw_value in {
        "true",
        "1",
        "yes",
        "on",
    }:
        return True

    if raw_value in {
        "false",
        "0",
        "no",
        "off",
    }:
        return False

    raise RuntimeError(
        f"{name} must be true or false."
    )


def read_positive_int(
    name: str,
    default: int,
) -> int:
    try:
        value = int(
            os.getenv(
                name,
                str(default),
            )
        )
    except ValueError as error:
        raise RuntimeError(
            f"{name} must be an integer."
        ) from error

    if value <= 0:
        raise RuntimeError(
            f"{name} must be greater than zero."
        )

    return value


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    environment: str

    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int

    cors_origins: tuple[str, ...]

    create_tables_on_startup: bool
    sql_echo: bool


def build_settings() -> Settings:
    environment = os.getenv(
        "ENVIRONMENT",
        "development",
    ).strip().lower()

    if environment not in {
        "development",
        "test",
        "production",
    }:
        raise RuntimeError(
            "ENVIRONMENT must be development, "
            "test, or production."
        )

    jwt_secret_key = os.getenv(
        "JWT_SECRET_KEY",
        "",
    ).strip()

    if not jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY is missing from "
            "the backend .env file."
        )

    database_url = os.getenv(
        "DATABASE_URL",
        "sqlite:///./change_impact.db",
    ).strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL cannot be empty."
        )

    create_tables_on_startup = read_bool(
        "CREATE_TABLES_ON_STARTUP",
        True,
    )

    cors_origins = tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            (
                "http://localhost:5173,"
                "http://127.0.0.1:5173"
            ),
        ).split(",")
        if origin.strip()
    )

    if not cors_origins:
        raise RuntimeError(
            "At least one CORS origin is required."
        )

    if environment == "production":
        if database_url.startswith("sqlite"):
            raise RuntimeError(
                "Production must use PostgreSQL, "
                "not SQLite."
            )

        if create_tables_on_startup:
            raise RuntimeError(
                "CREATE_TABLES_ON_STARTUP must be "
                "false in production."
            )

        if len(jwt_secret_key) < 32:
            raise RuntimeError(
                "JWT_SECRET_KEY must contain at "
                "least 32 characters in production."
            )

    return Settings(
        app_name=os.getenv(
            "APP_NAME",
            "ChangeFlow Governance",
        ).strip(),
        app_version=os.getenv(
            "APP_VERSION",
            "0.3.0",
        ).strip(),
        environment=environment,
        database_url=database_url,
        jwt_secret_key=jwt_secret_key,
        jwt_algorithm=os.getenv(
            "JWT_ALGORITHM",
            "HS256",
        ).strip(),
        access_token_expire_minutes=(
            read_positive_int(
                "ACCESS_TOKEN_EXPIRE_MINUTES",
                120,
            )
        ),
        cors_origins=cors_origins,
        create_tables_on_startup=(
            create_tables_on_startup
        ),
        sql_echo=read_bool(
            "SQL_ECHO",
            False,
        ),
    )


settings = build_settings()
