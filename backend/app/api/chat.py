"""Chat endpoint orchestrating VoxLead AI autonomous sales conversations."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services.conversation_service import process_chat_turn

router = APIRouter(prefix="/api", tags=["Chat"])


@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    """Process one customer voice/text turn through memory, RAG, Ollama, CRM, and booking."""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    return await process_chat_turn(db, payload)
