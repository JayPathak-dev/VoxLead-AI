"""Autonomous agentic sales conversation orchestrator."""

import json
import re
from datetime import timedelta
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models import AppSetting, Appointment, Conversation, Lead
from app.schemas import AppointmentCreate, ChatRequest, ChatResponse, ConversationIntelligence, RAGSource
from app.services import booking_service, lead_service, memory_service, scoring_service, sentiment_service
from app.services.rag_service import rag_service
from app.services.ollama_service import OllamaError, ollama_service
from app.services.summary_service import generate_call_summary
from app.utils.prompts import build_sales_system_prompt
from app.utils.validators import is_past_slot_ist, now_ist


APPOINTMENT_INTENT_KWS = [
    "appointment", "book", "schedule", "demo", "discovery call", "meeting", "slot", "slots",
    "available", "availability", "talk to", "consultation", "call me", "अपॉइंटमेंट", "मीटिंग", "डेमो", "स्लॉट",
]

CONFIRM_INTENT_PATTERNS = [
    r"\b(yes|yeah|yep|sure|confirm|confirmed|book it|schedule it|go ahead|please book|lock it|that works|works for me|ok book|okay book)\b",
    r"(हाँ|हां|जी|कन्फर्म|बुक कर|ठीक है)",
]


def _get_runtime_settings(db: Session) -> dict[str, Any]:
    row = db.query(AppSetting).filter(AppSetting.key == "workspace_settings").first()
    defaults = {"appointment_duration": 30, "qualification_threshold": 70}
    if not row:
        return defaults
    try:
        parsed = json.loads(row.value_json)
        defaults.update(parsed)
    except json.JSONDecodeError:
        pass
    return defaults


def _parse_requested_date_time(message: str) -> tuple[Optional[str], Optional[str]]:
    """Extract requested YYYY-MM-DD and HH:MM (24h) from natural user text in Asia/Kolkata."""
    text = message.lower()
    today = now_ist().date()
    parsed_date: Optional[str] = None
    parsed_time: Optional[str] = None

    iso_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    if iso_match:
        parsed_date = iso_match.group(1)
    elif "day after tomorrow" in text or "परसों" in text:
        parsed_date = (today + timedelta(days=2)).strftime("%Y-%m-%d")
    elif "tomorrow" in text or "कल" in text:
        parsed_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "today" in text or "आज" in text:
        parsed_date = today.strftime("%Y-%m-%d")

    # 24h time like 14:00 or 11:30
    t24 = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm)?\b", text, re.IGNORECASE)
    if t24:
        hh = int(t24.group(1))
        mm = int(t24.group(2))
        mer = (t24.group(3) or "").lower()
        if mer == "pm" and hh < 12:
            hh += 12
        elif mer == "am" and hh == 12:
            hh = 0
        parsed_time = f"{hh:02d}:{mm:02d}"
    else:
        t12 = re.search(r"\b(1[0-2]|[1-9])\s*(am|pm)\b", text, re.IGNORECASE)
        if t12:
            hh = int(t12.group(1))
            mer = t12.group(2).lower()
            if mer == "pm" and hh < 12:
                hh += 12
            elif mer == "am" and hh == 12:
                hh = 0
            parsed_time = f"{hh:02d}:00"

    return parsed_date, parsed_time


def _is_explicit_confirmation(message: str) -> bool:
    return any(re.search(pat, message, re.IGNORECASE) for pat in CONFIRM_INTENT_PATTERNS)


