# InterviewIntel

> Production: [interviewintel.ai](https://interviewintel.ai) · Staging: staging.interviewintel.ai

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
- **LLM**: OpenAI GPT-5.4 nano (default; override via `OPENAI_MODEL`)
- **Backend**: FastAPI (Python)
- **Frontend**: React 19 + Vite 8 + TypeScript + **Tailwind CSS v4** (`@tailwindcss/vite`) + **shadcn/ui** (radix-nova style: Radix primitives via unified `radix-ui` package, Lucide icons, `class-variance-authority`, `tw-animate-css`). Product shell uses generated components under `frontend/src/components/ui` and semantic color tokens in `frontend/src/index.css` (default **dark** theme via `.dark` on `<html>`, optional light via Settings / `theme.tsx`).
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
OPENAI_MODEL=gpt-5.4-nano
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
Use **`--legacy-peer-deps`** here because `@tailwindcss/vite@4` currently declares a Vite peer range that does not yet include Vite 8; installs still work for this project.

Optional (local machine only, not required for the app to run): **`npx shadcn@latest mcp init --client claude`** wires the shadcn MCP server for AI-assisted component lookup—it does not change the built UI.

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
| DELETE | `/api/sessions/{id}` | Delete session + checkpoints |
| POST | `/api/sessions/{id}/answer` | Submit role-play answer |
| POST | `/api/sessions/{id}/continue` | Advance past feedback pause |
| POST | `/api/sessions/{id}/finish` | End roleplay early, jump to summary |
| POST | `/api/sessions/{id}/start-roleplay` | Switch prep session to role-play |
| POST | `/api/extract-fields` | Auto-fill form from JD text or URL |
| POST | `/api/lookup-interviewer` | Web search for interviewer title |
| POST | `/api/parse-resume` | Extract text from PDF/DOCX/TXT upload |
| GET | `/api/profile/resume` | Get saved resume |
| PUT | `/api/profile/resume` | Save/update resume |
| GET | `/api/profile/me` | Current user profile + daily usage |
| GET | `/api/profile/progress` | Cross-session aggregated scores |

## Roadmap

Detailed roadmap lives in Notion. Recently shipped and upcoming priorities:

### Shipped

- **App Shell + Sidebar** — persistent navigation with plan usage indicator (Phase 1a)
- **Session Deletion** — delete sessions from dashboard and detail views (Phase 1b)
- **Progress Tracking** — final_scores JSONB column, aggregation API, and My Progress page with competency bars and score trend charts (Phase 2)
- **Daily Free Tier** — 2 free sessions/day with upgrade prompt (monetization foundation)
- **Landing Page Redesign** — hero with gradient glow, how-it-works steps with Framer Motion, sample session mockups, social proof testimonials, pricing comparison, and footer with scroll-driven background gradient
- **Dark-first UI + theme toggle** — default dark surfaces; light mode via Settings (class on `<html>`, persisted in `localStorage`). Marketing landing keeps richer motion; authenticated app uses flatter, shadcn-based controls.
- **shadcn/ui (product shell)** — shared primitives (`Button`, `Card`, `Input`, `DropdownMenu`, `Separator`, etc.) in `src/components/ui`; `@/*` import alias in `tsconfig` and Vite
- **Auto-Expanding Textarea** — role-play input replaced with auto-growing textarea (up to 6 lines) with Shift+Enter for newlines
- **Voice Input** — Web Speech API microphone button in role-play chat for speech-to-text transcription
- **Demo Session** — static DummyCompany session for new users to explore the app before creating their own prep
- **Analysis Tab Redesign** — company overview with industry/products/problem, competitor logos via favicon API, numbered interview tips with accent borders
- **Settings Page** — subscription UI, contact support, appearance (light/dark), saved resumes, AI model picker
- **Live Progress Updates** — running_scores persisted after each Q&A round so My Progress updates mid-session
- **Session List Optimization** — cached metadata columns (status, question_count) eliminate N checkpoint loads on list endpoint
- **Settings: AI model** — choose among GPT-5.4 nano, GPT-4o mini (both free), or GPT-5.4 mini (Pro); preference on profile drives LangGraph nodes; extract-fields still uses server `OPENAI_EXTRACT_MODEL` / default

### Backlog

- **Monetization: model tiers** — enforce Pro-only models server-side (done for mini), bundle stronger defaults + limits with Stripe checkout; reflect in pricing copy
- **UI Polish** — loading skeletons, error states with retry, transitions, meta/OG tags
- **Google OAuth** — reduce sign-in friction via Supabase Google provider (~15 lines frontend)
- **LangSmith Observability** — tracing all LLM calls (free tier: 5k traces/month, zero code changes)
- **Custom Domain + Stripe** — purchase domain, configure DNS for Vercel/Railway, wire Stripe checkout for Pro plan
- **Chrome Extension** — side panel that detects JDs on LinkedIn/Greenhouse and triggers prep
