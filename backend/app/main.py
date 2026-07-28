from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine

from app.models import (
    change_management,
    foundation,
    notification,
)

from app.routes import (
    auth,
    change_management,
    foundation,
    notifications,
)


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ChangeFlow Governance",
    description=(
        "Enterprise platform for IT change governance, "
        "impact assessment, authorization, and auditability."
    ),
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(foundation.router)
app.include_router(change_management.router)
app.include_router(notifications.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {
        "message": "ChangeFlow Governance API is running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ChangeFlow Governance",
    }