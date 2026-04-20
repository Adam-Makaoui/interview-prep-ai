# InterviewIntel — Architecture & Operations Guide

The single technical reference for how this app works, how to run it, and how to deploy it.

---

## System Overview

```
┌──────────────────┐       ┌─────────────────────────────────────────┐
│  React + Vite    │       │  FastAPI Backend                        │
│  (Frontend)      │──────▶│                                         │
│                  │  API  │  ┌─────────────────────────────────┐    │
│  • Landing       │       │  │  LangGraph Agent (7 nodes)      │    │
│  • Login         │       │  │                                 │    │
│  • Dashboard     │       │  │  parse → analyze → generate ──┐ │    │
│  • New Session   │       │  │                      ↓        ↓ │    │
│  • Prep Detail   │       │  │              roleplay_ask   draft│    │
│  • Role-Play     │       │  │                ↕               │ │    │
│                  │       │  │             evaluate           │ │    │
│                  │       │  │                ↓               │ │    │
│                  │       │  │             summary ←──────────┘ │    │
│                  │       │  │                                 │    │
│  Vercel          │       │  │  [PostgresSaver / MemorySaver]   │    │
└──────────────────┘       └─────────────────────────────────────────┘
        │                              │               │
        │                              │               │
        ▼                              ▼               ▼
   Supabase Auth              Supabase Postgres    OpenAI GPT-5.4 nano
   (magic link)               (sessions, state)    (LLM calls)
```

**Frontend** (Vercel): React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui (Radix primitives, Lucide). SPA with client-side routing; semantic theme tokens and default-dark via `.dark` on `<html>`.
**Backend** (Railway): FastAPI (Python). REST + SSE endpoints. LangGraph state machine for all AI logic.
**Database** (Supabase): Postgres for LangGraph checkpoints, session metadata, and user profiles.
**Auth** (Supabase): Magic link email auth. JWT tokens verified by the backend.
**LLM** (OpenAI): Default `gpt-5.4-nano` for node operations (`OPENAI_MODEL`); optional `OPENAI_EXTRACT_MODEL` for extract-fields only.

---

## Environment Variables

This project uses **service-specific env files** instead of a single root `.env`.

### Runtime files (local)

| Service | File | Purpose |
|---|---|---|
| Backend (FastAPI) | `backend/.env` | OpenAI, Postgres persistence, JWT verification, CORS |
| Frontend (Vite) | `frontend/.env` | Supabase browser auth client |

### Backend variables (`backend/.env`)

| Variable | Required | Why it exists |
|---|---|---|
| `OPENAI_API_KEY` | Yes | LLM calls for parsing, analysis, Q&A, feedback |
| `OPENAI_MODEL` | Yes | Default model for agent nodes |
| `DATABASE_URL` | Production: yes / Local: optional | LangGraph checkpoint + session/profile metadata persistence |
| `SUPABASE_JWT_SECRET` | Yes for auth-protected mode | Verifies Bearer tokens from frontend (`/api/*` user identity) |
| `LANGGRAPH_MEMORY_FALLBACK` | Local dev only | Set `1` to fall back to in-memory checkpointer when Postgres is unreachable |
| `FRONTEND_URL` | Yes | CORS allowlist for browser requests |
| `SUPABASE_URL` | Optional (currently unused in backend logic) | Reserved for future backend Supabase API usage |
| `SUPABASE_ANON_KEY` | Optional (currently unused in backend logic) | Reserved for future backend Supabase API usage |

Notes:
- Leave `DATABASE_URL` blank locally if you want pure in-memory mode with no Postgres attempt.
- If `DATABASE_URL` is set but Postgres is unreachable (e.g. no IPv6 locally), set `LANGGRAPH_MEMORY_FALLBACK=1` to gracefully fall back to in-memory.
- In production (Railway), remove `LANGGRAPH_MEMORY_FALLBACK` so a bad connection fails fast.
- `SUPABASE_JWT_SECRET` must be the project JWT secret, not an anon/publishable key.

### Frontend variables (`frontend/.env`)

| Variable | Required | Why it exists |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL for browser auth client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Preferred | Browser-safe key used by `@supabase/supabase-js` |
| `VITE_SUPABASE_ANON_KEY` | Backward-compatible fallback | Legacy env name still supported by code |
| `VITE_API_ORIGIN` | Production (Vercel) | Railway public origin only; enables cross-origin API calls (see `frontend/src/lib/api.ts`) |
| `VITE_STRIPE_CHECKOUT_URL` | Optional | Upgrade modal checkout link |

