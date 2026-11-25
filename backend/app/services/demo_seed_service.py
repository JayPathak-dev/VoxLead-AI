"""Explicit demo-data seeding service for showcasing VoxLead AI CRM and Analytics."""

from datetime import datetime, timedelta, timezone
import json
from typing import Any
from sqlalchemy.orm import Session

from app.models import Appointment, Conversation, Lead, Message
from app.services.scoring_service import calculate_lead_score
from app.utils.validators import now_ist


def seed_demo_data(db: Session) -> dict[str, Any]:
    """Populate realistic fictional sample leads, conversations, and appointments if requested."""
    if db.query(Lead).count() > 0:
        return {
            "seeded": False,
            "message": "Database already contains records. Demo seeding skipped to preserve existing data.",
            "leads_count": db.query(Lead).count(),
        }

    now = datetime.now(timezone.utc)
    today_ist = now_ist().date()

    sample_entries = [
        {
            "name": "Ananya Verma",
            "email": "ananya@kaverikart.example.com",
            "phone": "+919845011223",
            "company": "KaveriKart Retail",
            "business_type": "E-commerce",
            "requirement": "Automate 500 daily customer support queries for order tracking and returns in English and Hindi.",
            "pain_points": ["High repetitive query volume", "Slow response times / missed leads"],
            "budget": "₹45,000",
            "budget_numeric": 45000.0,
            "business_size": "500 queries/day",
            "timeline": "This month",
            "buying_intent": "High",
            "sentiment": "Positive",
            "services": ["AI Chatbot Services", "CRM Automation"],
            "objections": [],
            "status": "Qualified",
            "days_ago": 3,
            "book_offset_days": 1,
            "book_time": "11:00",
            "appt_status": "Confirmed",
        },
        {
            "name": "Rohan Deshmukh",
            "email": "rohan@pulsehealth.example.com",
            "phone": "+919820044556",
            "company": "PulseCare Diagnostics",
            "business_type": "Healthcare",
            "requirement": "Autonomous AI voice agent to book diagnostic test appointments and handle patient FAQs.",
            "pain_points": ["Manual CRM / scheduling effort", "Slow response times / missed leads"],
            "budget": "₹50,000",
            "budget_numeric": 50000.0,
            "business_size": "3 clinics, 250 calls/day",
            "timeline": "Within 2 weeks",
            "buying_intent": "High",
            "sentiment": "Positive",
            "services": ["Voice Automation", "CRM Automation"],
            "objections": ["Data privacy / hosting concern"],
            "status": "Converted",
            "days_ago": 2,
            "book_offset_days": 2,
            "book_time": "15:00",
            "appt_status": "Confirmed",
        },
        {
            "name": "Vikram Mehta",
            "email": "vikram@nexacloud.example.com",
            "phone": "+919811177889",
            "company": "NexaCloud SaaS",
            "business_type": "SaaS / Technology",
            "requirement": "Inbound B2B lead qualification chatbot and discovery call booking.",
            "pain_points": ["Manual CRM / scheduling effort"],
            "budget": "₹20,000",
            "budget_numeric": 20000.0,
            "business_size": "18 employees",
            "timeline": "Next month",
            "buying_intent": "Medium",
            "sentiment": "Neutral",
            "services": ["AI Chatbot Services"],
            "objections": ["Pricing / Budget concern"],
            "status": "Contacted",
            "days_ago": 1,
            "book_offset_days": None,
            "book_time": None,
            "appt_status": None,
        },
        {
            "name": "Priya Nair",
            "email": "priya@skylinehomes.example.com",
            "phone": "+919895033441",
            "company": "Skyline Realty Group",
            "business_type": "Real Estate",
            "requirement": "Hindi and English voice assistant for site visit scheduling and brochure inquiries.",
            "pain_points": ["Slow response times / missed leads"],
            "budget": "₹40,000",
            "budget_numeric": 40000.0,
            "business_size": "120 inquiries/day",
            "timeline": "ASAP",
            "buying_intent": "High",
            "sentiment": "Positive",
            "services": ["Voice Automation", "AI Chatbot Services"],
            "objections": [],
            "status": "Qualified",
            "days_ago": 1,
            "book_offset_days": 1,
            "book_time": "16:00",
            "appt_status": "Confirmed",
        },
        {
            "name": "Kabir Malhotra",
            "email": "kabir@eduspark.example.com",
            "phone": "+919717099881",
            "company": "EduSpark Academy",
            "business_type": "EdTech / Education",
            "requirement": "Exploring student counseling chatbot, concerned about onboarding cost.",
            "pain_points": ["High repetitive query volume"],
            "budget": "₹8,000",
            "budget_numeric": 8000.0,
            "business_size": "60 queries/day",
            "timeline": "Next quarter",
            "buying_intent": "Low",
            "sentiment": "Negative",
            "services": ["AI Chatbot Services"],
            "objections": ["Pricing / Budget concern", "Needs internal stakeholder approval"],
            "status": "Unqualified",
            "days_ago": 0,
            "book_offset_days": None,
            "book_time": None,
            "appt_status": None,
        },
    ]

    created_leads = 0
    created_appts = 0

    for idx, item in enumerate(sample_entries, start=1):
        ctx = {
            "customer_name": item["name"],
            "customer_email": item["email"],
            "customer_phone": item["phone"],
            "company": item["company"],
            "business_type": item["business_type"],
            "requirement": item["requirement"],
            "pain_points": item["pain_points"],
            "budget": item["budget"],
            "budget_numeric_inr": item["budget_numeric"],
            "business_size": item["business_size"],
            "timeline": item["timeline"],
            "buying_intent": item["buying_intent"],
            "services_discussed": item["services"],
            "objections": item["objections"],
        }
        has_appt = item["book_offset_days"] is not None
        score_res = calculate_lead_score(ctx, message_count=6, has_appointment=has_appt)
        created_ts = now - timedelta(days=item["days_ago"], hours=idx)

        lead = Lead(
            name=item["name"],
            email=item["email"],
            phone=item["phone"],
            company=item["company"],
            business_type=item["business_type"],
            requirement=item["requirement"],
            pain_points=", ".join(item["pain_points"]),
            budget=item["budget"],
            budget_numeric=item["budget_numeric"],
            business_size=item["business_size"],
            timeline=item["timeline"],
            buying_intent=item["buying_intent"],
            sentiment=item["sentiment"],
            lead_score=score_res["total_score"],
            score_category=score_res["category"],
            score_breakdown_json=json.dumps(score_res),
            status=item["status"],
            source="Demo Sample (AI Voice Agent)",
            services_interested=json.dumps(item["services"]),
            objections=json.dumps(item["objections"]),
            created_at=created_ts,
            updated_at=created_ts,
        )
        db.add(lead)
        db.flush()
        created_leads += 1

        conv_id = f"demo-session-{idx:03d}"
        appt_status_str = "Not Scheduled"
        if has_appt and item["book_offset_days"] is not None:
            sched_date = (today_ist + timedelta(days=item["book_offset_days"])).strftime("%Y-%m-%d")
            code = f"APT-{sched_date.replace('-', '')}-D{idx:02d}"
            appt = Appointment(
                appointment_code=code,
                lead_id=lead.id,
                conversation_id=conv_id,
                customer_name=item["name"],
                customer_email=item["email"],
                customer_phone=item["phone"],
                company=item["company"],
                service_topic=", ".join(item["services"]),
                resource_name="Sales Specialist",
                scheduled_date=sched_date,
                scheduled_time=item["book_time"],
                duration_minutes=30,
                timezone="Asia/Kolkata",
                status=item["appt_status"],
                confirmed_by_customer=True,
                notes=item["requirement"],
                created_at=created_ts,
                updated_at=created_ts,
            )
            db.add(appt)
            created_appts += 1
            appt_status_str = f"Confirmed ({code} on {sched_date} at {item['book_time']} IST)"

        summary = {
            "customer_name": item["name"],
            "company": item["company"],
            "business_type": item["business_type"],
            "main_requirement": item["requirement"],
            "pain_points": item["pain_points"],
            "budget": item["budget"],
            "sentiment": item["sentiment"],
            "buying_intent": item["buying_intent"],
            "services_discussed": item["services"],
            "objections": item["objections"],
            "lead_score": score_res["total_score"],
            "qualification_status": item["status"],
            "recommended_next_action": "Conduct scheduled discovery call" if has_appt else "Follow up with tailored proposal",
            "appointment_status": appt_status_str,
        }
        lead.summary_json = json.dumps(summary)

        conv = Conversation(
            id=conv_id,
            lead_id=lead.id,
            language="en",
            channel="voice",
            status="completed",
            structured_summary_json=json.dumps(summary),
            extracted_context_json=json.dumps(ctx),
            message_count=2,
            created_at=created_ts,
            updated_at=created_ts,
        )
        db.add(conv)
        db.flush()

        db.add(
            Message(
                conversation_id=conv.id,
                role="user",
                content=f"Hi, I'm {item['name']} from {item['company']}. {item['requirement']} Our monthly budget is around {item['budget']}.",
                language="en",
                sentiment=item["sentiment"],
                created_at=created_ts,
            )
        )
        db.add(
            Message(
                conversation_id=conv.id,
                role="assistant",
                content=f"Welcome {item['name']}! Based on your {item['business_type']} workflow and {item['budget']} budget, VoxLead Solutions can automate this effectively.",
                language="en",
                created_at=created_ts,
            )
        )

    db.commit()
    return {
        "seeded": True,
        "leads_created": created_leads,
        "appointments_created": created_appts,
        "message": "Demo sample CRM records seeded successfully.",
    }
