from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.database import Base
from app.settings import settings

# Import all model modules so their tables are
# registered inside Base.metadata.
from app.models import (  # noqa: F401
    change_execution,
    change_management,
    foundation,
    invitation,
    notification,
    tenant_access_event,
)


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


database_url = settings.database_url.replace(
    "%",
    "%%",
)

config.set_main_option(
    "sqlalchemy.url",
    database_url,
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
        render_as_batch=database_url.startswith(
            "sqlite"
        ),
    )

    with context.begin_transaction():
        context.run_migrations()


def run_on_connection(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # A1 tests supply a connection to their newly created isolated PostgreSQL.
    # They must never fall back to DATABASE_URL from an application .env file.
    supplied_connection = config.attributes.get("connection")
    if supplied_connection is not None:
        run_on_connection(supplied_connection)
        return
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.", poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        run_on_connection(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