### Production deployment mapping

**Railway (backend service):**
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `DATABASE_URL` — from Supabase: Project Settings > Database > Connection string (URI)
- `SUPABASE_JWT_SECRET` — from Supabase: Project Settings > API > JWT Secret
- `FRONTEND_URL` = comma-separated list of production + staging origins (e.g. `https://interviewintel.ai,https://staging.interviewintel.ai`)

**Vercel (frontend service):**
- `VITE_SUPABASE_URL` — from Supabase: Project Settings > API > Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- `VITE_API_ORIGIN` — Railway public URL, **no** trailing slash, **no** `/api` suffix
- `VITE_STRIPE_CHECKOUT_URL` (when billing is enabled)

---

## Auth Flow

```
Browser                          Supabase                     FastAPI
  │                                 │                            │
  │── signInWithOtp(email) ────────▶│                            │
  │                                 │── sends magic link email   │
  │                                 │                            │
  │◀── user clicks email link ──────│                            │
  │                                 │                            │
  │── exchangeCodeForSession() ────▶│                            │
  │◀── access_token (JWT) ─────────│                            │
  │                                 │                            │
  │── GET /api/sessions ───────────────────────────────────────▶│
  │   Authorization: Bearer <JWT>   │                            │
  │                                 │      decode JWT with       │
  │                                 │      SUPABASE_JWT_SECRET   │
  │                                 │      extract user_id       │
  │◀── 200 [{sessions}] ────────────────────────────────────────│
```

1. **Login.tsx** calls `supabase.auth.signInWithOtp({ email })` with redirect to `/app`.
2. Supabase sends a magic link email. User clicks it, lands back on the app.
3. Supabase JS client exchanges the URL code for a session (access token + refresh token).
4. Every API call includes `Authorization: Bearer <access_token>`.
5. **Backend** (`main.py` > `_get_current_user`) decodes the JWT using `SUPABASE_JWT_SECRET` (HS256, audience `authenticated`), extracts `sub` as the user ID.
6. If `SUPABASE_JWT_SECRET` is unset, some endpoints allow anonymous access for local dev.

---

## LangGraph State Machine

### The 7-Node Graph

```
START ──► [Parse JD] ──► [Analyze Role] ──► [Generate Questions]
                                                    │
                                        ┌───────────┴──────────┐
                                        │ route_by_mode        │
                                        ▼                      ▼
                                  [Draft Answers]      [Roleplay Ask]
                                        │                      │
                                        ▼              ┌───────┘
                                  [Summary] ◄──────── [Evaluate]
                                        │              │     ▲
                                        ▼              │     │
                                       END             └─────┘
                                                   check_continue
```

### What Each Node Does

| Node | Responsibility | Key Design Decision |
|------|---------------|-------------------|
| **Parse JD** | Extracts company/role from raw text or URL | Idempotent — skips LLM if fields are already filled |
| **Analyze Role** | Generates key skills, culture signals, interview tips | Builds the context chain — everything downstream uses this output |
| **Generate Questions** | Creates 8-10 stage-specific questions | Injects `STAGE_CONTEXT` — a recruiter screen generates different questions than a technical round |
| **Draft Answers** | Writes STAR-method answer frameworks (prep mode) | Personalizes against the user's resume |
| **Roleplay Ask** | Presents questions as a realistic interviewer persona | Does NOT reveal it's AI — creates immersive practice |
| **Evaluate** | Scores answers 1-10 with coaching feedback | Uses `interrupt_before` — the graph PAUSES here waiting for user input |
| **Summary** | Synthesizes all feedback into a readiness scorecard | Aggregates individual scores into holistic assessment |

### Conditional Edges

**`route_by_mode`** — After question generation, the graph routes to either the prep path (draft answers > summary) or the roleplay path (ask > evaluate > loop). This is a routing decision, not just piping data through.

```python
# graph.py
graph.add_conditional_edges("generate", route_by_mode, {"prep": "draft", "roleplay": "roleplay_ask"})

# nodes.py
def route_by_mode(state: AgentState) -> str:
    return "roleplay" if state.get("mode") == "roleplay" else "prep"
```

