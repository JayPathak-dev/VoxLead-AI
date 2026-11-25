"""Application configuration loaded from backend/.env via Pydantic Settings."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
KNOWLEDGE_BASE_DIR = DATA_DIR / "knowledge_base"
FAISS_INDEX_DIR = DATA_DIR / "faiss_index"
UPLOADS_DIR = DATA_DIR / "uploads"


class Settings(BaseSettings):
    """Runtime settings read from environment variables and backend/.env."""

    app_name: str = "VoxLead AI"
    app_env: str = "development"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    ollama_timeout_seconds: float = 90.0

    database_url: str = "sqlite:///./data/voxlead.db"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    default_language: str = "en"
    timezone: str = "Asia/Kolkata"
    frontend_url: str = "http://localhost:5173"

    # RAG defaults
    rag_chunk_size: int = 600
    rag_chunk_overlap: int = 90
    rag_top_k: int = 4

    # Upload limits (10 MB)
    max_upload_bytes: int = 10 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def resolved_database_url(self) -> str:
        """Resolve relative SQLite URLs consistently against backend/."""
        if self.database_url.startswith("sqlite:///./"):
            rel_path = self.database_url.replace("sqlite:///./", "", 1)
            abs_path = (BACKEND_DIR / rel_path).resolve()
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{abs_path}"
        return self.database_url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings instance."""
    for directory in (DATA_DIR, KNOWLEDGE_BASE_DIR, FAISS_INDEX_DIR, UPLOADS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    return Settings()
