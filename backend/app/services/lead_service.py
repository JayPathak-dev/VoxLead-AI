"""Lead entity extraction and CRM synchronization service."""

import json
import re
from typing import Any, Optional
from sqlalchemy.orm import Session

from app.models import Conversation, Lead
from app.utils.validators import validate_email, validate_phone


INDUSTRY_KEYWORDS = {
    "E-commerce": ["ecommerce", "e-commerce", "online store", "d2c", "shopify", "woocommerce", "retail", "orders", "ई-कॉमर्स"],
    "SaaS / Technology": ["saas", "software", "b2b tech", "app", "platform", "startup", "tech company"],
    "Healthcare": ["clinic", "hospital", "healthcare", "medical", "diagnostic", "dental", "patient"],
    "Real Estate": ["real estate", "property", "builder", "realtor", "housing", "apartments"],
    "EdTech / Education": ["edtech", "coaching", "institute", "academy", "courses", "students", "university"],
    "Financial Services": ["fintech", "finance", "insurance", "loan", "banking", "wealth"],
    "Logistics": ["logistics", "shipping", "courier", "fleet", "delivery", "supply chain"],
    "Agency / Services": ["agency", "consulting", "marketing", "services firm"],
}

SERVICE_KEYWORDS = {
    "AI Chatbot Services": ["chatbot", "chat bot", "whatsapp", "web chat", "support bot", "order tracking", "returns", "चैटबॉट"],
    "Voice Automation": ["voice agent", "voice bot", "phone call", "calling", "inbound", "outbound", "ivr", "voice automation", "वॉयस"],
    "CRM Automation": ["crm", "lead scoring", "pipeline", "follow-up", "follow up", "lead qualification", "सीआरएम"],
}


def _parse_budget(text: str) -> tuple[Optional[str], Optional[float]]:
    """Extract monetary budget string and approximate INR numeric value."""
    patterns = [
        r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh|lac|lakhs|crore)?",
        r"([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh|lac|lakhs)\s*(?:rs|inr|rupees|per month|/month|monthly)?",
        r"budget\s*(?:is|of|around|about|:)?\s*(?:₹|rs\.?|inr|\$)?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|lac)?",
        r"\$\s*([\d,]+(?:\.\d+)?)\s*(k)?",
    ]
    lowered = text.lower()
    for idx, pat in enumerate(patterns):
        match = re.search(pat, lowered, re.IGNORECASE)
        if not match:
            continue
        raw_num = match.group(1).replace(",", "")
        try:
            val = float(raw_num)
        except ValueError:
            continue
        unit = (match.group(2) or "").lower() if match.lastindex and match.lastindex >= 2 else ""
        if unit in ("k", "thousand"):
            val *= 1000
        elif unit in ("lakh", "lac", "lakhs"):
            val *= 100000
        elif unit == "crore":
            val *= 10000000

        # Convert rough USD display if $ explicitly used
        if idx == 3 or "$" in match.group(0):
            display = f"${match.group(1)}{unit.upper()}"
            return display, val * 84.0
        formatted = f"₹{int(val):,}" if val >= 100 else match.group(0).strip()
        return formatted, val
    return None, None


