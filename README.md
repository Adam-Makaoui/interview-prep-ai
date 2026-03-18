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

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your OPENAI_API_KEY
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/sessions` | Create a new prep session |
| GET | `/api/sessions/{id}` | Get session state |
| POST | `/api/sessions/{id}/answer` | Submit role-play answer |

## Roadmap (Post-MVP)

1. **Multi-modal input**: Screenshot (GPT-4o vision), URL scraping, PDF upload
2. **Auto-enrichment**: Web search for company culture, interview reviews
3. **Resume profiles**: Upload once, reuse across sessions
4. **Auth + subscriptions**: Clerk + Stripe for monetization
5. **Chrome extension**: Side panel that detects job postings and triggers prep
6. **Production deploy**: Vercel (frontend) + Railway (backend)

## DataRobot Presentation Notes

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
