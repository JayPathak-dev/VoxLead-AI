"""Structured call summarization service using local Ollama with deterministic fallback."""

import json
from typing import Any
from sqlalchemy.orm import Session

from app.models import Appointment, Conversation, Lead, Message
from app.services.ollama_service import OllamaError, ollama_service
from app.utils.json_parser import extract_json_object
from app.utils.prompts import SUMMARY_SYSTEM_PROMPT


def build_deterministic_summary(
    conv: Conversation,
    lead: Lead | None,
    context: dict[str, Any],
    appointment: Appointment | None,
) -> dict[str, Any]:
    """Construct complete 14-field summary reliably from persisted CRM & conversation state."""
    score = lead.lead_score if lead else int(context.get("lead_score") or 0)
    qual_status = lead.status if lead else ("Qualified" if score >= 70 else "New")
    appt_status = (
        f"Confirmed ({appointment.appointment_code} on {appointment.scheduled_date} at {appointment.scheduled_time} IST)"
        if appointment and appointment.status == "Confirmed"
        else context.get("appointment_status", "Not Scheduled")
    )

    if appointment and appointment.status == "Confirmed":
        next_action = f"Prepare tailored demo for {appointment.scheduled_date} {appointment.scheduled_time} IST discovery call."
    elif score >= 70:
        next_action = "High-potential lead: follow up within 4 hours to finalize discovery call booking."
    elif score >= 40:
        next_action = "Send relevant VoxLead case study and pricing breakdown to clarify budget and timeline."
    else:
        next_action = "Nurture lead with introductory VoxLead Solutions overview."

    return {
        "customer_name": (lead.name if lead and lead.name else context.get("customer_name")) or "Not provided",
        "company": (lead.company if lead and lead.company else context.get("company")) or "Not provided",
        "business_type": (lead.business_type if lead and lead.business_type else context.get("business_type")) or "Not provided",
        "main_requirement": (lead.requirement if lead and lead.requirement else context.get("requirement")) or "Exploratory inquiry",
        "pain_points": context.get("pain_points") or ([] if not (lead and lead.pain_points) else [p.strip() for p in lead.pain_points.split(",")]),
        "budget": (lead.budget if lead and lead.budget else context.get("budget")) or "Not provided",
        "sentiment": (lead.sentiment if lead else context.get("sentiment")) or "Neutral",
        "buying_intent": (lead.buying_intent if lead else context.get("buying_intent")) or "Unknown",
        "services_discussed": context.get("services_discussed") or [],
        "objections": context.get("objections") or [],
        "lead_score": score,
        "qualification_status": qual_status,
        "recommended_next_action": next_action,
        "appointment_status": appt_status,
    }


async def generate_call_summary(
    db: Session,
    conv: Conversation,
    use_llm: bool = True,
) -> dict[str, Any]:
    """Generate and persist structured conversation summary in SQLite."""
    from app.services.memory_service import load_context

    context = load_context(conv)
    lead = db.query(Lead).filter(Lead.id == conv.lead_id).first() if conv.lead_id else None
    appointment = (
        db.query(Appointment)
        .filter(Appointment.conversation_id == conv.id, Appointment.status == "Confirmed")
        .order_by(Appointment.id.desc())
        .first()
    )

    fallback = build_deterministic_summary(conv, lead, context, appointment)

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.id.asc())
        .all()
    )

    summary = dict(fallback)
    if use_llm and messages:
        transcript = "\n".join(
            f"{'Customer' if m.role == 'user' else 'VoxLead AI'}: {m.content}"
            for m in messages[-16:]
        )
        known_facts = json.dumps(fallback, ensure_ascii=False)
        try:
            res = await ollama_service.chat(
                messages=[
                    {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Known CRM Facts:\n{known_facts}\n\nTranscript:\n{transcript}",
                    },
                ],
                temperature=0.1,
                format_json=True,
                num_predict=450,
            )
            parsed = extract_json_object(res["content"])
            if parsed:
                for key, default_val in fallback.items():
                    val = parsed.get(key)
                    if val not in (None, "", "null"):
                        if key == "lead_score":
                            summary[key] = fallback["lead_score"]
                        elif key == "appointment_status" and appointment:
                            summary[key] = fallback["appointment_status"]
                        else:
                            summary[key] = val
        except OllamaError:
            pass

    conv.structured_summary_json = json.dumps(summary, ensure_ascii=False)
    if lead:
        lead.summary_json = json.dumps(summary, ensure_ascii=False)
    db.commit()
    return summary