def extract_entities_from_message(message: str, current_context: dict[str, Any]) -> dict[str, Any]:
    """Extract customer info, requirements, budget, timeline, and intent deterministically."""
    text = (message or "").strip()
    lowered = text.lower()
    updates: dict[str, Any] = {}

    # Email
    email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    if email_match:
        valid = validate_email(email_match.group(0))
        if valid:
            updates["customer_email"] = valid

    # Phone (avoid matching budget numbers like 40,000 by requiring >= 10 digits or + prefix / phone keyword)
    phone_match = re.search(r"(?:phone|mobile|call|contact|number|ph|tel)?\s*(?:\+91[\s-]?)?([6-9]\d{9}|\+\d{1,3}[\s-]?\d{7,12})", text, re.IGNORECASE)
    if phone_match:
        valid_phone = validate_phone(phone_match.group(0))
        if valid_phone and len(re.sub(r"\D", "", valid_phone)) >= 10:
            updates["customer_phone"] = valid_phone

    # Customer Name (case-insensitive prefix, capitalized name tokens)
    name_patterns = [
        r"(?i:my name is|i am|i'm|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})",
        r"(?i:name\s*[:\-]\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})",
        r"मेरा नाम\s+([^\s,।]+(?:\s+[^\s,।]+)?)\s*(?:है|हैं)?",
    ]
    blocked_names = {"Looking", "Interested", "Calling", "Running", "From", "Sure", "Yes", "Good", "Fine", "Here", "Not"}
    for pat in name_patterns:
        m = re.search(pat, text)
        if m:
            candidate = m.group(1).strip(" .,!?")
            first_word = candidate.split()[0]
            if first_word not in blocked_names and len(candidate) >= 2:
                updates["customer_name"] = candidate
                break

    # Company Name (stop cleanly at sentence punctuation like '. ' or ',')
    comp_patterns = [
        r"(?:from|company(?:\s+is|\s+name\s+is)?|represent|at|own)\s+([A-Z][A-Za-z0-9&-]+(?:\s+[A-Z][A-Za-z0-9&-]+){0,3}(?:\s+(?:Pvt\.?\s*Ltd\.?|Ltd\.?|Inc\.?|LLP|Solutions|Technologies|Enterprises|Store|Mart|Studio|Labs))?)",
    ]
    for pat in comp_patterns:
        m = re.search(pat, text)
        if m:
            comp = m.group(1).strip(" .,!?")
            if len(comp) >= 2 and comp.lower() not in ("india", "bengaluru", "mumbai", "delhi", "voxlead"):
                updates["company"] = comp
                break

    # Business Type
    for industry, kws in INDUSTRY_KEYWORDS.items():
        if any(kw in lowered for kw in kws):
            updates["business_type"] = industry
            break

    # Budget
    bud_str, bud_num = _parse_budget(text)
    if bud_str:
        updates["budget"] = bud_str
        updates["budget_numeric_inr"] = bud_num

    # Business size / query volume
    size_match = re.search(
        r"(\b\d[\d,]*\+?\s*(?:queries|tickets|messages|calls|orders|leads|employees|staff|people|team members|users)(?:\s*(?:per|a|every)?\s*(?:day|daily|month|monthly|week))?)",
        lowered,
    )
    if size_match:
        updates["business_size"] = size_match.group(1).strip()

    # Timeline
    timeline_match = re.search(
        r"\b(immediately|asap|urgent|this week|next week|this month|next month|within\s+\d+\s+(?:days|weeks|months)|in\s+\d+\s+(?:days|weeks|months)|next quarter|q[1-4])\b",
        lowered,
    )
    if timeline_match:
        updates["timeline"] = timeline_match.group(1).strip()

    # Services discussed
    existing_services: list[str] = list(current_context.get("services_discussed") or [])
    for srv, kws in SERVICE_KEYWORDS.items():
        if any(kw in lowered for kw in kws) and srv not in existing_services:
            existing_services.append(srv)
    if existing_services:
        updates["services_discussed"] = existing_services

    # Requirement & Pain points
    req_triggers = [
        "automate", "automation", "looking for", "need", "want", "require", "help with",
        "customer support", "order tracking", "returns", "lead qualification", "appointment",
        "chatbot", "voice agent", "ऑटोमेट", "चाहिए",
    ]
    if any(t in lowered for t in req_triggers) and len(text) >= 15:
        prev_req = current_context.get("requirement") or ""
        if not prev_req:
            updates["requirement"] = text[:320]
        elif len(prev_req) < 220 and text.lower() not in prev_req.lower():
            # Append concise detail if user elaborates
            if any(k in lowered for k in ("tracking", "return", "support", "booking", "crm", "whatsapp", "hindi", "sales")):
                updates["requirement"] = f"{prev_req}; {text[:160]}"

    pain_triggers = {
        "High repetitive query volume": ["500", "hundreds", "repetitive", "manual", "overload", "too many queries", "order tracking", "returns"],
        "Slow response times / missed leads": ["slow", "missed", "delay", "24/7", "after hours", "response time"],
        "Manual CRM / scheduling effort": ["manual entry", "spreadsheet", "copy", "scheduling", "follow up", "follow-up"],
    }
    pains: list[str] = list(current_context.get("pain_points") or [])
    for pain_label, kws in pain_triggers.items():
        if any(kw in lowered for kw in kws) and pain_label not in pains:
            pains.append(pain_label)
    if pains:
        updates["pain_points"] = pains

    # Buying Intent
    high_intent_kws = ["pricing", "price", "cost", "plan", "demo", "book", "schedule", "appointment", "get started", "buy", "sign up", "onboard", "trial", "बुकिंग", "कीमत"]
    low_intent_kws = ["just looking", "just browsing", "not interested", "too expensive", "maybe later", "no thanks"]
    if any(k in lowered for k in low_intent_kws):
        updates["buying_intent"] = "Low"
    elif any(k in lowered for k in high_intent_kws) or updates.get("budget") or updates.get("timeline"):
        updates["buying_intent"] = "High"
    elif updates.get("requirement") or updates.get("business_type"):
        if current_context.get("buying_intent") != "High":
            updates["buying_intent"] = "Medium"

    return updates


