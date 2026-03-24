# InterviewPrep AI

An AI-powered interview preparation agent that analyzes job postings, generates stage-specific questions, drafts personalized answer frameworks, and runs interactive role-play practice sessions with real-time feedback.

## Architecture

```
┌──────────────────┐       ┌─────────────────────────────────────────┐
│  React + Vite    │       │  FastAPI Backend                        │
│  (Frontend)      │──────▶│                                         │
│                  │  API  │  ┌─────────────────────────────────┐    │
│  • New Session   │       │  │  LangGraph Agent                │    │
│  • Prep Detail   │       │  │                                 │    │
│  • Role-Play Chat│       │  │  parse → analyze → generate ──┐ │    │
│                  │       │  │                      ↓        ↓ │    │
│                  │       │  │              roleplay_ask   draft│    │
│                  │       │  │                ↕               │ │    │
│                  │       │  │             evaluate           │ │    │
│                  │       │  │                ↓               │ │    │
│                  │       │  │             summary ←──────────┘ │    │
│                  │       │  │                                 │    │
│                  │       │  │  [MemorySaver Checkpointer]     │    │
│                  │       │  └─────────────────────────────────┘    │
└──────────────────┘       └─────────────────────────────────────────┘
```

### Tech Stack

- **Agent Framework**: LangGraph (state machine) + LangChain (tools, LLM interface)
- **LLM**: OpenAI GPT-4o-mini
- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **State**: LangGraph MemorySaver (in-memory, swappable to SQLite)
- **Data Models**: Pydantic v2

### Why LangGraph?

The interview prep flow is naturally a **state machine**, not a simple chain:

1. **Conditional branching**: After generating questions, the agent routes to either "prep mode" (draft answers) or "role-play mode" (interactive practice) based on user choice.
2. **Human-in-the-loop**: Role-play requires the agent to pause, wait for the user's answer, evaluate it, then decide whether to ask the next question or finish. LangGraph's `interrupt_before` handles this natively.
3. **Checkpointed state**: Every step is persisted, so sessions can be resumed.

A simple ReAct agent loop (LangChain AgentExecutor) would not support pausing for user input or explicit flow control.

## Modes

### Prep Mode
Paste a job description → get role analysis, tailored questions, and personalized answer frameworks with STAR method guidance.

### Role-Play Mode
Practice answering interview questions interactively. The agent acts as an interviewer, asks questions naturally, then evaluates your answers with a score (1-10), specific feedback, and an improved answer suggestion.

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- OpenAI API key

### Quick Start (from scratch)

**1. Clone and enter the repo:**
```bash
git clone https://github.com/Adam-Makaoui/interview-prep-ai.git
cd interview-prep-ai
```

**2. Backend (Terminal 1):**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
Edit `backend/.env` and set your OpenAI API key:
```
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
# Optional: faster/cheaper model for JD auto-fill only (defaults to OPENAI_MODEL)
# OPENAI_EXTRACT_MODEL=gpt-4o-mini
```
Then start the server:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

**3. Frontend (Terminal 2):**
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

**4. Open http://localhost:5173**

### Restarting (already set up)

If you've already done the setup above and just need to restart:

```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/sessions/stream` | Create session with SSE progress (primary) |
| POST | `/api/sessions` | Create session (blocking, fallback) |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/{id}` | Get session state |
| POST | `/api/sessions/{id}/answer` | Submit role-play answer |
| POST | `/api/sessions/{id}/continue` | Advance past feedback pause |
| POST | `/api/sessions/{id}/finish` | End roleplay early, jump to summary |
| POST | `/api/sessions/{id}/start-roleplay` | Switch prep session to role-play |
| POST | `/api/extract-fields` | Auto-fill form from JD text or URL |
| POST | `/api/lookup-interviewer` | Web search for interviewer title |
| POST | `/api/parse-resume` | Extract text from PDF/DOCX/TXT upload |
| GET | `/api/profile/resume` | Get saved resume |
| PUT | `/api/profile/resume` | Save/update resume |

## Roadmap (Post-MVP)

### Phase 2 -- Production & Intelligence
1. **Persistent storage**: Swap `MemorySaver` to `SQLiteSaver`/PostgreSQL for session persistence across server restarts
2. **Candidate profile / "Mastermind" avatar**: Persistent profile that tracks strengths, weaknesses, and patterns across all interview sessions. Learns what question types the user struggles with, which examples they overuse, and generates increasingly targeted practice
3. **Cross-session analytics**: Dashboard showing improvement trends, recurring weak areas, and readiness scores per interview type
4. **Interview outcome tracking**: See **Interview outcome entity (draft)** below — record pass/fail and free-text debrief per real round to drive future prep (e.g. “failed technical demo on AI vertical”)
5. **Auto-enrichment**: Web search for company culture, Glassdoor reviews, and recent news to enrich prep context

### Phase 3 -- Monetization & Distribution
6. **Auth + subscriptions**: Clerk + Stripe for multi-user support and tiered pricing (Free: 3 sessions, Pro: unlimited + role-play + history)
7. **Chrome extension**: Side panel that detects job postings and triggers prep directly from LinkedIn, Greenhouse, etc.
8. **Production deploy**: Vercel (frontend) + Railway (backend)
9. **Multi-modal input**: Screenshot (GPT-4o vision) for quick JD capture from any source

### Interview outcome entity (draft — Phase 3)

Planned persistence (not implemented in the demo MVP) to close the loop after real interviews:

| Field | Purpose |
|-------|---------|
| `session_id` / `pipeline_group` | Link to prep context |
| `company`, `round_stage` | Which interview this was |
| `result` | pass / fail / withdrew / unknown |
| `debrief_notes` | What went wrong/right (e.g. weak on industry vertical) |
| `tags` | e.g. `["vertical:AI", "format:live-coding"]` |

Future: feed `debrief_notes` + tags into the next session’s `analyze_role` / question generation for targeted remediation.

## Presentation Talking Points

### The Problem
Interview preparation is fragmented and generic. Candidates waste hours googling "common interview questions" instead of practicing with tailored, stage-specific questions based on the actual job description.

### The Agent Architecture
LangGraph state machine with 7 nodes, conditional branching, and human-in-the-loop. Each node uses LangChain's ChatOpenAI with structured JSON output. State is checkpointed for session resumability.

### Why Agentic?
This is not a simple prompt → response. The agent:
- **Reasons about context**: Uses role analysis to inform question generation
- **Makes decisions**: Routes between prep and role-play modes
- **Interacts iteratively**: Pauses for user input during role-play
- **Synthesizes across steps**: Aggregates feedback into a readiness scorecard

### Scaling & Productization
- API-first design: Chrome extension, mobile app, or Slack bot can share the same backend
- Checkpointed state: Swap MemorySaver → PostgreSQL for production persistence
- Subscription tiers: Free (3 sessions) → Pro (unlimited + role-play + history)
