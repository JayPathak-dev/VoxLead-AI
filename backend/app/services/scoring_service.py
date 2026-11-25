"""Transparent rule-based 100-point lead scoring and qualification service."""

from typing import Any


def calculate_lead_score(
    context: dict[str, Any],
    message_count: int = 1,
    qualification_threshold: int = 70,
    has_appointment: bool = False,
) -> dict[str, Any]:
    """
    Calculate deterministic lead score out of 100 points:
    - Requirement clarity: 20
    - Budget readiness: 20
    - Buying intent: 25
    - Business need: 15
    - Purchase timeline: 10
    - Engagement: 10

    Note: Positive sentiment NEVER auto-qualifies a lead on its own.
    """
    criteria: list[dict[str, Any]] = []

    # 1. Requirement clarity (max 20)
    req = (context.get("requirement") or "").strip()
    services = context.get("services_discussed") or []
    if len(req) >= 25 and len(services) >= 1:
        req_pts = 20
        req_reason = "Clear automation use case and specific service identified."
    elif len(req) >= 12 or len(services) >= 1:
        req_pts = 12
        req_reason = "General requirement shared; deeper workflow scope can be clarified."
    else:
        req_pts = 0
        req_reason = "Specific automation requirement not yet stated."
    criteria.append({"criterion": "Requirement clarity", "points": req_pts, "max_points": 20, "reason": req_reason})

    # 2. Budget readiness (max 20)
    budget_num = context.get("budget_numeric_inr")
    budget_str = (context.get("budget") or "").strip()
    if budget_num is not None:
        if budget_num >= 19000:
            bud_pts = 20
            bud_reason = f"Stated budget ({budget_str}) aligns with VoxLead Starter/Growth plans."
        elif budget_num >= 10000:
            bud_pts = 12
            bud_reason = f"Budget ({budget_str}) mentioned; may need entry-level scoping."
        else:
            bud_pts = 6
            bud_reason = f"Budget ({budget_str}) is below standard monthly plan pricing."
    elif budget_str:
        bud_pts = 12
        bud_reason = f"Budget range indicated ({budget_str})."
    else:
        bud_pts = 0
        bud_reason = "Monthly or project budget not yet discussed."
    criteria.append({"criterion": "Budget readiness", "points": bud_pts, "max_points": 20, "reason": bud_reason})

    # 3. Buying intent (max 25)
    intent = (context.get("buying_intent") or "Unknown").strip().lower()
    if has_appointment or intent == "high":
        intent_pts = 25
        intent_reason = "High buying intent (requested pricing, demo, or appointment)."
    elif intent == "medium":
        intent_pts = 15
        intent_reason = "Moderate buying intent (actively evaluating solution fit)."
    elif intent == "low":
        intent_pts = 5
        intent_reason = "Early-stage browsing or low immediate purchase intent."
    else:
        intent_pts = 5
        intent_reason = "Buying intent still being assessed."
    criteria.append({"criterion": "Buying intent", "points": intent_pts, "max_points": 25, "reason": intent_reason})

    # 4. Business need (max 15)
    btype = (context.get("business_type") or "").strip()
    bsize = (context.get("business_size") or "").strip()
    pains = context.get("pain_points") or []
    need_signals = sum([1 if btype else 0, 1 if bsize else 0, 1 if len(pains) > 0 else 0])
    if need_signals >= 3:
        need_pts = 15
        need_reason = "Industry, volume/team size, and pain points clearly established."
    elif need_signals == 2:
        need_pts = 10
        need_reason = "Business context and operational need partially established."
    elif need_signals == 1:
        need_pts = 5
        need_reason = "Initial business context provided."
    else:
        need_pts = 0
        need_reason = "Business type, volume, and pain points not yet captured."
    criteria.append({"criterion": "Business need", "points": need_pts, "max_points": 15, "reason": need_reason})

    # 5. Purchase timeline (max 10)
    timeline = (context.get("timeline") or "").strip().lower()
    if any(k in timeline for k in ("immediate", "asap", "this week", "this month", "urgent", "next week", "days", "1 month")):
        time_pts = 10
        time_reason = f"Near-term implementation timeline ({context.get('timeline')})."
    elif timeline:
        time_pts = 6
        time_reason = f"Timeline indicated ({context.get('timeline')})."
    else:
        time_pts = 0
        time_reason = "Target launch timeline not yet shared."
    criteria.append({"criterion": "Purchase timeline", "points": time_pts, "max_points": 10, "reason": time_reason})

    # 6. Engagement (max 10)
    has_contact = bool(context.get("customer_name") or context.get("customer_email") or context.get("customer_phone"))
    user_turns = max(1, (message_count + 1) // 2)
    if user_turns >= 4 and has_contact:
        eng_pts = 10
        eng_reason = "Multi-turn engagement with contact details shared."
    elif user_turns >= 3 or has_contact:
        eng_pts = 7
        eng_reason = "Active multi-turn conversation or contact details provided."
    else:
        eng_pts = 3
        eng_reason = "Initial conversation started."
    criteria.append({"criterion": "Engagement", "points": eng_pts, "max_points": 10, "reason": eng_reason})

    total = sum(c["points"] for c in criteria)
    if total >= 70:
        category = "High potential"
    elif total >= 40:
        category = "Medium potential"
    else:
        category = "Low potential"

    # Never mark Qualified solely for Positive sentiment; require score threshold + real requirement/intent
    qualified = bool(
        (total >= qualification_threshold and req_pts >= 12 and intent_pts >= 15)
        or (has_appointment and req_pts >= 12)
    )

    if has_appointment and qualified:
        status = "Qualified"
    elif qualified:
        status = "Qualified"
    elif total >= 40 or user_turns >= 2:
        status = "Contacted"
    else:
        status = "New"

    return {
        "total_score": total,
        "category": category,
        "qualified": qualified,
        "recommended_status": status,
        "criteria": criteria,
    }
