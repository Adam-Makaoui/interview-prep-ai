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
│                  │       │  │  [PostgresSaver / MemorySaver]   │    │
│                  │       │  └─────────────────────────────────┘    │
└──────────────────┘       └─────────────────────────────────────────┘
```

### Tech Stack

- **Agent Framework**: LangGraph (state machine) + LangChain (tools, LLM interface)
- **LLM**: OpenAI GPT-4o-mini
- **Backend**: FastAPI (Python)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **State**: LangGraph PostgresSaver (Supabase) with MemorySaver fallback for local dev
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
```
For the full technical architecture, env var reference, deploy guide, and go-live checklist, see [`ARCHITECTURE.md`](ARCHITECTURE.md).
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

## Roadmap

Full roadmap lives in Notion. High-level priorities:

- **Cross-session analytics** — improvement trends, recurring weak areas, readiness scores
- **Interview outcome tracking** — record pass/fail + debrief per real round to drive future prep
- **Stripe billing** — tiered pricing (Free: 1 session, Pro: unlimited + roleplay + history)
- **Chrome extension** — side panel that detects JDs on LinkedIn/Greenhouse and triggers prep
- **Auto-enrichment** — web search for company culture, Glassdoor reviews, recent news
