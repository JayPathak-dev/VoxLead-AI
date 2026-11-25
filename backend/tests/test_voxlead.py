"""Comprehensive pytest suite for VoxLead AI backend, RAG, memory, scoring, booking, and Ollama integration."""

from datetime import timedelta
import os
from pathlib import Path
import sys
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Appointment, Conversation, KnowledgeDocument, Lead
from app.services import booking_service, lead_service, scoring_service, sentiment_service
from app.services.rag_service import rag_service
from app.services.ollama_service import OllamaError, ollama_service
from app.utils.validators import now_ist


@pytest.fixture(autouse=True)
def clean_db_between_tests():
    """Ensure clean SQLite tables for deterministic unit/integration tests while keeping KB synced."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.query(Appointment).delete()
        db.query(Conversation).delete()
        db.query(Lead).delete()
        db.commit()
    finally:
        db.close()
    yield


def test_01_health_endpoint_starts():
    with TestClient(app) as client:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["backend_status"] == "ok"
        assert data["database_status"] == "connected"
        assert data["model_name"] == "qwen2.5:3b"


def test_02_rag_indexing_and_retrieval():
    with TestClient(app) as client:
        docs_resp = client.get("/api/knowledge")
        assert docs_resp.status_code == 200
        docs = docs_resp.json()
        assert len(docs) >= 4
        assert any(d["original_filename"] == "pricing.txt" and d["chunk_count"] > 0 for d in docs)

        hits = rag_service.search("What is the Growth Plan monthly pricing in INR?")
        assert len(hits) > 0
        assert any("pricing.txt" in h["filename"] for h in hits)
        assert any("44,999" in h["snippet"] for h in hits)


def test_03_rag_upload_and_delete_removes_from_retrieval():
    with TestClient(app) as client:
        add_resp = client.post(
            "/api/knowledge/text",
            json={
                "title": "Xylophone Secret Addon",
                "content": "VoxLead Solutions offers a specialized Xylophone Quantum Connector exclusively for orbital logistics clients at ₹12,345 per month.",
            },
        )
        assert add_resp.status_code == 201
        doc_id = add_resp.json()["id"]

        hits_before = rag_service.search("Xylophone Quantum Connector orbital logistics")
        assert any("Xylophone" in h["snippet"] for h in hits_before)

        del_resp = client.delete(f"/api/knowledge/{doc_id}")
        assert del_resp.status_code == 200

        hits_after = rag_service.search("Xylophone Quantum Connector orbital logistics")
        assert not any("Xylophone Quantum Connector" in h["snippet"] for h in hits_after)


def test_04_missing_knowledge_base_handled_gracefully():
    original_index = rag_service._index
    original_chunks = rag_service._chunks
    try:
        rag_service._index = None
        rag_service._chunks = []
        hits = rag_service.search("What are your pricing plans?")
        assert hits == []
    finally:
        rag_service._index = original_index
        rag_service._chunks = original_chunks


def test_05_lead_extraction_and_scoring_rubric():
    ctx = {}
    ctx = lead_service.merge_context(
        ctx,
        lead_service.extract_entities_from_message(
            "Hi, my name is Aarav Mehta from OrbitMart. We run an e-commerce store with 500 queries per day and want an AI chatbot for order tracking and returns. Our budget is ₹40,000 per month and we want to launch this month.",
            ctx,
        ),
    )
    assert ctx["customer_name"] == "Aarav Mehta"
    assert ctx["company"] == "OrbitMart"
    assert ctx["business_type"] == "E-commerce"
    assert ctx["budget"] == "₹40,000"
    assert ctx["budget_numeric_inr"] == 40000.0
    assert ctx["buying_intent"] == "High"

    score = scoring_service.calculate_lead_score(ctx, message_count=6, has_appointment=False)
    assert score["total_score"] >= 70
    assert score["category"] == "High potential"
    assert score["qualified"] is True
    assert len(score["criteria"]) == 6


def test_06_positive_sentiment_does_not_auto_qualify():
    sentiment, _reason, _obj = sentiment_service.analyze_sentiment("That sounds awesome and wonderful, thank you!")
    assert sentiment == "Positive"

    # Empty requirement / budget / intent should NOT qualify just because sentiment is Positive
    score = scoring_service.calculate_lead_score({"sentiment": "Positive"}, message_count=2, has_appointment=False)
    assert score["qualified"] is False
    assert score["total_score"] < 40


def test_07_negative_sentiment_and_objection_extraction():
    sentiment, _reason, objections = sentiment_service.analyze_sentiment(
        "This is too expensive and our budget is tight, not interested right now."
    )
    assert sentiment == "Negative"
    assert "Pricing / Budget concern" in objections


def test_08_appointment_availability_past_rejection_and_double_booking():
    with TestClient(app) as client:
        tomorrow = (now_ist().date() + timedelta(days=1)).strftime("%Y-%m-%d")
        yesterday = (now_ist().date() - timedelta(days=1)).strftime("%Y-%m-%d")

        # Past date rejected
        past_resp = client.post(
            "/api/appointments",
            json={
                "customer_name": "Test User",
                "scheduled_date": yesterday,
                "scheduled_time": "11:00",
                "confirmed_by_customer": True,
            },
        )
        assert past_resp.status_code == 400

        # Missing explicit confirmation rejected
        unconf_resp = client.post(
            "/api/appointments",
            json={
                "customer_name": "Test User",
                "scheduled_date": tomorrow,
                "scheduled_time": "11:00",
                "confirmed_by_customer": False,
            },
        )
        assert unconf_resp.status_code == 400

        # Valid booking succeeds
        ok_resp = client.post(
            "/api/appointments",
            json={
                "customer_name": "Aarav Mehta",
                "customer_email": "aarav@orbitmart.example.com",
                "scheduled_date": tomorrow,
                "scheduled_time": "11:00",
                "duration_minutes": 30,
                "confirmed_by_customer": True,
            },
        )
        assert ok_resp.status_code == 201
        created = ok_resp.json()
        assert created["appointment_code"].startswith("APT-")
        assert created["timezone"] == "Asia/Kolkata"

        # Double booking same slot prevented
        dup_resp = client.post(
            "/api/appointments",
            json={
                "customer_name": "Second User",
                "scheduled_date": tomorrow,
                "scheduled_time": "11:00",
                "duration_minutes": 30,
                "confirmed_by_customer": True,
            },
        )
        assert dup_resp.status_code == 400
        assert "already booked" in dup_resp.json()["detail"].lower()

        # Overlapping slot (11:15) also prevented
        overlap_resp = client.post(
            "/api/appointments",
            json={
                "customer_name": "Third User",
                "scheduled_date": tomorrow,
                "scheduled_time": "11:15",
                "duration_minutes": 30,
                "confirmed_by_customer": True,
            },
        )
        assert overlap_resp.status_code == 400

        # Available slots exclude 11:00
        slots_resp = client.get(f"/api/appointments/slots/available?date={tomorrow}")
        assert slots_resp.status_code == 200
        times = [s["time"] for s in slots_resp.json()["slots"]]
        assert "11:00" not in times


def test_09_contextual_memory_and_session_isolation_with_mocked_llm():
    with TestClient(app) as client:
        with patch.object(
            ollama_service,
            "chat",
            new=AsyncMock(return_value={"content": "Got it, your ₹40,000 budget is noted!", "latency_ms": 42}),
        ):
            r1 = client.post(
                "/api/chat",
                json={
                    "message": "Hi, my name is Neha Kapoor from FinEdge and my budget is ₹40,000 per month for an AI chatbot.",
                    "language": "en",
                    "channel": "text",
                },
            )
            assert r1.status_code == 200
            d1 = r1.json()
            sid1 = d1["session_id"]
            assert d1["intelligence"]["budget"] == "₹40,000"
            assert d1["intelligence"]["customer_name"] == "Neha Kapoor"

            # Follow-up in same session recalls persisted budget
            r2 = client.post(
                "/api/chat",
                json={
                    "session_id": sid1,
                    "message": "What budget did I mention earlier?",
                    "language": "en",
                    "channel": "text",
                },
            )
            assert r2.status_code == 200
            assert r2.json()["intelligence"]["budget"] == "₹40,000"

            # Separate session is isolated
            r3 = client.post(
                "/api/chat",
                json={
                    "message": "Hello, I run a dental clinic.",
                    "language": "en",
                    "channel": "text",
                },
            )
            assert r3.status_code == 200
            d3 = r3.json()
            assert d3["session_id"] != sid1
            assert d3["intelligence"]["budget"] is None


def test_10_missing_ollama_model_handled_gracefully():
    with TestClient(app) as client:
        with patch.object(
            ollama_service,
            "chat",
            new=AsyncMock(side_effect=OllamaError("Model 'qwen2.5:3b' is not installed in Ollama.", code="model_missing")),
        ):
            resp = client.post(
                "/api/chat",
                json={"message": "Hello, tell me about VoxLead AI.", "channel": "text"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["ollama_used"] is False
            assert "not installed" in data["error"]


def test_11_summary_crm_and_analytics_real_data():
    with TestClient(app) as client:
        with patch.object(
            ollama_service,
            "chat",
            new=AsyncMock(return_value={"content": "Sure, I have confirmed your slot!", "latency_ms": 50}),
        ):
            tomorrow = (now_ist().date() + timedelta(days=1)).strftime("%Y-%m-%d")
            r1 = client.post(
                "/api/chat",
                json={
                    "message": f"I'm Siddharth Rao from SwiftShip Logistics. We need voice automation for 300 calls/day, budget ₹45,000, timeline this month. Please confirm {tomorrow} at 14:00.",
                    "channel": "text",
                },
            )
            assert r1.status_code == 200
            d1 = r1.json()
            sid = d1["session_id"]
            assert d1["intelligence"]["appointment_status"] == "Confirmed"
            assert d1["intelligence"]["lead_score"] >= 70

            # Generate structured summary
            sum_resp = client.post(f"/api/conversations/{sid}/summary")
            assert sum_resp.status_code == 200
            summary = sum_resp.json()["summary"]
            assert summary["customer_name"] == "Siddharth Rao"
            assert "Confirmed" in summary["appointment_status"]

            # Analytics reflects real DB records
            ov = client.get("/api/analytics/overview").json()
            assert ov["total_leads"] == 1
            assert ov["qualified_leads"] == 1
            assert ov["appointments_booked"] == 1
            assert ov["total_conversations"] == 1


@pytest.mark.skipif(
    os.getenv("RUN_LIVE_OLLAMA_TESTS", "0") != "1",
    reason="Set RUN_LIVE_OLLAMA_TESTS=1 to run live Docker Ollama + Qwen 2.5 3B inference tests.",
)
def test_12_live_docker_ollama_and_end_to_end_qwen():
    with TestClient(app) as client:
        health = client.get("/api/health").json()
        assert health["ollama_status"] == "connected"
        assert health["model_available"] is True

        # Turn 1: E-commerce inquiry + budget
        r1 = client.post(
            "/api/chat",
            json={
                "message": "Hi, my name is Arjun Verma from CartPulse. We run an e-commerce store with 500 daily customer queries about order tracking and returns. Our monthly budget is ₹40,000.",
                "language": "en",
                "channel": "voice",
            },
        )
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["ollama_used"] is True
        assert len(d1["reply"]) > 15
        sid = d1["session_id"]

        # Turn 2: Recall memory
        r2 = client.post(
            "/api/chat",
            json={
                "session_id": sid,
                "message": "What monthly budget did I mention earlier?",
                "language": "en",
                "channel": "voice",
            },
        )
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["ollama_used"] is True
        assert "40" in d2["reply"]

        # Turn 3: Confirm appointment
        tomorrow = (now_ist().date() + timedelta(days=1)).strftime("%Y-%m-%d")
        r3 = client.post(
            "/api/chat",
            json={
                "session_id": sid,
                "message": f"Yes, please confirm a discovery call for {tomorrow} at 15:00.",
                "language": "en",
                "channel": "voice",
            },
        )
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["ollama_used"] is True
        assert d3["intelligence"]["appointment_status"] == "Confirmed"
        assert d3["intelligence"]["appointment_details"]["appointment_code"].startswith("APT-")
