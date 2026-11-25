# VoxLead AI — Technical Project Report

**Project Title:** VoxLead AI – Autonomous AI Sales Voice Agent  
**Organization Context:** Technical Challenge & Architecture Submission for Fortivex AI Private Limited  
**Fictional Demo Company:** VoxLead Solutions Pvt. Ltd. *(sample business data)*

---

## 1. Problem Statement
Small and mid-sized businesses receive hundreds of repetitive inbound customer inquiries daily across support, pricing, and product discovery. Sales teams spend excessive manual time answering routine questions, qualifying prospects, logging notes into CRMs, and coordinating meeting times—resulting in slow response times, inconsistent lead qualification, and missed revenue opportunities.

## 2. Proposed Solution
**VoxLead AI** is a full-stack autonomous AI sales voice and chat agent powered entirely by a local open-weight LLM (`qwen2.5:3b`) running inside Docker, paired with a local FAISS Retrieval-Augmented Generation (RAG) pipeline, contextual conversation memory, transparent rule-based lead scoring, conflict-free appointment scheduling, and a commercial-grade React CRM dashboard.

## 3. Technology Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, Browser `SpeechRecognition` & `SpeechSynthesis` (with full text fallback).
- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic v2, HTTPX.
- **Local LLM & Runtime:** Docker + Docker Compose (`ollama/ollama:latest`), `qwen2.5:3b` persisted in a named Docker volume (`voxlead_ollama_data`).
- **RAG & Embeddings:** `sentence-transformers/all-MiniLM-L6-v2` + `faiss-cpu` (`IndexFlatIP`).
- **Database:** SQLite + SQLAlchemy ORM (`leads`, `conversations`, `messages`, `appointments`, `knowledge_documents`, `app_settings`).
- **Testing:** Pytest (automated API, RAG, memory, scoring, and booking validation).

## 4. System Architecture & Key Implementation
1. **Containerized Local LLM:** Ollama runs in an isolated Linux container (`voxlead-ollama` on port `11434`) with model weights persisted in `voxlead_ollama_data`. FastAPI reuses an asynchronous HTTPX connection pool against `http://localhost:11434`.
2. **Local RAG Pipeline:** Documents (`.pdf`, `.docx`, `.txt`, or manual text) undergo text extraction, cleaning, overlapping chunking (600 chars / 90 overlap), embedding via `all-MiniLM-L6-v2`, and local FAISS persistence. Deletions trigger full index rebuilds so stale content is immediately excluded.
3. **Contextual Memory & Agentic Routing:** Each session maintains an isolated UUID, sliding message window (10 turns), rolling compact summary, and persisted entity context in SQLite. Controlled Python tools handle knowledge lookup, lead extraction, and appointment booking—preventing arbitrary LLM code/SQL execution.
4. **Transparent Lead Qualification & Sentiment:** Combines sentiment classification (`Positive`, `Neutral`, `Negative`) and objection tagging with a deterministic 100-point rubric (Requirement clarity 20, Budget readiness 20, Buying intent 25, Business need 15, Timeline 10, Engagement 10). Positive tone alone never auto-qualifies a lead.
5. **Appointment Engine (IST):** Enforces `Asia/Kolkata` validation, rejects past slots, prevents overlapping bookings per specialist resource, requires explicit customer confirmation, and only confirms after SQLite persistence.

## 5. Business Benefits & Commercial Feasibility
- **Zero Per-Token Cloud LLM Fees:** Local Qwen 2.5 3B eliminates recurring OpenAI/Gemini API token bills and keeps customer transcripts off third-party LLM servers.
- **Faster Lead Response & Conversion:** Sub-minute qualification, bilingual English/Hindi support, and instant slot confirmation capture high-intent buyers 24/7.
- **Auditability & CRM Hygiene:** Automated 14-field structured call summaries and scored lead records eliminate manual CRM entry.

## 6. Scalability & Future Scope
While the local MVP runs SQLite and single-node Docker Ollama for MacBook-class demonstration, the architecture cleanly scales to 100,000+ registered users via stateless FastAPI replicas behind a load balancer, PostgreSQL + connection pooling, Redis distributed session caching, managed vector databases (Qdrant/pgvector), Kafka/RabbitMQ async summarization queues, dedicated GPU vLLM/Ollama inference clusters, and WebRTC/SIP telephony gateways. Future enhancements include local Whisper STT for fully offline voice recognition and bi-directional external calendar/CRM sync.