def _handle_controlled_appointment_tools(
    db: Session,
    conv: Conversation,
    lead: Optional[Lead],
    context: dict[str, Any],
    message: str,
    duration_minutes: int,
) -> tuple[Optional[str], list[str], Optional[dict[str, Any]]]:
    """
    Controlled Python tool router for appointment checking & booking.
    LLM never accesses SQL directly and never confirms a booking unless DB insertion succeeds.
    """
    lowered = message.lower()
    req_date, req_time = _parse_requested_date_time(message)
    explicit_confirm = _is_explicit_confirmation(message)
    asks_about_appt = any(kw in lowered for kw in APPOINTMENT_INTENT_KWS)

    # Check if conversation already has a confirmed appointment
    existing_appt = (
        db.query(Appointment)
        .filter(Appointment.conversation_id == conv.id, Appointment.status == "Confirmed")
        .order_by(Appointment.id.desc())
        .first()
    )
    if existing_appt and not (req_date or req_time):
        appt_dict = {
            "id": existing_appt.id,
            "appointment_code": existing_appt.appointment_code,
            "scheduled_date": existing_appt.scheduled_date,
            "scheduled_time": existing_appt.scheduled_time,
            "timezone": existing_appt.timezone,
            "status": existing_appt.status,
            "customer_name": existing_appt.customer_name,
        }
        return (
            f"BOOKING CONFIRMED in database. Appointment Code: {existing_appt.appointment_code}, "
            f"Date: {existing_appt.scheduled_date}, Time: {existing_appt.scheduled_time} IST, "
            f"Customer: {existing_appt.customer_name}.",
            [],
            appt_dict,
        )

    pending_slot = context.get("pending_slot")
    target_date = req_date or (pending_slot or {}).get("date")
    target_time = req_time or (pending_slot or {}).get("time")

    # If user picked a date + time
    if target_date and target_time and (asks_about_appt or pending_slot or req_date or req_time):
        if is_past_slot_ist(target_date, target_time):
            slots = booking_service.get_available_slots(db, duration_minutes=duration_minutes)
            labels = [s["label"] for s in slots[:4]]
            context.pop("pending_slot", None)
            return (
                f"SLOT REJECTED: {target_date} at {target_time} IST is in the past. "
                f"Offer these valid upcoming slots instead: {', '.join(labels)}.",
                labels,
                None,
            )

        if booking_service.has_conflict(db, target_date, target_time, duration_minutes=duration_minutes):
            slots = booking_service.get_available_slots(db, target_date=target_date, duration_minutes=duration_minutes)
            if not slots:
                slots = booking_service.get_available_slots(db, duration_minutes=duration_minutes)
            labels = [s["label"] for s in slots[:4]]
            context.pop("pending_slot", None)
            return (
                f"SLOT CONFLICT: {target_date} at {target_time} IST is already booked. "
                f"Offer these available slots instead: {', '.join(labels)}.",
                labels,
                None,
            )

        # Slot is valid and free! Save as pending slot
        context["pending_slot"] = {"date": target_date, "time": target_time}
        customer_name = context.get("customer_name")

        if explicit_confirm:
            if not customer_name:
                return (
                    f"SLOT AVAILABLE: {target_date} at {target_time} IST is free, and the customer wants to confirm, "
                    "but customer_name is still missing. Ask the customer for their full name to complete the booking.",
                    [f"{target_date} at {target_time} IST"],
                    None,
                )
            try:
                appt = booking_service.create_appointment(
                    db,
                    AppointmentCreate(
                        lead_id=lead.id if lead else None,
                        conversation_id=conv.id,
                        customer_name=customer_name,
                        customer_email=context.get("customer_email"),
                        customer_phone=context.get("customer_phone"),
                        company=context.get("company"),
                        service_topic=", ".join(context.get("services_discussed") or ["AI Sales Discovery Call"]),
                        scheduled_date=target_date,
                        scheduled_time=target_time,
                        duration_minutes=duration_minutes,
                        confirmed_by_customer=True,
                        notes=context.get("requirement"),
                    ),
                )
                context["appointment_status"] = "Confirmed"
                context.pop("pending_slot", None)
                appt_dict = {
                    "id": appt.id,
                    "appointment_code": appt.appointment_code,
                    "scheduled_date": appt.scheduled_date,
                    "scheduled_time": appt.scheduled_time,
                    "timezone": appt.timezone,
                    "status": appt.status,
                    "customer_name": appt.customer_name,
                }
                return (
                    f"BOOKING CONFIRMED in database! Appointment Code: {appt.appointment_code}, "
                    f"Date: {appt.scheduled_date}, Time: {appt.scheduled_time} IST, "
                    f"Customer: {appt.customer_name}. Confirm these exact details to the customer.",
                    [],
                    appt_dict,
                )
            except booking_service.BookingError as exc:
                return f"BOOKING FAILED: {exc}", [], None

        return (
            f"SLOT AVAILABLE (NOT YET BOOKED): {target_date} at {target_time} IST is open. "
            "Ask the customer to explicitly confirm this slot (and provide their name if not yet shared) before booking.",
            [f"{target_date} at {target_time} IST"],
            None,
        )

    # If user expressed interest in booking or asked for slots without picking full date+time
    if asks_about_appt or req_date:
        slots = booking_service.get_available_slots(db, target_date=req_date, duration_minutes=duration_minutes)
        labels = [s["label"] for s in slots[:4]]
        if labels:
            return (
                f"AVAILABLE SLOTS (Asia/Kolkata): {', '.join(labels)}. "
                "Present 2-3 of these valid slots and ask the customer which date/time they confirm.",
                labels,
                None,
            )
        return (
            "No slots available on the requested date. Ask the customer for an alternative upcoming weekday.",
            [],
            None,
        )

    return None, [], None


