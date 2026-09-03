from sqlalchemy import (
    create_engine,
    event,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import (
    declarative_base,
    sessionmaker,
)

from app.settings import settings


engine_options: dict = {
    "pool_pre_ping": True,
    "echo": settings.sql_echo,
}

if settings.database_url.startswith("sqlite"):
    engine_options["connect_args"] = {
        "check_same_thread": False,
    }

engine = create_engine(
    settings.database_url,
    **engine_options,
)


if settings.database_url.startswith("sqlite"):
    @event.listens_for(
        Engine,
        "connect",
    )
    def enable_sqlite_foreign_keys(
        dbapi_connection,
        _connection_record,
    ) -> None:
        cursor = dbapi_connection.cursor()

        try:
            cursor.execute(
                "PRAGMA foreign_keys=ON"
            )
        finally:
            cursor.close()


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