**`check_continue`** — After evaluating each roleplay answer, the graph decides whether to ask the next question or wrap up with a summary.

```python
# graph.py
graph.add_conditional_edges("evaluate", check_continue, {"continue": "roleplay_ask", "done": "summary"})

# nodes.py
def check_continue(state: AgentState) -> str:
    if state.get("session_complete"):
        return "done"
    if state.get("current_q_index", 0) >= len(state.get("questions", [])):
        return "done"
    return "continue"
```

### Human-in-the-Loop (Two-Pause Pattern)

```python
agent = build_graph().compile(
    checkpointer=checkpointer,
    interrupt_before=["evaluate"],   # PAUSE 1: user types their answer
    interrupt_after=["evaluate"],    # PAUSE 2: user reads their feedback
)
```

1. **Pause 1** (`interrupt_before`): Graph stops after `roleplay_ask` presents a question. User types their answer. `POST /sessions/:id/answer` resumes the graph into `evaluate`.
2. **Pause 2** (`interrupt_after`): Graph stops after `evaluate` scores the answer. User reads feedback. `POST /sessions/:id/continue` resumes into the next `roleplay_ask`.

### Context Accumulation

State grows as it flows through nodes:

1. **Parse**: `{company, role, job_description, stage_context}` — extracted from raw text/URL
2. **Analyze**: `{analysis: {key_skills, culture_signals, interviewer_focus, ...}}` — built from parsed data
3. **Generate**: `{questions: [{question, category, theme, likely_asked_by, why_asked}, ...]}` — informed by analysis + stage + interviewers
4. **Draft**: `{answers: [{answer_framework, key_points, timing_guidance, red_flags, response_strategy, ...}, ...]}` — personalized against resume + analysis

Each node sees everything the previous nodes produced. This is context accumulation, not independent LLM calls.

### Stage-Aware Prompting

`STAGE_CONTEXT` mapping in `nodes.py` ensures a phone screen generates different questions than a technical round. For custom stages (e.g. "Case Study"), an LLM fallback generates the stage description on the fly and caches it in state.

### Panel Interview Awareness

When interviewers are provided, the analysis node generates `interviewer_focus` areas based on their titles. These flow into question generation so each question includes `likely_asked_by` attribution.

---

## Request Lifecycle

### "When the user submits the new session form, what happens?"

