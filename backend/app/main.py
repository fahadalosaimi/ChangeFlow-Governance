from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routes.analysis import router as analysis_router
from app.routes.reports import router as reports_router
from app.routes.change_requests import router as change_requests_router
from app.models import foundation, change_management
from app.routes import (
    auth,
    foundation,
    foundation_analysis,
    change_management,
)


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Change Impact Analyzer",
    description="AI-powered platform for analyzing IT change impact before implementation.",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis_router)
app.include_router(reports_router)
app.include_router(change_requests_router)
app.include_router(foundation.router)
app.include_router(foundation_analysis.router)
app.include_router(change_management.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {
        "message": "AI Change Impact Analyzer API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "AI Change Impact Analyzer"
    }