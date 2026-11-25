"""VoxLead AI FastAPI application entrypoint, health check, settings, and demo seeding."""

from contextlib import asynccontextmanager
import json
from typing import Any
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import analytics, appointments, chat, conversations, knowledge, leads
from app.config import get_settings
from app.database import SessionLocal, get_db, init_db
from app.models import AppSetting
from app.schemas import HealthResponse, WorkspaceSettings
from app.services.embedding_service import embedding_service
from app.services.ollama_service import ollama_service
from app.services.rag_service import rag_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize SQLite schema, bootstrap FAISS RAG index, and warm up local models."""
    init_db()
    db = SessionLocal()
    try:
        rag_service.bootstrap(db)
    finally:
        db.close()

    # Non-blocking warm-up check if Ollama + model are already running
    await ollama_service.warm_up()
    yield
    await ollama_service.close()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Autonomous AI Sales Voice Agent with Local Docker Ollama, RAG (FAISS), and SQLite CRM.",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins = list(
    {
        settings.frontend_url.rstrip("/"),
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(leads.router)
app.include_router(appointments.router)
app.include_router(knowledge.router)
app.include_router(analytics.router)


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """Report backend, Docker Ollama, Qwen model, embedding model, and SQLite health."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    ollama_info = await ollama_service.check_health()

    return HealthResponse(
        backend_status="ok",
        ollama_status=ollama_info["ollama_status"],
        ollama_base_url=settings.ollama_base_url,
        model_name=ollama_info["model_name"],
        model_available=ollama_info["model_available"],
        embedding_model=settings.embedding_model,
        embedding_model_status=embedding_service.status,
        database_status=db_status,
        knowledge_chunks=rag_service.chunk_count,
        error_detail=ollama_info.get("error_detail"),
        install_instructions=ollama_info.get("install_instructions"),
    )


@app.get("/api/settings", response_model=WorkspaceSettings, tags=["Settings"])
def get_workspace_settings(db: Session = Depends(get_db)) -> WorkspaceSettings:
    row = db.query(AppSetting).filter(AppSetting.key == "workspace_settings").first()
    if not row:
        return WorkspaceSettings(default_language="hi" if settings.default_language == "hi" else "en")
    try:
        data = json.loads(row.value_json)
        return WorkspaceSettings(**data)
    except Exception:
        return WorkspaceSettings()


@app.put("/api/settings", response_model=WorkspaceSettings, tags=["Settings"])
def update_workspace_settings(
    payload: WorkspaceSettings,
    db: Session = Depends(get_db),
) -> WorkspaceSettings:
    row = db.query(AppSetting).filter(AppSetting.key == "workspace_settings").first()
    serialized = payload.model_dump_json()
    if row:
        row.value_json = serialized
    else:
        row = AppSetting(key="workspace_settings", value_json=serialized)
        db.add(row)
    db.commit()
    return payload


@app.post("/api/demo/seed", tags=["Demo"])
def seed_demo_data_endpoint(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Explicitly populate realistic sample CRM leads, conversations, and appointments."""
    from app.services.demo_seed_service import seed_demo_data

    return seed_demo_data(db)
