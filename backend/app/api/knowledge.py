"""Knowledge Base document upload, text ingestion, reindexing, and deletion endpoints."""

import re
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import UPLOADS_DIR, get_settings
from app.database import get_db
from app.models import KnowledgeDocument
from app.schemas import KnowledgeDocumentOut, KnowledgeTextCreate
from app.services.rag_service import rag_service
from app.utils.validators import ensure_safe_path, sanitize_filename

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base"])


@router.get("", response_model=list[KnowledgeDocumentOut])
def list_knowledge_documents(db: Session = Depends(get_db)) -> list[KnowledgeDocument]:
    return db.query(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc()).all()


@router.post("/upload", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> KnowledgeDocument:
    settings = get_settings()
    try:
        safe_name = sanitize_filename(file.filename or "uploaded_doc.txt")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(raw_bytes) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {settings.max_upload_bytes // (1024 * 1024)} MB.",
        )

    saved_path = rag_service.save_uploaded_bytes(safe_name, raw_bytes)
    try:
        extracted = rag_service.extract_text_from_file(saved_path)
    except Exception as exc:
        saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {exc}") from exc

    if not extracted.strip():
        saved_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="No readable text could be extracted from the file.")

    doc = KnowledgeDocument(
        filename=saved_path.name,
        original_filename=file.filename or saved_path.name,
        file_type=saved_path.suffix.lstrip(".").lower(),
        file_path=str(saved_path),
        file_size_bytes=len(raw_bytes),
        character_count=len(extracted),
        chunk_count=0,
        is_sample=False,
        indexed=False,
        status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    rag_service.reindex_all(db)
    db.refresh(doc)
    return doc


@router.post("/text", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
def add_knowledge_text(payload: KnowledgeTextCreate, db: Session = Depends(get_db)) -> KnowledgeDocument:
    slug = re.sub(r"[^A-Za-z0-9_-]+", "_", payload.title.strip()).strip("_")[:80] or "manual_note"
    safe_name = f"{slug}.txt"
    content_bytes = payload.content.strip().encode("utf-8")
    saved_path = rag_service.save_uploaded_bytes(safe_name, content_bytes)

    doc = KnowledgeDocument(
        filename=saved_path.name,
        original_filename=f"{payload.title.strip()}.txt",
        file_type="manual",
        file_path=str(saved_path),
        file_size_bytes=len(content_bytes),
        character_count=len(payload.content.strip()),
        chunk_count=0,
        is_sample=False,
        indexed=False,
        status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    rag_service.reindex_all(db)
    db.refresh(doc)
    return doc


@router.post("/reindex")
def reindex_knowledge_base(db: Session = Depends(get_db)) -> dict[str, int]:
    return rag_service.reindex_all(db)


@router.delete("/{doc_id}", status_code=status.HTTP_200_OK)
def delete_knowledge_document(doc_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Knowledge document not found.")

    file_path = Path(doc.file_path)
    # Remove uploaded files from disk; sample docs stay in repo unless explicitly deleted?
    # Deleting the DB record + reindexing removes its content from FAISS retrieval immediately.
    if not doc.is_sample and file_path.exists():
        try:
            safe = ensure_safe_path(UPLOADS_DIR, file_path)
            safe.unlink(missing_ok=True)
        except ValueError:
            pass

    db.delete(doc)
    db.commit()

    stats = rag_service.reindex_all(db)
    return {"message": f"Document '{doc.original_filename}' removed and index rebuilt.", **stats}