1. **Frontend** (`NewSession.tsx`): Calls `createSessionStream()` > `POST /api/sessions/stream`
2. **Backend** (`main.py`): Spawns a background thread running `agent.stream(initial_state, config, stream_mode="updates")`
3. **SSE events** fire as each node completes: `parse` > `analyze` > `generate` > `draft`
4. **Frontend receives `generate` complete** > navigates to `/prep/:id` immediately (doesn't wait for `draft`)
5. **PrepDetail** loads, shows questions. Polls `GET /api/sessions/:id` every 2 seconds until answers arrive.
6. Background thread finishes `draft` > answers appear on next poll

### "In role-play, what happens when I submit an answer?"

1. **Frontend** (`ChatWindow.tsx`): Calls `submitAnswer()` > `POST /api/sessions/:id/answer`
2. **Backend** (`main.py` > `submit_answer()`): Appends user answer to `chat_history`, calls `agent.invoke()`
3. Graph resumes into `evaluate_answer` node (`nodes.py`): LLM scores 1-10, generates strengths/improvements/improved_answer
4. Graph pauses at `interrupt_after=["evaluate"]` — status becomes `"reviewing_feedback"`
5. **Frontend** sees `reviewing_feedback` status > shows FeedbackCard
6. User clicks "Next Question" > `POST /api/sessions/:id/continue` > graph resumes into `roleplay_ask`
7. Every 5 questions: CheckpointCard appears with score trends and "Continue" vs "Finish" buttons

### "When I upload a PDF resume, where does it go?"

1. **Frontend** (`NewSession.tsx`): File picker triggers `parseResumeFile()` in `api.ts`
2. **API call**: `POST /api/parse-resume` with multipart form data
3. **Backend** (`main.py` > `parse_resume()`): pdfplumber extracts text from the PDF bytes
4. **Response**: Extracted text goes back to the frontend textarea — user can edit it
5. **If they click "Save as default"**: `PUT /api/profile/resume` writes to Postgres (or `resume_profile.json` locally)

---

## Code Map

```
backend/
  app/
    config.py          ← Pydantic BaseSettings, loads from .env
    models.py          ← Pydantic request/response models
    main.py            ← FastAPI routes (all API endpoints), auth, CORS, session formatting
    agent/
      state.py         ← AgentState TypedDict (the state that flows through the graph)
      graph.py         ← StateGraph wiring: nodes, edges, checkpointer, interrupt points
      nodes.py         ← THE CORE: all 7 node functions + LLM calls + prompts
  resume_profile.json  ← saved resume fallback (local file, when no Postgres)
  requirements.txt     ← Python dependencies
  .env                 ← secrets (not committed)

frontend/
  src/
    main.tsx           ← React entry point
    App.tsx            ← React Router: / → Landing, /login → Login, /app → Dashboard,
                         /app/new → NewSession, /app/prep/:id → PrepDetail, /app/settings → Settings
    index.css          ← Tailwind v4 + shadcn semantic tokens + tw-animate-css
    components.json    ← shadcn CLI config (aliases, style: radix-nova)
    lib/
      api.ts           ← all API calls + TypeScript interfaces
      utils.ts         ← cn() for shadcn class merging
      theme.tsx        ← light/dark ThemeProvider + document class toggle
      supabase.ts      ← Supabase client init (null if env vars missing)
      auth.tsx         ← AuthProvider context + useAuth hook
    pages/
      Landing.tsx      ← Public landing page
      Login.tsx        ← Magic link login
      Dashboard.tsx    ← Session list grouped by pipeline
      NewSession.tsx   ← Form + SSE streaming + early navigation
      PrepDetail.tsx   ← Analysis/Q&A/Role-Play tabs + answer polling
    components/
      ui/              ← shadcn-generated primitives (button, card, input, …)
      AppShell.tsx     ← sidebar layout, nav, account dropdown
      QuestionCard.tsx ← Collapsible Q&A card with richer details
      ChatWindow.tsx   ← Roleplay chat + FeedbackCard + CheckpointCard
      SkillsScorecard.tsx ← Competency score visualization
      UpgradeModal.tsx ← Free tier limit paywall
  tests/
    dashboard.spec.ts, new-session.spec.ts, session-detail.spec.ts,
    session-complete.spec.ts, roleplay.spec.ts

Deploy configs (repo root):
  railway.toml         ← Railway Nixpacks build config
  nixpacks.toml        ← Build provider settings
  Procfile             ← Process entry for Railway
  frontend/vercel.json ← Vercel SPA rewrite rules
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/sessions/stream` | Create session with SSE progress (primary) |
| POST | `/api/sessions` | Create session (blocking, fallback) |
| GET | `/api/sessions` | List all sessions for the authenticated user |
| GET | `/api/sessions/{id}` | Get session state (used by polling) |
| POST | `/api/sessions/{id}/answer` | Submit role-play answer |
| POST | `/api/sessions/{id}/continue` | Advance past feedback pause |
| POST | `/api/sessions/{id}/finish` | End roleplay early, jump to summary |
| POST | `/api/sessions/{id}/start-roleplay` | Switch prep session to role-play |
| POST | `/api/extract-fields` | Auto-fill form from JD text or URL |
| POST | `/api/lookup-interviewer` | Web search for interviewer title |
| POST | `/api/parse-resume` | Extract text from PDF/DOCX/TXT upload |
| GET | `/api/profile/resume` | Get saved resume |
| PUT | `/api/profile/resume` | Save/update resume |
| GET | `/api/profile/me` | Get user profile (plan, session_count) |

---

## Technical Choices & Trade-offs

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| Agent framework | LangGraph | ReAct / CrewAI / plain LangChain | LangGraph gives explicit flow control. Our problem is a structured pipeline with branches and human-in-the-loop — a state machine, not a reasoning loop. |
| LLM output | JSON-mode (`response_format`) | Function calling / tool use | Our nodes are deterministic steps, not autonomous tool decisions. JSON-mode is simpler and equally structured. |
| State persistence | PostgresSaver (prod) / MemorySaver (dev) | SQLiteSaver | Supabase Postgres is the production DB. MemorySaver is zero-config for local dev. The switch is one line — swap the checkpointer. |
| Backend | FastAPI | Flask / Django | Async support, automatic OpenAPI docs, Pydantic validation. API-first architecture. |
| Frontend | React + Vite + Tailwind v4 + shadcn/ui | Next.js | Vite is faster dev iteration. No SSR needed — pure SPA. shadcn copies components into the repo (full control). Use `npm install --legacy-peer-deps` in `frontend/` until Tailwind’s Vite plugin peer range includes Vite 8. |
| URL scraping | httpx + BeautifulSoup | Playwright / Selenium | Lightweight and fast. For production we'd use a scraping API or browser extension. |
| Auth | Supabase Auth (magic link) | Clerk / Auth0 | Already using Supabase for Postgres. One fewer vendor. Magic link is frictionless for MVP. |
| Deploy | Railway + Vercel | Single platform | Each platform is best-in-class for its service type. Free tiers cover MVP. Configs already exist in repo. |

---

## Dev vs Prod Setup

### Dev (local)

```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- `backend/.env` uses `LANGGRAPH_MEMORY_FALLBACK=1` (in-memory, no Postgres needed)
- `DATABASE_URL` left blank or pointed at Supabase if you want persistence
- `SUPABASE_JWT_SECRET` set if you want auth locally, or left blank for anonymous mode
- Frontend dev server proxies or directly hits `http://localhost:8000`

### Prod (deployed)

- **Railway**: backend auto-deploys from `main` branch. Env vars in Railway dashboard.
- **Vercel**: frontend auto-deploys from `main` branch (root dir = `frontend`). Env vars in Vercel dashboard.
- `LANGGRAPH_MEMORY_FALLBACK` is **NOT set** in prod — forces real Postgres or fails loudly.
- `DATABASE_URL` points to Supabase production Postgres.

### Release Workflow

1. Develop on feature branches locally
2. Push to `dev` first → `dev.interviewintel.ai` redeploys, exercise change
3. Open PR from `dev` → `main`, merge
4. Railway and Vercel auto-deploy `main` → production
5. No manual deploys, no SSH, no build scripts to remember

### Branch-based environments

| Branch | Frontend (Vercel) | Backend (Railway) | Database (Supabase) |
|---|---|---|---|
| `main` | `interviewintel.ai` (prod) | prod service | prod (shared) |
| `dev` | `dev.interviewintel.ai` (preview) | **prod service for now** — split is tracked in roadmap | prod (shared) |

The frontends are already split by branch on Vercel. The backend and database are currently shared between branches, which means merging to `dev` does **not** isolate backend behaviour from prod users. See the next subsection for the one-time split.

### Railway dev environment (Level 1 backend split)

**Why**: today both `dev.interviewintel.ai` and `interviewintel.ai` frontends hit the same Railway backend. That's fine for frontend-only work but risky for backend changes (a crash on `dev` takes prod down; a request-handling regression leaks into prod traffic).

**Scope of Level 1**: separate backend *deployments* per branch; **keep Supabase shared**. Safe for: adding endpoints, refactoring internals, experimenting with prompts/models. **NOT safe for**: destructive SQL, schema migrations, bulk writes — for those, pursue Level 2 (separate Supabase project).

**One-time setup (user-driven in Railway UI):**

1. Railway → open the existing project → **Settings → Environments → New Environment** named `dev`, cloned from production.
2. In the `dev` environment, **Service → Settings → Source → Branch** = `dev`. Leave the `main`-tracking environment pointing at `main`.
3. Review `dev` env vars. Copy `OPENAI_API_KEY`, `OPENAI_MODEL`, `DATABASE_URL`, `SUPABASE_JWT_SECRET` from prod unless you're also splitting them. Override just `FRONTEND_URL` to exclude production:
   ```
   FRONTEND_URL=https://dev.interviewintel.ai,http://localhost:5173
   ```
   (prod origin should *not* be whitelisted on dev CORS — that's the whole point of the split).
4. Deploy the `dev` environment. Note its public URL, e.g. `https://interviewintel-agent-dev.up.railway.app`.
5. **Vercel → project → Settings → Environment Variables → `VITE_API_ORIGIN`**:
   - Existing entry (prod Railway URL): re-scope to **Production** only.
   - New entry (dev Railway URL): scope to **Preview + Development**.
6. Trigger a redeploy on the `dev` branch (empty commit or "Redeploy" in Vercel) so the new `VITE_API_ORIGIN` takes effect.

**Smoke test:**

- `https://dev.interviewintel.ai` → network tab → confirm API requests target the dev Railway URL.
- `https://interviewintel.ai` → same test → confirm API requests still target prod Railway URL.
- Break something intentionally on `dev` (throw in a route), confirm prod stays green.

**Level 2 (parked)** — separate Supabase project for `dev`. Do this *before* the first destructive migration; not sooner, because the shared DB makes the dev and prod apps trivially comparable until then.

---

## Go-Live Checklist

Do these **in order**. If something fails, fix it before moving on.

### Step 1 — Push code to GitHub

1. Commit and push to `main`.
2. Confirm the push shows up on GitHub.

### Step 2 — Deploy the backend on Railway

1. Sign in at [railway.app](https://railway.app) and create a **New Project**.
2. Choose **Deploy from GitHub repo** and select this repository.
3. Railway detects the app from `railway.toml` + `nixpacks.toml`.
4. Open your service > **Variables** and add:

   | Variable | Value |
   |---|---|
   | `OPENAI_API_KEY` | Your OpenAI secret key (`sk-...`) |
   | `OPENAI_MODEL` | e.g. `gpt-5.4-nano` |
   | `DATABASE_URL` | Supabase: Project Settings > Database > Connection string (URI). URL-encode `$` and `!` in passwords. |
   | `SUPABASE_JWT_SECRET` | Supabase: Project Settings > API > JWT Secret (long secret, not the anon key) |
   | `FRONTEND_URL` | Production + staging origins, comma-separated (e.g. `https://interviewintel.ai,https://staging.interviewintel.ai`). Placeholder OK until Step 3 completes. |

5. Do **not** add `LANGGRAPH_MEMORY_FALLBACK` in production.
6. Deploy. Verify: `https://<name>.up.railway.app/api/health` returns `{"status":"ok"}`.

### Step 3 — Deploy the frontend on Vercel

1. Sign in at [vercel.com](https://vercel.com) and create a new project.
2. Import the same GitHub repo. Set **Root Directory** to `frontend`.
3. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
4. Add environment variables:

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase: Project Settings > API > Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase: Project Settings > API > anon/public key (`eyJ...`) |
   | `VITE_API_ORIGIN` | Railway public URL, no trailing slash, no `/api` suffix |

5. Deploy.

### Step 4 — Wire CORS

1. Go back to Railway > Variables.
2. Set `FRONTEND_URL` to your production + staging origins, comma-separated. Example: `https://interviewintel.ai,https://staging.interviewintel.ai`. The backend splits on commas and appends `http://localhost:5173` automatically ([`backend/app/main.py`](backend/app/main.py)).
3. Save and let Railway redeploy.

### Step 5 — Configure Supabase auth redirects

1. Supabase > Authentication > URL Configuration.
2. **Site URL**: `https://interviewintel.ai` (production).
3. **Redirect URLs**: add `https://interviewintel.ai/**` and `https://staging.interviewintel.ai/**` (and any legacy origin during cutover windows).
4. Save.

### Step 6 — Configure auth email delivery (Resend custom SMTP)

Supabase's built-in email provider only sends to organization/team members and is rate-limited. For real users (especially Gmail, which enforces the Feb 2024 bulk-sender rules) you need custom SMTP on a domain you control.

1. **Resend > Domains > Add domain.** Use a domain you own (not `*.vercel.app`).
2. Add the DNS records Resend generates: **SPF** (`TXT v=spf1 include:...resend...`), **DKIM** (two `CNAME` records), **DMARC** (`TXT _dmarc` with at minimum `v=DMARC1; p=none; rua=mailto:you@domain`). Wait until all three are **Verified** in Resend.
3. **Resend > API keys** — create a key (SMTP-scoped). Resend uses `host = smtp.resend.com`, `port = 465` (SSL) or `587` (STARTTLS), username `resend`, password = the API key.
4. **Supabase > Authentication > SMTP Settings** — enable **Custom SMTP** and paste the values above. Set **Sender email** to `no-reply@interviewintel.ai` (must match the verified Resend domain) and **Sender name** to `InterviewIntel`.
5. **Supabase > Authentication > Email Templates > Magic Link** — rewrite the subject and body to match your brand. Friendly copy measurably improves Gmail inbox placement over time.
6. Confirm delivery: send a sign-in to Gmail, Outlook, iCloud, Yahoo. In Gmail, open **Show original** and verify `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

### Step 6b — Enable Google OAuth

1. **Google Cloud Console** > create/select project > **APIs & Services > OAuth consent screen** > External. Scopes `openid email profile`. Add the production origin under Authorized domains.
2. **Credentials > Create credentials > OAuth client ID > Web application.**
   - **Authorized JavaScript origins:** your Vercel production origin (add the new domain later).
   - **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback`.
3. **Supabase > Authentication > Providers > Google** — paste Client ID + Secret, enable.
4. Frontend is already wired: the **Continue with Google** button in [`frontend/src/pages/Login.tsx`](frontend/src/pages/Login.tsx) calls `supabase.auth.signInWithOAuth({ provider: "google" })`. No backend change is needed — OAuth logins produce the same JWT shape the FastAPI backend already verifies.

### Step 7 — Smoke test

1. Open your Vercel URL in a browser.
2. Request a magic link, check email, complete sign-in.
3. Start one prep session, confirm it shows on the dashboard.

If sessions fail: check Network tab for CORS/401 errors. `401` = JWT/env mismatch. `CORS` = `FRONTEND_URL` on Railway doesn't match the browser URL exactly.

---

## Challenges & Learnings

1. **Pydantic v2 + pydantic-settings** — `extra_forbidden` mode rejected unexpected env vars. Fix: cleaned `.env` to only include expected variables.
2. **LangGraph mode switching** — `agent.invoke()` wouldn't re-enter the graph at `END`. Fix: `agent.update_state(as_node="generate")` repositions state so the conditional edge re-fires.
3. **Custom stage context** — Hardcoding all interview stages doesn't scale. Fix: LLM fallback generates a stage description for unknown stages, cached in `stage_context`.

---

## Demo Script (Quick Reference)

1. Land on Dashboard — show session history
2. "+ New Session" — paste a JD, click Auto-Fill, watch it extract fields
3. Upload resume (PDF) — show pdfplumber extraction
4. Add an interviewer — click search icon for DuckDuckGo auto-lookup
5. Start Prep — watch SSE progress (Parsing > Analyzing > Generating)
6. Show Q&A Tab — theme badges, interviewer attribution, collapsible answer frameworks
7. Show Analysis Tab — key skills, culture signals, interviewer focus areas
8. Switch to Role-Play — answer a question, show feedback card (score, strengths, improvements)
9. Continue drilling — show checkpoint card with score trends after 5 questions

---

## Providers and Responsibilities

Who owns what — use this to decide which dashboard to open when something breaks.

| Provider | Owns | Configured in |
|---|---|---|
| **Vercel** | Frontend hosting, web-app DNS/TLS, preview + production deployments, `VITE_*` env vars | [`frontend/`](frontend/), Vercel dashboard |
| **Railway** | FastAPI backend runtime, LangGraph execution, SSE endpoints, JWT verification, CORS, backend env vars (`OPENAI_*`, `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `FRONTEND_URL`) | [`backend/`](backend/), Railway dashboard |
| **Supabase** | Postgres (LangGraph checkpoints, session metadata, profiles); Auth (magic link + Google OAuth, JWT issuance); URL Configuration; email templates. SMTP is delegated to Resend. | Supabase dashboard |
| **Resend** | Transactional email delivery and sending-domain reputation via SPF / DKIM / DMARC | Resend dashboard + DNS at the domain registrar |
| **Google Cloud (OAuth)** | Identity provider for Continue with Google. Holds only the OAuth client — user data flows through Supabase, not Google | Google Cloud Console |
| **OpenAI** | LLM calls from the Railway backend. Model set by `OPENAI_MODEL` (and optionally `OPENAI_EXTRACT_MODEL`) | OpenAI dashboard + Railway env |

### Troubleshooting rule-of-thumb

- **Can't sign in?** → Supabase URL Configuration, Resend DNS status, Google OAuth redirect URI.
- **Email not arriving?** → Resend delivery logs first, then Supabase SMTP settings, then DNS.
- **App error on `/app`?** → Vercel deployment logs → Railway backend logs → Supabase Postgres.
- **Wrong or slow model responses?** → Railway env (`OPENAI_MODEL`) → OpenAI dashboard rate limits.
- **CORS / 401 in browser?** → `FRONTEND_URL` on Railway must exactly match the browser origin; `SUPABASE_JWT_SECRET` must match the Supabase project.
