"""Conversation history and structured call summarization endpoints."""

import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, Message
from app.schemas import ConversationOut, MessageOut, RAGSource
from app.services.summary_service import generate_call_summary

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


def _to_conv_out(conv: Conversation) -> ConversationOut:
    structured = None
    if conv.structured_summary_json:
        try:
            structured = json.loads(conv.structured_summary_json)
        except json.JSONDecodeError:
            structured = None
    return ConversationOut(
        id=conv.id,
        lead_id=conv.lead_id,
        language=conv.language,
        channel=conv.channel,
        status=conv.status,
        compact_summary=conv.compact_summary,
        structured_summary=structured,
        message_count=conv.message_count,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(limit: int = 50, db: Session = Depends(get_db)) -> list[ConversationOut]:
    rows = db.query(Conversation).order_by(Conversation.updated_at.desc()).limit(min(limit, 200)).all()
    return [_to_conv_out(c) for c in rows]


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)) -> ConversationOut:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return _to_conv_out(conv)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def get_conversation_messages(conversation_id: str, db: Session = Depends(get_db)) -> list[MessageOut]:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.asc())
        .all()
    )
    output: list[MessageOut] = []
    for m in msgs:
        sources: list[RAGSource] = []
        if m.sources_json:
            try:
                raw = json.loads(m.sources_json)
                sources = [RAGSource(**s) for s in raw if isinstance(s, dict)]
            except Exception:
                sources = []
        output.append(
            MessageOut(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                content=m.content,
                language=m.language,
                sentiment=m.sentiment,
                sources=sources,
                created_at=m.created_at,
            )
        )
    return output


@router.post("/{conversation_id}/summary")
async def summarize_conversation(
    conversation_id: str,
    mark_completed: bool = True,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Generate and persist an Ollama-powered structured call summary."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    if mark_completed:
        conv.status = "completed"
        db.commit()
    summary = await generate_call_summary(db, conv, use_llm=True)
    return {"conversation_id": conv.id, "status": conv.status, "summary": summary}
