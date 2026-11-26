# VoxLead AI — One-Page Project Report

## 1. Project Title
**VoxLead AI – Autonomous AI Sales Voice Agent**  
*Developed for the Advanced AI Project Challenge & Technical Discussion at Fortivex AI Private Limited | Fictional Demo Company: VoxLead Solutions Pvt. Ltd. (sample business data)*

## 2. Problem Statement
Growing businesses lose qualified leads when inbound inquiries arrive after hours or overwhelm sales teams with repetitive questions about pricing, order status, and scheduling. Manual call logging leads to inconsistent CRM data, missed follow-ups, and slow conversion cycles, while cloud LLM APIs introduce recurring per-token costs and third-party data privacy concerns.

## 3. Proposed Solution
**VoxLead AI** is a full-stack autonomous AI sales voice and chat agent powered by a containerized local LLM (`qwen2.5:3b` via Docker Ollama), local FAISS Retrieval-Augmented Generation (RAG), SQLite contextual memory, deterministic lead scoring, conflict-free `Asia/Kolkata` appointment booking, and a real-time React CRM dashboard—with zero paid cloud LLM APIs.

## 4. Technology Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS v4, Lucide React, Recharts, Web Speech API (`SpeechRecognition` & `SpeechSynthesis` with text fallback).
- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic v2, HTTPX.
- **AI & RAG:** Dockerized Ollama (`ollama/ollama:latest`, `qwen2.5:3b` on persistent volume), `sentence-transformers/all-MiniLM-L6-v2`, `faiss-cpu` (`IndexFlatIP`), `pypdf`, `python-docx`.
- **Database & Testing:** SQLite (WAL mode + foreign keys) + SQLAlchemy 2.0 ORM, Pytest.

## 5. System Architecture
```text
Customer (Voice / Text) ─► React + TypeScript UI (localhost:5173)
                                  │ REST API
                                  ▼
FastAPI Backend (localhost:8000/8010) ──► FAISS CPU + MiniLM + SQLite CRM
                                  │ HTTP API (keep_alive + HTTPX pool)
                                  ▼
Docker Container: voxlead-ollama (qwen2.5:3b) ──► Volume: voxlead_ollama_data
```

## 6. Implementation
FastAPI orchestrates each turn through modular services (`app/services/*`): persistent UUID session memory (10-turn sliding window + rolling compact summary), boundary-aware RAG chunking (600 chars, 90 overlap, top-4 retrieval), deterministic NLP entity & sentiment extraction, and controlled Python booking tools (the LLM never executes raw SQL or code). All 12 `pytest` tests (including live Docker `qwen2.5:3b` end-to-end verification) pass.

## 7. Main Features
- Bilingual **English & Hindi** voice/text interaction with live transcript and TTS playback.
- Grounded **RAG Knowledge Base** supporting `.pdf`, `.docx`, `.txt`, and manual entries with source citations and index rebuild on delete.
- **Transparent 100-Point Lead Scoring** (Requirement 20, Budget 20, Buying Intent 25, Need 15, Timeline 10, Engagement 10)—positive sentiment alone never auto-qualifies.
- **IST Appointment Engine** preventing past-date and overlapping bookings and requiring explicit confirmation before DB persistence.
- **14-Field AI Call Summaries**, full CRM CRUD, and **database-driven Recharts Analytics**.

## 8. Business Benefits
Cuts Level-1 sales/support workload, captures and qualifies leads 24/7, eliminates manual CRM entry, and ensures consistent pricing/policy answers backed by verified company documents.

## 9. Commercial Feasibility
Self-hosting `qwen2.5:3b` removes per-token LLM fees. A single shared GPU inference node (e.g., L4 running vLLM) plus managed PostgreSQL/Redis serves thousands of daily conversations at predictable fixed cost (< \$0.003/conversation), delivering strong SaaS margins (e.g., Growth Plan at ₹44,999/month).

## 10. Scalability
To scale from the local MVP to **100,000 registered users** (~1,000–2,000 concurrent active sessions): serve React via CDN, run stateless FastAPI pods behind an L7 load balancer, move hot memory and distributed slot locks to Redis, migrate SQLite to PostgreSQL + PgBouncer + read replicas, deploy Qdrant/pgvector, process summaries asynchronously via Kafka/RabbitMQ, and scale GPU vLLM inference with WebRTC/SIP telephony and Prometheus/Grafana monitoring.

## 11. Future Scope
Integrate local Whisper STT for 100% offline voice recognition, sentence-streaming TTS for sub-second voice latency, WhatsApp Business API / PSTN telephony connectors, and bi-directional sync with Google Calendar, HubSpot, and Zoho CRM.