def merge_context(existing: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    """Merge non-null updates into persisted conversation memory without erasing earlier facts."""
    merged = dict(existing)
    for key, val in updates.items():
        if val is None or val == "" or val == []:
            continue
        merged[key] = val
    return merged


def sync_lead_from_context(
    db: Session,
    conv: Conversation,
    context: dict[str, Any],
    sentiment: str,
    score_result: dict[str, Any],
) -> Lead:
    """Create or update the CRM Lead record linked to this conversation."""
    lead: Optional[Lead] = None
    if conv.lead_id:
        lead = db.query(Lead).filter(Lead.id == conv.lead_id).first()

    if lead is None and context.get("customer_email"):
        lead = db.query(Lead).filter(Lead.email == context["customer_email"]).first()

    if lead is None:
        lead = Lead(
            source="AI Voice Agent" if conv.channel == "voice" else "AI Chat Agent",
            status="New",
        )
        db.add(lead)
        db.flush()

    conv.lead_id = lead.id

    if context.get("customer_name"):
        lead.name = context["customer_name"]
    if context.get("customer_email"):
        lead.email = context["customer_email"]
    if context.get("customer_phone"):
        lead.phone = context["customer_phone"]
    if context.get("company"):
        lead.company = context["company"]
    if context.get("business_type"):
        lead.business_type = context["business_type"]
    if context.get("requirement"):
        lead.requirement = context["requirement"]
    if context.get("pain_points"):
        lead.pain_points = ", ".join(context["pain_points"])
    if context.get("budget"):
        lead.budget = context["budget"]
    if context.get("budget_numeric_inr") is not None:
        lead.budget_numeric = float(context["budget_numeric_inr"])
    if context.get("business_size"):
        lead.business_size = context["business_size"]
    if context.get("timeline"):
        lead.timeline = context["timeline"]
    if context.get("buying_intent"):
        lead.buying_intent = context["buying_intent"]
    if context.get("services_discussed"):
        lead.services_interested = json.dumps(context["services_discussed"])
    if context.get("objections"):
        lead.objections = json.dumps(context["objections"])

    lead.sentiment = sentiment
    lead.lead_score = score_result["total_score"]
    lead.score_category = score_result["category"]
    lead.score_breakdown_json = json.dumps(score_result)

    # Preserve Converted status if already converted, otherwise update based on qualification
    if lead.status != "Converted":
        if context.get("appointment_status") == "Confirmed" and score_result["qualified"]:
            lead.status = "Qualified"
        elif lead.status != "Unqualified":
            lead.status = score_result["recommended_status"]

    db.commit()
    db.refresh(lead)
    return lead
