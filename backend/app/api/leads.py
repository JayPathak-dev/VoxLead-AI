"""CRM Leads CRUD endpoints with search, filtering, and sorting."""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, Lead
from app.schemas import LeadCreate, LeadOut, LeadUpdate

router = APIRouter(prefix="/api/leads", tags=["Leads"])


def _safe_json_loads(raw: Optional[str], default):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _to_lead_out(db: Session, lead: Lead) -> LeadOut:
    conv_ids = [
        c.id
        for c in db.query(Conversation.id)
        .filter(Conversation.lead_id == lead.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    ]
    return LeadOut(
        id=lead.id,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        company=lead.company,
        business_type=lead.business_type,
        requirement=lead.requirement,
        pain_points=lead.pain_points,
        budget=lead.budget,
        budget_numeric=lead.budget_numeric,
        business_size=lead.business_size,
        timeline=lead.timeline,
        buying_intent=lead.buying_intent,
        sentiment=lead.sentiment,
        lead_score=lead.lead_score,
        score_category=lead.score_category,
        score_breakdown=_safe_json_loads(lead.score_breakdown_json, None),
        status=lead.status,
        source=lead.source,
        services_interested=_safe_json_loads(lead.services_interested, []),
        objections=_safe_json_loads(lead.objections, []),
        summary=_safe_json_loads(lead.summary_json, None),
        conversation_ids=conv_ids,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
    )


@router.get("", response_model=list[LeadOut])
def list_leads(
    search: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    sentiment: Optional[str] = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
) -> list[LeadOut]:
    query = db.query(Lead)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Lead.name.ilike(term),
                Lead.email.ilike(term),
                Lead.company.ilike(term),
                Lead.business_type.ilike(term),
                Lead.requirement.ilike(term),
            )
        )
    if status_filter and status_filter != "All":
        query = query.filter(Lead.status == status_filter)
    if sentiment and sentiment != "All":
        query = query.filter(Lead.sentiment == sentiment)

    sort_col = {
        "lead_score": Lead.lead_score,
        "name": Lead.name,
        "status": Lead.status,
        "created_at": Lead.created_at,
        "updated_at": Lead.updated_at,
    }.get(sort_by, Lead.created_at)

    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())
    return [_to_lead_out(db, lead) for lead in query.all()]


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)) -> LeadOut:
    score = payload.lead_score
    category = "High potential" if score >= 70 else ("Medium potential" if score >= 40 else "Low potential")
    lead = Lead(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        company=payload.company,
        business_type=payload.business_type,
        requirement=payload.requirement,
        pain_points=payload.pain_points,
        budget=payload.budget,
        business_size=payload.business_size,
        timeline=payload.timeline,
        buying_intent=payload.buying_intent,
        sentiment=payload.sentiment,
        lead_score=score,
        score_category=category,
        status=payload.status,
        source=payload.source,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return _to_lead_out(db, lead)


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: int, db: Session = Depends(get_db)) -> LeadOut:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return _to_lead_out(db, lead)


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)) -> LeadOut:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(lead, k, v)
    if "lead_score" in updates and updates["lead_score"] is not None:
        s = updates["lead_score"]
        lead.score_category = "High potential" if s >= 70 else ("Medium potential" if s >= 40 else "Low potential")
    db.commit()
    db.refresh(lead)
    return _to_lead_out(db, lead)


@router.delete("/{lead_id}", status_code=status.HTTP_200_OK)
def delete_lead(lead_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    db.delete(lead)
    db.commit()
    return {"message": f"Lead {lead_id} deleted successfully."}
