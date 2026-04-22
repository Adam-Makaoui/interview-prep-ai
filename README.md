# InterviewIntel

> Production: [interviewintel.ai](https://interviewintel.ai) · Dev: [dev.interviewintel.ai](https://dev.interviewintel.ai)

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
- **Custom Domain (`interviewintel.ai`)** — apex + `www` bound to production, `dev.interviewintel.ai` bound to the `dev` branch in Vercel; old `interviewprep-ai-psi.vercel.app` permanently redirects (308) to production
- **Google OAuth** — Supabase Google provider enabled end-to-end; frontend exposes "Continue with Google" on the login screen with `prompt=select_account`
- **Resend SMTP for Supabase** — custom SMTP configured with SPF/DKIM/DMARC on `interviewintel.ai`; magic-link deliverability to Gmail and outlook is now reliable
- **Multi-origin CORS** — backend now splits `FRONTEND_URL` as a comma-separated list so prod, dev, and `localhost` can all hit the same API during the cutover window
- **Branch-based environments** — `main` → production, `dev` → staging preview; documented `dev → main` merge flow
- **Magic-link error clarity** — login error mapper now branches on Supabase's structured error codes (`over_email_send_rate_limit`, `validation_failed`, `unexpected_failure`, …) and logs raw `code`/`status`/`message` for debugging instead of silently collapsing every failure into "we couldn't deliver the login email"
- **Product-shell polish** — new `PageContainer` + `PageHeader` primitives; Dashboard, Progress, NewSession, and PrepDetail now share a consistent max-width, vertical rhythm, and heading style; stat panels + chart panels migrated to shadcn `Card`
- **Animated hero (product-demo card stack)** — replaces the aborted "intelligence grid"; 12s loop through paste-URL → intelligence extracted → mock interview → scorecard, discrete timeline-based animation so no per-frame JS cost; reduced-motion users see the final composition statically
- **Screen-Studio hero polish** — eye-logo in nav + floating orb above the H1, tighter Screen-Studio vertical rhythm so the card stack peeks above the fold, slow CSS-only orb drift for ambient "cloud" motion (zero main-thread cost), founder About section between testimonials and pricing
- **Hero aurora "alive" background** — hero-scoped CSS aurora layer (stacked radial gradients, 200%-size `background-position` pan over 24s + 48s hue-breathe), boosted orb drift deltas so clouds visibly move. Pure CSS, composited on GPU, scoped to the hero `<section>` (zero cost below the fold), `prefers-reduced-motion` honored
- **Glowing constellation + measurable H1 + screen.studio footer** — knowledge-graph SVG behind the hero now actually visible (wrapper opacity 0.08→0.55, node alpha 0.55→0.95, r=2→3, edge stroke 0.6→1; drop-shadow bloom pulse animates opacity + filter together); H1 rewritten from "Your interview prep mastermind" to the more tangible "From job posting to interview-ready in minutes"; nav CTAs separated (gap-4/5 + px-1 on Sign in); wordmark gets `tracking-normal` + `font-extrabold` on "Intel"; footer replaced with a screen.studio-style stacked layout (brand + links + © 2026 Adam Makaoui)

### Backlog
- **Landing polish v2 — FAQ section** — deferred intentionally. No customer has asked for one, the hero already carries four sections of above-the-fold content, and adding FAQs before real user questions arrive would be writing answers to guesses. Revisit once soft launch generates a dozen repeat questions in Reddit/email — then the FAQ writes itself.
- **YouTube demo video + embed upgrade** — record with [Screen.studio](https://screen.studio), upload as unlisted, swap the `DEMO_VIDEO_ID` placeholder in `Landing.tsx`, replace the iframe with `lite-youtube-embed` for lazy loading
- **"How it works" inline clips** — per-band Screen.studio loops (JD intelligence, STAR frameworks, mock interviews, scorecard) — one short muted MP4 per value-prop band, replacing the static mockups
- **Auto-redirect signed-in users `/` → `/app`** — was bundled in the reverted commit; re-apply as its own small change once hero direction is settled
- **Session-length documentation** — add short ARCHITECTURE.md section explaining Supabase defaults (1h JWT access token + 7d rolling refresh token) — no config change, just codify the decision
- **Monetization: model tiers** — enforce Pro-only models server-side (done for mini), bundle stronger defaults + limits with Stripe checkout; reflect in pricing copy
- **Railway dev environment** — split Railway backend so the `dev` branch deploys to a separate service and `dev.interviewintel.ai` frontends can exercise backend changes without risking production (Level 1 isolation; DB still shared)
- **Testimonials swap** — drop the 3D rotating ring entirely; replace with a horizontal auto-scrolling strip (Vercel/Stripe pattern) — pauses on hover, infinite loop, zero interaction required, mobile works out of the box
- **GTM hygiene** — generate full favicon set (16/32/180/512 + ICO multi-res) from the new eye badge; composite OG image (1200×630) with the eye + wordmark; `sitemap.xml` + `robots.txt`, Schema.org `SoftwareApplication` + `Organization` JSON-LD, Google Search Console verification
- **Founder About copy + headshot** — replace the placeholder 3-sentence bio in `AboutFounder.tsx` with the real story, swap the "AM" gradient avatar for a real headshot at `/public/brand/founder-headshot.jpg`
- **AI SEO** — `/llms.txt` + `/llms-full.txt`, long-form "How it works", "Pricing explainer", and 3–5 use-case pages so AI search engines have substantive content to cite
- **Soft launch** — Reddit posts (r/cscareerquestions, r/interviewprep), X thread strategy, Show HN copy + demo video, Product Hunt when we have notify-me signups
- **UI Polish** — loading skeletons, error states with retry, transitions
- **LangSmith Observability** — tracing all LLM calls (free tier: 5k traces/month, zero code changes)
- **Stripe checkout** — wire Pro plan billing to the existing pricing UI
- **Chrome Extension** — side panel that detects JDs on LinkedIn/Greenhouse and triggers prep
- **Parked: hero motion intensifiers** — escalate the native CSS aurora only if A/B shows engagement gain. Three escalation tiers, none required for launch:
  - _Tier 1: looping video background_ — produce a 6-10s 1080p MP4 in After Effects / Screen.studio (abstract violet cloud loop, ~1–2 MB via `ffmpeg -crf 28 -movflags +faststart`), drop as `<video autoplay muted loop playsinline poster=…>` inside the hero `<section>`, gate with `prefers-reduced-motion` to the static poster. Risk: +2-5 MB per visit, Safari low-power autoplay failures.
  - _Tier 2: Lottie aurora_ — source a cloud/aurora animation on LottieFiles or author in After Effects + [Bodymovin](https://github.com/airbnb/lottie-web), install `lottie-react` (~60 KB gzipped), render via `<Lottie animationData={aurora} loop autoplay />`. Risk: bundle growth, CPU cost on low-end mobile (Lottie renders on main thread unless `renderer: "canvas"`).
  - _Tier 3: Canvas/WebGL flow field_ — install `ogl` (~10 KB) or vanilla `three` (~120 KB), port a Shadertoy fragment shader (e.g. `curl-noise`) into a full-viewport `<canvas>`, animate via `requestAnimationFrame`. Risk: highest perf cost, must gate on `navigator.hardwareConcurrency >= 4` + `prefers-reduced-motion` with a CSS fallback.
- **Parked** — Level 2 backend isolation (separate Supabase project for `dev`) until first schema migration; weekly blog content engine until organic traffic exists; Meta/Google ads until organic CAC is known
