# InterviewIntel — Project spec

Reference for contributors and AI assistants. Keep this aligned with the repo as the product evolves.

## What it does and who uses it

**InterviewIntel** is an AI-powered interview preparation product: it ingests a job posting (URL or pasted text), analyzes the role and company, generates stage-specific questions, drafts personalized answer frameworks (e.g. STAR), and runs interactive role-play practice with scored feedback.

**Primary audience:** software engineers and adjacent technical roles (e.g. Solutions Engineers, Sales Engineers, pre-sales, DevTools-oriented roles) preparing for structured, multi-round hiring loops—especially at growth-stage and senior levels.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (Radix via `radix-ui`, Lucide), Framer Motion (landing / selective UX) |
| Backend | FastAPI (Python 3.11+) |
| Agent | LangGraph + LangChain, OpenAI (default `gpt-5.4-nano` via `OPENAI_MODEL`) |
| Persistence | LangGraph PostgresSaver (Supabase) with MemorySaver fallback locally |
| Models | Pydantic v2 |

Auth, hosting, and billing details live in deployment config and `ARCHITECTURE.md` / env examples.

## Pages and flows

**Public**

- Landing (`/`) — marketing, pricing teaser, CTA to sign in or dashboard
- Login (`/login`) — authentication entry

**Authenticated (typ. `/app` prefix)**

- Dashboard — session list, demo session, new session entry
- New session — job description / URL, resume, interviewers, prep vs role-play mode
- Prep detail — analysis, Q&A, role-play chat per session
- Progress — competency trends and score history
- Settings — account, **light/dark theme** (`theme.tsx` + `.dark` on `<html>`), subscription surface, **saved resumes** (up to two labeled profiles; one default), **preferred LLM** (catalog: e.g. `gpt-5.4-nano`, `gpt-4o-mini` free; `gpt-5.4-mini` Pro), support contact; UI built with shadcn primitives under `src/components/ui`

## Data models (high level)

- **Sessions** — id, checkpoints (LangGraph), metadata (status, question counts, scores)
- **User profile** — `profiles.resume` (legacy default text, kept in sync), `profiles.saved_resumes`, `profiles.llm_model` (API model id), usage counters, plan tier
- **Progress** — aggregated scores across sessions (`final_scores`, trend data)

Exact shapes: backend Pydantic models and frontend `lib/api.ts` types.

## Third-party services

- OpenAI (LLM) — `OPENAI_MODEL` for the agent graph; optional `OPENAI_EXTRACT_MODEL` for cheaper field extraction (see `backend/.env.example`)
- Supabase (Postgres checkpointer in production; optional auth patterns)
- Stripe / monetization (planned or partial; see app for current gates)

## LLM evaluation (cost vs quality)

When comparing models (e.g. `gpt-5.4-nano` vs `gpt-5.4-mini` or `gpt-4o-mini`), run a **small fixed set** of real (redacted) postings through: extract-fields → one full analyze/generate/draft path. Score **extraction** (company, role, stage sanity), **analysis** (jd_fit coherence), and **draft usefulness** (STAR-style relevance). Multiply logged token usage by current list pricing from OpenAI’s docs.

## Definition of done (typical task)

- Behavior matches the task description; no regressions on core flows (create session, prep, role-play).
- Typecheck and production build pass (`frontend`: `npm run build`; `backend`: tests or manual smoke as applicable).
- User-visible copy avoids unexplained abbreviations (e.g. spell out “job description” where users read it).