async def process_chat_turn(db: Session, payload: ChatRequest) -> ChatResponse:
    """Execute end-to-end turn: memory -> extraction -> sentiment -> scoring -> booking -> RAG -> Ollama."""
    runtime_cfg = _get_runtime_settings(db)
    conv = memory_service.get_or_create_conversation(
        db,
        session_id=payload.session_id,
        language=payload.language,
        channel=payload.channel,
    )

    context = memory_service.load_context(conv)

    # Merge any customer details supplied directly via UI sidebar fields
    ui_updates = {
        "customer_name": payload.customer_name,
        "customer_email": payload.customer_email,
        "customer_phone": payload.customer_phone,
        "company": payload.company,
    }
    context = lead_service.merge_context(context, ui_updates)

    # Extract entities from customer message
    extracted = lead_service.extract_entities_from_message(payload.message, context)
    context = lead_service.merge_context(context, extracted)

    # Sentiment & objections
    sentiment, sentiment_reason, objections = sentiment_service.analyze_sentiment(payload.message)
    if objections:
        merged_obj = list(context.get("objections") or [])
        for obj in objections:
            if obj not in merged_obj:
                merged_obj.append(obj)
        context["objections"] = merged_obj
    context["sentiment"] = sentiment
    context["sentiment_reason"] = sentiment_reason

    # Persist user message first
    memory_service.append_message(
        db,
        conv=conv,
        role="user",
        content=payload.message,
        language=payload.language,
        sentiment=sentiment,
    )

    # Score lead before booking check, then re-score if appointment booked
    has_appt = (
        db.query(Appointment)
        .filter(Appointment.conversation_id == conv.id, Appointment.status == "Confirmed")
        .first()
        is not None
    )
    score_res = scoring_service.calculate_lead_score(
        context=context,
        message_count=conv.message_count,
        qualification_threshold=int(runtime_cfg.get("qualification_threshold", 70)),
        has_appointment=has_appt,
    )
    context["lead_score"] = score_res["total_score"]

    # Sync lead record
    lead = lead_service.sync_lead_from_context(db, conv, context, sentiment, score_res)

    # Controlled appointment tool routing
    appt_ctx, offered_slots, appt_details = _handle_controlled_appointment_tools(
        db=db,
        conv=conv,
        lead=lead,
        context=context,
        message=payload.message,
        duration_minutes=int(runtime_cfg.get("appointment_duration", 30)),
    )

    # If appointment was newly booked this turn, refresh score & lead status
    if appt_details and appt_details.get("status") == "Confirmed":
        score_res = scoring_service.calculate_lead_score(
            context=context,
            message_count=conv.message_count,
            qualification_threshold=int(runtime_cfg.get("qualification_threshold", 70)),
            has_appointment=True,
        )
        context["lead_score"] = score_res["total_score"]
        lead = lead_service.sync_lead_from_context(db, conv, context, sentiment, score_res)

    memory_service.save_context(db, conv, context)

    # RAG retrieval
    rag_hits = rag_service.search(payload.message)
    rag_context_str = "\n\n".join(
        f"[Source: {hit['filename']} | Relevance: {hit['score']}]\n{hit['snippet']}"
        for hit in rag_hits
    )
    sources_models = [RAGSource(**hit) for hit in rag_hits]

    # Build Ollama prompt with sliding window + persisted memory
    system_prompt = build_sales_system_prompt(
        language=payload.language,
        known_context=context,
        rag_context=rag_context_str,
        compact_summary=conv.compact_summary,
        appointment_context=appt_ctx,
    )
    history = memory_service.get_recent_messages(db, conv.id)
    ollama_messages = [{"role": "system", "content": system_prompt}, *history]

    ollama_used = True
    error_msg: Optional[str] = None
    latency_ms = 0

    try:
        llm_res = await ollama_service.chat(ollama_messages, temperature=0.35, num_predict=320)
        reply = llm_res["content"]
        latency_ms = llm_res["latency_ms"]
        if not reply:
            reply = "Thank you for sharing that. Could you tell me a bit more about your automation goals?"
    except OllamaError as exc:
        ollama_used = False
        error_msg = str(exc)
        if payload.language == "hi":
            reply = (
                "क्षमा करें, स्थानीय Ollama AI सेवा अभी उपलब्ध नहीं है। "
                f"विवरण: {exc}"
            )
        else:
            reply = (
                "Local Ollama AI service is currently unavailable, so a live LLM response could not be generated. "
                f"Detail: {exc}"
            )

    # Persist assistant turn
    memory_service.append_message(
        db,
        conv=conv,
        role="assistant",
        content=reply,
        language=payload.language,
        sources=[s.model_dump() for s in sources_models],
        metadata={"latency_ms": latency_ms, "ollama_used": ollama_used},
    )

    # Refresh structured call summary (deterministic update per turn so lead detail always has latest state)
    await generate_call_summary(db, conv, use_llm=False)

    intelligence = ConversationIntelligence(
        lead_id=lead.id,
        customer_name=lead.name,
        customer_email=lead.email,
        customer_phone=lead.phone,
        company=lead.company,
        business_type=lead.business_type,
        requirement=lead.requirement,
        pain_points=context.get("pain_points") or [],
        budget=lead.budget,
        business_size=lead.business_size,
        timeline=lead.timeline,
        buying_intent=lead.buying_intent,
        sentiment=lead.sentiment,
        sentiment_reason=context.get("sentiment_reason"),
        lead_score=lead.lead_score,
        score_category=lead.score_category,
        score_breakdown={
            "total_score": score_res["total_score"],
            "category": score_res["category"],
            "qualified": score_res["qualified"],
            "criteria": score_res["criteria"],
        },
        qualification_status=lead.status,
        services_discussed=context.get("services_discussed") or [],
        objections=context.get("objections") or [],
        appointment_status=appt_details["status"] if appt_details else context.get("appointment_status", "Not Scheduled"),
        appointment_details=appt_details,
        available_slots_offered=offered_slots,
    )

    return ChatResponse(
        session_id=conv.id,
        reply=reply,
        language=payload.language,
        sources=sources_models,
        intelligence=intelligence,
        latency_ms=latency_ms,
        ollama_used=ollama_used,
        error=error_msg,
    )
