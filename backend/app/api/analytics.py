"""Real database-driven analytics endpoints for Dashboard and Analytics pages."""

import json
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, Conversation, KnowledgeDocument, Lead

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db)) -> dict[str, Any]:
    leads = db.query(Lead).all()
    total_leads = len(leads)
    qualified_leads = sum(1 for l in leads if l.status in ("Qualified", "Converted"))
    appointments = db.query(Appointment).all()
    active_appointments = sum(1 for a in appointments if a.status in ("Confirmed", "Completed"))
    total_conversations = db.query(Conversation).count()
    docs_count = db.query(KnowledgeDocument).count()

    avg_score = round(sum(l.lead_score for l in leads) / total_leads, 1) if total_leads else 0.0
    conversion_rate = round((qualified_leads / total_leads) * 100, 1) if total_leads else 0.0

    # Popular services & common objections from real leads
    service_counter: Counter[str] = Counter()
    objection_counter: Counter[str] = Counter()
    for l in leads:
        if l.services_interested:
            try:
                for s in json.loads(l.services_interested):
                    service_counter[str(s)] += 1
            except Exception:
                pass
        if l.objections:
            try:
                for o in json.loads(l.objections):
                    objection_counter[str(o)] += 1
            except Exception:
                pass

    recent_leads = (
        db.query(Lead)
        .order_by(Lead.created_at.desc())
        .limit(5)
        .all()
    )
    recent_appointments = (
        db.query(Appointment)
        .order_by(Appointment.created_at.desc())
        .limit(5)
        .all()
    )

    recent_activity = []
    for l in recent_leads:
        recent_activity.append(
            {
                "type": "lead",
                "title": l.name or l.company or f"Lead #{l.id}",
                "subtitle": f"{l.status} • Score {l.lead_score}/100 • {l.sentiment}",
                "timestamp": l.created_at.isoformat() if l.created_at else "",
            }
        )
    for a in recent_appointments:
        recent_activity.append(
            {
                "type": "appointment",
                "title": f"{a.customer_name} ({a.appointment_code})",
                "subtitle": f"{a.scheduled_date} {a.scheduled_time} IST • {a.status}",
                "timestamp": a.created_at.isoformat() if a.created_at else "",
            }
        )
    recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "total_leads": total_leads,
        "qualified_leads": qualified_leads,
        "appointments_booked": active_appointments,
        "conversion_rate": conversion_rate,
        "average_lead_score": avg_score,
        "total_conversations": total_conversations,
        "knowledge_documents": docs_count,
        "popular_services": [{"name": k, "count": v} for k, v in service_counter.most_common(6)],
        "common_objections": [{"name": k, "count": v} for k, v in objection_counter.most_common(6)],
        "recent_activity": recent_activity[:8],
    }


@router.get("/leads")
def analytics_leads(db: Session = Depends(get_db)) -> dict[str, Any]:
    leads = db.query(Lead).order_by(Lead.created_at.asc()).all()
    by_day: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "qualified": 0})
    status_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()

    for l in leads:
        day = l.created_at.strftime("%Y-%m-%d") if isinstance(l.created_at, datetime) else "Unknown"
        by_day[day]["total"] += 1
        if l.status in ("Qualified", "Converted"):
            by_day[day]["qualified"] += 1
        status_counts[l.status] += 1
        category_counts[l.score_category] += 1

    timeline = [{"date": d, "total": v["total"], "qualified": v["qualified"]} for d, v in sorted(by_day.items())]
    by_status = [{"status": s, "count": status_counts.get(s, 0)} for s in ("New", "Contacted", "Qualified", "Unqualified", "Converted")]
    by_potential = [{"category": c, "count": category_counts.get(c, 0)} for c in ("Low potential", "Medium potential", "High potential")]

    return {
        "leads_over_time": timeline,
        "by_status": by_status,
        "by_potential": by_potential,
    }


@router.get("/sentiment")
def analytics_sentiment(db: Session = Depends(get_db)) -> dict[str, Any]:
    leads = db.query(Lead).all()
    counts: Counter[str] = Counter(l.sentiment for l in leads)
    return {
        "distribution": [
            {"sentiment": s, "count": counts.get(s, 0)}
            for s in ("Positive", "Neutral", "Negative")
        ]
    }


@router.get("/appointments")
def analytics_appointments(db: Session = Depends(get_db)) -> dict[str, Any]:
    appts = db.query(Appointment).order_by(Appointment.scheduled_date.asc()).all()
    by_date: dict[str, dict[str, int]] = defaultdict(lambda: {"confirmed": 0, "cancelled": 0, "completed": 0})
    status_counts: Counter[str] = Counter()

    for a in appts:
        status_counts[a.status] += 1
        key = a.status.lower()
        if key in by_date[a.scheduled_date]:
            by_date[a.scheduled_date][key] += 1

    trends = [{"date": d, **vals} for d, vals in sorted(by_date.items())]
    return {
        "trends": trends,
        "by_status": [
            {"status": s, "count": status_counts.get(s, 0)}
            for s in ("Confirmed", "Completed", "Cancelled")
        ],
    }
