"""Persistent contextual memory service backed by SQLite."""

import json
import uuid
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models import Conversation, Lead, Message


SLIDING_WINDOW_SIZE = 10


def get_or_create_conversation(
    db: Session,
    session_id: Optional[str] = None,
    language: str = "en",
    channel: str = "voice",
) -> Conversation:
    """Fetch existing conversation by session_id or initialize a new isolated session."""
    if session_id:
        existing = db.query(Conversation).filter(Conversation.id == session_id).first()
        if existing:
            if language and existing.language != language:
                existing.language = language
                db.commit()
            return existing

    new_id = session_id or str(uuid.uuid4())
    conv = Conversation(
        id=new_id,
        language=language,
        channel=channel,
        status="active",
        extracted_context_json=json.dumps({}),
        message_count=0,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def load_context(conv: Conversation) -> dict[str, Any]:
    """Load persisted structured memory dictionary for a conversation."""
    if not conv.extracted_context_json:
        return {}
    try:
        data = json.loads(conv.extracted_context_json)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def save_context(db: Session, conv: Conversation, context: dict[str, Any]) -> None:
    """Persist structured memory dictionary back to SQLite."""
    conv.extracted_context_json = json.dumps(context, ensure_ascii=False)
    db.commit()


def append_message(
    db: Session,
    conv: Conversation,
    role: str,
    content: str,
    language: str = "en",
    sentiment: Optional[str] = None,
    sources: Optional[list[dict[str, Any]]] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> Message:
    """Persist a conversation message and update message_count & rolling compact summary."""
    msg = Message(
        conversation_id=conv.id,
        role=role,
        content=content,
        language=language,
        sentiment=sentiment,
        sources_json=json.dumps(sources or [], ensure_ascii=False) if sources else None,
        metadata_json=json.dumps(metadata or {}, ensure_ascii=False) if metadata else None,
    )
    db.add(msg)
    conv.message_count = (conv.message_count or 0) + 1
    db.commit()
    db.refresh(msg)

    # Maintain compact summary when history exceeds sliding window
    if conv.message_count > SLIDING_WINDOW_SIZE:
        _refresh_compact_summary(db, conv)

    return msg


def _refresh_compact_summary(db: Session, conv: Conversation) -> None:
    """Build a deterministic compact summary of older turns outside the sliding window."""
    all_msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.id.asc())
        .all()
    )
    if len(all_msgs) <= SLIDING_WINDOW_SIZE:
        return
    older = all_msgs[:-SLIDING_WINDOW_SIZE]
    snippets: list[str] = []
    for m in older[-8:]:
        speaker = "Customer" if m.role == "user" else "Agent"
        clean = " ".join(m.content.split())
        snippets.append(f"{speaker}: {clean[:140]}")
    ctx = load_context(conv)
    facts = []
    for key in ("customer_name", "company", "business_type", "requirement", "budget", "timeline"):
        if ctx.get(key):
            facts.append(f"{key}={ctx[key]}")
    fact_line = f"Captured facts: {', '.join(facts)}. " if facts else ""
    conv.compact_summary = fact_line + "Earlier turns: " + " | ".join(snippets)
    db.commit()


def get_recent_messages(db: Session, conversation_id: str, limit: int = SLIDING_WINDOW_SIZE) -> list[dict[str, str]]:
    """Return the latest sliding window of messages formatted for Ollama /api/chat."""
    rows = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [{"role": r.role, "content": r.content} for r in rows if r.role in ("user", "assistant")]
