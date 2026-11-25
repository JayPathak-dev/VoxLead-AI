"""Pydantic request and response schemas for VoxLead AI API."""

from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


# --- Health ---
class HealthResponse(BaseModel):
    backend_status: str
    ollama_status: str
    ollama_base_url: str
    model_name: str
    model_available: bool
    embedding_model: str
    embedding_model_status: str
    database_status: str
    knowledge_chunks: int = 0
    error_detail: Optional[str] = None
    install_instructions: Optional[str] = None


# --- Chat & Conversations ---
class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=4000)
    language: Literal["en", "hi"] = "en"
    channel: Literal["voice", "text"] = "voice"
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    company: Optional[str] = None


class RAGSource(BaseModel):
    filename: str
    score: float
    snippet: str


class ScoreCriterion(BaseModel):
    criterion: str
    points: int
    max_points: int
    reason: str


class ScoreBreakdown(BaseModel):
    total_score: int
    category: str
    qualified: bool
    criteria: list[ScoreCriterion]


class ConversationIntelligence(BaseModel):
    lead_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    company: Optional[str] = None
    business_type: Optional[str] = None
    requirement: Optional[str] = None
    pain_points: list[str] = Field(default_factory=list)
    budget: Optional[str] = None
    business_size: Optional[str] = None
    timeline: Optional[str] = None
    buying_intent: str = "Unknown"
    sentiment: str = "Neutral"
    sentiment_reason: Optional[str] = None
    lead_score: int = 0
    score_category: str = "Low potential"
    score_breakdown: Optional[ScoreBreakdown] = None
    qualification_status: str = "New"
    services_discussed: list[str] = Field(default_factory=list)
    objections: list[str] = Field(default_factory=list)
    appointment_status: str = "Not Scheduled"
    appointment_details: Optional[dict[str, Any]] = None
    available_slots_offered: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    language: str
    sources: list[RAGSource] = Field(default_factory=list)
    intelligence: ConversationIntelligence
    latency_ms: int
    ollama_used: bool = True
    error: Optional[str] = None


class MessageOut(BaseModel):
    id: int
    conversation_id: str
    role: str
    content: str
    language: str
    sentiment: Optional[str] = None
    sources: list[RAGSource] = Field(default_factory=list)
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    lead_id: Optional[int] = None
    language: str
    channel: str
    status: str
    compact_summary: Optional[str] = None
    structured_summary: Optional[dict[str, Any]] = None
    message_count: int
    created_at: datetime
    updated_at: datetime


# --- Leads ---
LeadStatus = Literal["New", "Contacted", "Qualified", "Unqualified", "Converted"]


class LeadCreate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    business_type: Optional[str] = Field(default=None, max_length=150)
    requirement: Optional[str] = None
    pain_points: Optional[str] = None
    budget: Optional[str] = Field(default=None, max_length=120)
    business_size: Optional[str] = Field(default=None, max_length=100)
    timeline: Optional[str] = Field(default=None, max_length=120)
    buying_intent: str = "Unknown"
    sentiment: Literal["Positive", "Neutral", "Negative"] = "Neutral"
    lead_score: int = Field(default=0, ge=0, le=100)
    status: LeadStatus = "New"
    source: str = "Manual CRM"


class LeadUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=150)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    business_type: Optional[str] = Field(default=None, max_length=150)
    requirement: Optional[str] = None
    pain_points: Optional[str] = None
    budget: Optional[str] = Field(default=None, max_length=120)
    business_size: Optional[str] = Field(default=None, max_length=100)
    timeline: Optional[str] = Field(default=None, max_length=120)
    buying_intent: Optional[str] = None
    sentiment: Optional[Literal["Positive", "Neutral", "Negative"]] = None
    lead_score: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[LeadStatus] = None
    source: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    business_type: Optional[str] = None
    requirement: Optional[str] = None
    pain_points: Optional[str] = None
    budget: Optional[str] = None
    budget_numeric: Optional[float] = None
    business_size: Optional[str] = None
    timeline: Optional[str] = None
    buying_intent: str
    sentiment: str
    lead_score: int
    score_category: str
    score_breakdown: Optional[dict[str, Any]] = None
    status: str
    source: str
    services_interested: list[str] = Field(default_factory=list)
    objections: list[str] = Field(default_factory=list)
    summary: Optional[dict[str, Any]] = None
    conversation_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# --- Appointments ---
AppointmentStatus = Literal["Confirmed", "Completed", "Cancelled"]


class AppointmentCreate(BaseModel):
    lead_id: Optional[int] = None
    conversation_id: Optional[str] = None
    customer_name: str = Field(..., min_length=1, max_length=150)
    customer_email: Optional[str] = Field(default=None, max_length=255)
    customer_phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    service_topic: str = Field(default="AI Sales Discovery Call", max_length=255)
    resource_name: str = Field(default="Sales Specialist", max_length=100)
    scheduled_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    scheduled_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    duration_minutes: int = Field(default=30, ge=15, le=120)
    confirmed_by_customer: bool = True
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    customer_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    customer_email: Optional[str] = Field(default=None, max_length=255)
    customer_phone: Optional[str] = Field(default=None, max_length=50)
    company: Optional[str] = Field(default=None, max_length=200)
    service_topic: Optional[str] = Field(default=None, max_length=255)
    scheduled_date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    scheduled_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=120)
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    id: int
    appointment_code: str
    lead_id: Optional[int] = None
    conversation_id: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    company: Optional[str] = None
    service_topic: str
    resource_name: str
    scheduled_date: str
    scheduled_time: str
    duration_minutes: int
    timezone: str
    status: str
    confirmed_by_customer: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# --- Knowledge Base ---
class KnowledgeTextCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    content: str = Field(..., min_length=20, max_length=100000)


class KnowledgeDocumentOut(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    chunk_count: int
    character_count: int
    is_sample: bool
    indexed: bool
    status: str
    created_at: datetime
    updated_at: datetime


# --- Settings ---
class WorkspaceSettings(BaseModel):
    default_language: Literal["en", "hi"] = "en"
    voice_rate: float = Field(default=1.0, ge=0.7, le=1.4)
    voice_name: str = "auto"
    tts_enabled: bool = True
    business_name: str = "VoxLead Solutions"
    business_hours: str = "09:30 - 19:00 IST (Mon-Sat)"
    appointment_duration: int = Field(default=30, ge=15, le=90)
    qualification_threshold: int = Field(default=70, ge=40, le=90)
