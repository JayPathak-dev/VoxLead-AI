"""SQLAlchemy ORM models for VoxLead AI CRM, Conversations, Appointments, and Knowledge Base."""

from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow() -> datetime:
    """Return timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class Lead(Base):
    """CRM Lead record extracted and scored from AI sales conversations."""

    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    company = Column(String(200), nullable=True)
    business_type = Column(String(150), nullable=True)
    requirement = Column(Text, nullable=True)
    pain_points = Column(Text, nullable=True)
    budget = Column(String(120), nullable=True)
    budget_numeric = Column(Float, nullable=True)
    business_size = Column(String(100), nullable=True)
    timeline = Column(String(120), nullable=True)
    buying_intent = Column(String(50), default="Unknown", nullable=False)
    sentiment = Column(String(30), default="Neutral", nullable=False)
    lead_score = Column(Integer, default=0, nullable=False, index=True)
    score_category = Column(String(30), default="Low potential", nullable=False)
    score_breakdown_json = Column(Text, nullable=True)
    status = Column(String(30), default="New", nullable=False, index=True)
    source = Column(String(50), default="AI Voice Agent", nullable=False)
    services_interested = Column(Text, nullable=True)
    objections = Column(Text, nullable=True)
    summary_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    conversations = relationship("Conversation", back_populates="lead")
    appointments = relationship("Appointment", back_populates="lead")


class Conversation(Base):
    """Persistent conversation session with contextual memory and summary."""

    __tablename__ = "conversations"

    id = Column(String(64), primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    language = Column(String(10), default="en", nullable=False)
    channel = Column(String(30), default="voice", nullable=False)
    status = Column(String(30), default="active", nullable=False)
    compact_summary = Column(Text, nullable=True)
    structured_summary_json = Column(Text, nullable=True)
    extracted_context_json = Column(Text, nullable=True)
    message_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.id",
    )
    appointments = relationship("Appointment", back_populates="conversation")


class Message(Base):
    """Individual user or assistant turn within a conversation."""

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        String(64),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    language = Column(String(10), default="en", nullable=False)
    sentiment = Column(String(30), nullable=True)
    sources_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    conversation = relationship("Conversation", back_populates="messages")


class Appointment(Base):
    """Scheduled sales appointment with overlap protection in Asia/Kolkata."""

    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    appointment_code = Column(String(32), unique=True, nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    conversation_id = Column(
        String(64),
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_name = Column(String(150), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    company = Column(String(200), nullable=True)
    service_topic = Column(String(255), default="AI Sales Discovery Call", nullable=False)
    resource_name = Column(String(100), default="Sales Specialist", nullable=False)
    scheduled_date = Column(String(10), nullable=False, index=True)
    scheduled_time = Column(String(5), nullable=False, index=True)
    duration_minutes = Column(Integer, default=30, nullable=False)
    timezone = Column(String(50), default="Asia/Kolkata", nullable=False)
    status = Column(String(30), default="Confirmed", nullable=False, index=True)
    confirmed_by_customer = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="appointments")
    conversation = relationship("Conversation", back_populates="appointments")

    __table_args__ = (
        Index("ix_appointments_slot_lookup", "resource_name", "scheduled_date", "scheduled_time", "status"),
    )


class KnowledgeDocument(Base):
    """Metadata for documents indexed into the local FAISS vector store."""

    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, default=0, nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    character_count = Column(Integer, default=0, nullable=False)
    is_sample = Column(Boolean, default=False, nullable=False)
    indexed = Column(Boolean, default=False, nullable=False)
    status = Column(String(30), default="indexed", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class AppSetting(Base):
    """Persisted workspace preferences configured via the Settings page."""

    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value_json = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
