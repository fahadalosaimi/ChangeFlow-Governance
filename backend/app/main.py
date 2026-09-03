from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)

from app.database import Base, engine

from app.models import (
    change_execution,
    change_management,
    foundation,
    notification,
)

from app.routes import (
    auth,
    change_execution,
    change_management,
    foundation,
    notifications,
)

from app.settings import settings


@asynccontextmanager
async def lifespan(
    app: FastAPI,
):
    if settings.create_tables_on_startup:
        Base.metadata.create_all(
            bind=engine
        )

    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Enterprise platform for IT change "
        "governance, impact assessment, "
        "authorization, and auditability."
    ),
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(foundation.router)
app.include_router(change_management.router)
app.include_router(change_execution.router)
app.include_router(notifications.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {
        "message": (
            f"{settings.app_name} API "
            "is running"
        ),
        "version": settings.app_version,
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }
