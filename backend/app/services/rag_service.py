"""Local RAG pipeline using text extraction, chunking, SentenceTransformers, and FAISS CPU."""

import json
import threading
from pathlib import Path
from typing import Any
import faiss
import numpy as np
from pypdf import PdfReader
from docx import Document as DocxDocument
from sqlalchemy.orm import Session

from app.config import (
    FAISS_INDEX_DIR,
    KNOWLEDGE_BASE_DIR,
    UPLOADS_DIR,
    get_settings,
)
from app.models import KnowledgeDocument
from app.services.embedding_service import embedding_service
from app.utils.validators import clean_text, ensure_safe_path


class RAGService:
    """Manages document extraction, chunking, FAISS indexing, persistence, and retrieval."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._index: faiss.IndexFlatIP | None = None
        self._chunks: list[dict[str, Any]] = []
        self._index_path = FAISS_INDEX_DIR / "index.faiss"
        self._meta_path = FAISS_INDEX_DIR / "chunks.json"

    @property
    def chunk_count(self) -> int:
        return len(self._chunks)

    @staticmethod
    def extract_text_from_file(file_path: Path) -> str:
        """Extract clean plain text from .txt, .pdf, or .docx files."""
        ext = file_path.suffix.lower()
        if ext == ".txt":
            raw = file_path.read_text(encoding="utf-8", errors="ignore")
            return clean_text(raw)
        if ext == ".pdf":
            reader = PdfReader(str(file_path))
            pages = [page.extract_text() or "" for page in reader.pages]
            return clean_text("\n\n".join(pages))
        if ext == ".docx":
            doc = DocxDocument(str(file_path))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return clean_text("\n\n".join(paragraphs))
        raise ValueError(f"Unsupported file format: {ext}")

    @staticmethod
    def chunk_text(text: str, filename: str, chunk_size: int = 600, overlap: int = 90) -> list[dict[str, Any]]:
        """Split text into overlapping 500-700 character chunks respecting boundaries."""
        cleaned = clean_text(text)
        if not cleaned:
            return []

        chunks: list[dict[str, Any]] = []
        start = 0
        text_len = len(cleaned)
        chunk_idx = 0

        while start < text_len:
            end = min(start + chunk_size, text_len)
            if end < text_len:
                # Prefer breaking at newline or sentence end within last 180 chars
                window_start = max(start + int(chunk_size * 0.55), start)
                split_pos = max(
                    cleaned.rfind("\n\n", window_start, end),
                    cleaned.rfind("\n", window_start, end),
                    cleaned.rfind(". ", window_start, end),
                )
                if split_pos > window_start:
                    end = split_pos + (2 if cleaned[split_pos : split_pos + 2] == ". " else 1)

            piece = cleaned[start:end].strip()
            if piece:
                chunks.append(
                    {
                        "chunk_id": f"{filename}::chunk_{chunk_idx}",
                        "filename": filename,
                        "text": piece,
                    }
                )
                chunk_idx += 1

            if end >= text_len:
                break
            start = max(end - overlap, start + 1)

        return chunks

    def load_persisted_index(self) -> bool:
        """Load persisted FAISS index and metadata from disk if available."""
        with self._lock:
            if self._index_path.exists() and self._meta_path.exists():
                try:
                    self._index = faiss.read_index(str(self._index_path))
                    self._chunks = json.loads(self._meta_path.read_text(encoding="utf-8"))
                    return True
                except Exception:
                    self._index = None
                    self._chunks = []
            return False

    def _save_persisted_index(self) -> None:
        FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)
        if self._index is not None:
            faiss.write_index(self._index, str(self._index_path))
        elif self._index_path.exists():
            self._index_path.unlink()
        self._meta_path.write_text(json.dumps(self._chunks, ensure_ascii=False, indent=2), encoding="utf-8")

    def sync_sample_documents(self, db: Session) -> None:
        """Register sample knowledge_base/*.txt files into SQLite if missing."""
        KNOWLEDGE_BASE_DIR.mkdir(parents=True, exist_ok=True)
        for path in sorted(KNOWLEDGE_BASE_DIR.glob("*.txt")):
            existing = (
                db.query(KnowledgeDocument)
                .filter(KnowledgeDocument.filename == path.name)
                .first()
            )
            if not existing:
                text = self.extract_text_from_file(path)
                doc = KnowledgeDocument(
                    filename=path.name,
                    original_filename=path.name,
                    file_type="txt",
                    file_path=str(path),
                    file_size_bytes=path.stat().st_size,
                    character_count=len(text),
                    chunk_count=0,
                    is_sample=True,
                    indexed=False,
                    status="pending",
                )
                db.add(doc)
        db.commit()

    def reindex_all(self, db: Session) -> dict[str, Any]:
        """Rebuild the entire FAISS index from all active KnowledgeDocument entries."""
        settings = get_settings()
        docs = db.query(KnowledgeDocument).order_by(KnowledgeDocument.id).all()
        all_chunks: list[dict[str, Any]] = []

        for doc in docs:
            path = Path(doc.file_path)
            if not path.exists():
                doc.status = "missing_file"
                doc.indexed = False
                doc.chunk_count = 0
                continue
            try:
                text = self.extract_text_from_file(path)
                doc_chunks = self.chunk_text(
                    text,
                    filename=doc.original_filename,
                    chunk_size=settings.rag_chunk_size,
                    overlap=settings.rag_chunk_overlap,
                )
                doc.character_count = len(text)
                doc.chunk_count = len(doc_chunks)
                doc.indexed = len(doc_chunks) > 0
                doc.status = "indexed" if len(doc_chunks) > 0 else "empty"
                all_chunks.extend(doc_chunks)
            except Exception:
                doc.indexed = False
                doc.status = "error"
                doc.chunk_count = 0

        db.commit()

        with self._lock:
            self._chunks = all_chunks
            if all_chunks:
                vectors = embedding_service.encode([c["text"] for c in all_chunks])
                dim = vectors.shape[1]
                index = faiss.IndexFlatIP(dim)
                index.add(vectors)
                self._index = index
            else:
                self._index = None
            self._save_persisted_index()

        return {
            "documents_indexed": sum(1 for d in docs if d.indexed),
            "total_documents": len(docs),
            "total_chunks": len(all_chunks),
        }

    def bootstrap(self, db: Session) -> dict[str, Any]:
        """Ensure sample docs are synced and FAISS index is ready on startup."""
        self.sync_sample_documents(db)
        loaded = self.load_persisted_index()
        docs_count = db.query(KnowledgeDocument).count()
        if not loaded or (docs_count > 0 and len(self._chunks) == 0):
            return self.reindex_all(db)
        # Ensure embedding model is warmed up once
        embedding_service.load_model()
        return {
            "documents_indexed": db.query(KnowledgeDocument).filter(KnowledgeDocument.indexed.is_(True)).count(),
            "total_documents": docs_count,
            "total_chunks": len(self._chunks),
        }

    def search(self, query: str, top_k: int | None = None, min_score: float = 0.18) -> list[dict[str, Any]]:
        """Retrieve top-K relevant knowledge chunks with source filenames."""
        settings = get_settings()
        k = top_k or settings.rag_top_k
        if not query or not query.strip():
            return []

        with self._lock:
            if self._index is None or not self._chunks:
                return []
            index = self._index
            chunks = self._chunks

        query_vec = embedding_service.encode([query])
        if query_vec.shape[0] == 0:
            return []

        limit = min(k, len(chunks))
        scores, indices = index.search(np.asarray(query_vec, dtype=np.float32), limit)

        results: list[dict[str, Any]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(chunks):
                continue
            sim = float(score)
            if sim < min_score:
                continue
            chunk = chunks[idx]
            results.append(
                {
                    "filename": chunk["filename"],
                    "score": round(sim, 4),
                    "snippet": chunk["text"],
                }
            )
        return results

    def save_uploaded_bytes(self, safe_filename: str, content: bytes) -> Path:
        """Persist uploaded file safely into backend/data/uploads/."""
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        target = ensure_safe_path(UPLOADS_DIR, UPLOADS_DIR / safe_filename)
        if target.exists():
            stem = target.stem
            suffix = target.suffix
            counter = 1
            while target.exists():
                target = ensure_safe_path(UPLOADS_DIR, UPLOADS_DIR / f"{stem}_{counter}{suffix}")
                counter += 1
        target.write_bytes(content)
        return target


rag_service = RAGService()
