# Codebase Map (master locator)

Purpose: find the right file fast by feature/function. When you (or an AI agent)
need to change behavior, start here, jump to the file, then read its top-of-file
docstring/comments. Line numbers are approximate and drift; treat names as the
source of truth.

Related: [`ARCHITECTURE.md`](../ARCHITECTURE.md) (how it runs/deploys),
[`ROADMAP.md`](../ROADMAP.md) (what's next), [`project_specs.md`](../project_specs.md) (product spec).

## Top-level layout

```
backend/app/        FastAPI service + LangGraph agent (Python)
  main.py           All HTTP routes, persistence helpers, auth, billing
  config.py         Env-driven settings (pydantic-settings)
  models.py         Pydantic request/response models
  db_diagnostics.py Sanitized DB-host logging helper
  llm_catalog.py    Model catalog + plan gating
  resume_store.py   Saved-resume document normalization (max 2 slots)
  agent/
    graph.py        LangGraph state machine + checkpointer selection
    nodes.py        Each agent step (parse/analyze/generate/draft/roleplay/...)
    state.py        AgentState TypedDict (the graph's shared state shape)
frontend/src/       React + Vite + TypeScript UI
  App.tsx           Router, ProtectedRoute, LandingGate, providers
  lib/              api client, auth, supabase client, theme, utils
  pages/            Route screens (Landing, Login, Dashboard, ...)
  components/       Product UI, landing/* (marketing), ui/* (shadcn)
docs/               Runbooks, checklists, this map
```

## Backend: HTTP API routes

All in [`backend/app/main.py`](../backend/app/main.py). Handler = the async function; auth column notes whether a valid Supabase JWT is required.

| Method | Path | Handler | Auth | Purpose |
|--------|------|---------|------|---------|
| GET | `/api/health` | `health` | no | Liveness probe (Railway healthcheck) |
| POST | `/api/lookup-interviewer` | `lookup_interviewer` | optional | Web-search an interviewer's title |
| POST | `/api/parse-resume` | `parse_resume` | no | Extract text from PDF/DOCX/TXT upload |
| POST | `/api/extract-fields` | `extract_fields` | no | Auto-fill new-session form from JD text/URL |
| POST | `/api/sessions/stream` | `create_session_stream` | required | Create session w/ SSE progress (primary) |
| POST | `/api/sessions` | `create_session` | required | Create session (blocking fallback) |
| GET | `/api/sessions` | `list_sessions` | required | Dashboard list (filtered by `user_id`) |
| GET | `/api/sessions/{id}` | `get_session` | no | Fetch one session's full state |
| DELETE | `/api/sessions/{id}` | `delete_session` | required | Delete session + LangGraph checkpoints |
| POST | `/api/sessions/{id}/answer` | `submit_answer` | no | Submit a role-play answer |
| POST | `/api/sessions/{id}/start-roleplay` | `start_roleplay` | no | Switch prep session into role-play |
| POST | `/api/sessions/{id}/continue` | `continue_session` | no | Advance past a feedback pause |
| POST | `/api/sessions/{id}/finish` | `finish_session` | no | End role-play early, jump to summary |
| GET | `/api/profile/progress` | `get_progress` | optional | Cross-session aggregated scores |
| GET | `/api/profile/resume` | `get_resume` | optional | Legacy single saved resume |
| PUT | `/api/profile/resume` | `save_resume_endpoint` | optional | Save legacy single resume |
| GET | `/api/profile/resumes` | `get_saved_resumes` | optional | Saved-resume slots (max 2) |
| PUT | `/api/profile/resumes` | `put_saved_resumes` | optional | Replace saved-resume slots |
| POST | `/api/billing/checkout` | `create_billing_checkout` | required | Stripe Checkout session for Pro |
| POST | `/api/billing/portal` | `create_billing_portal` | required | Stripe Customer Portal session |
| POST | `/api/billing/webhook` | `stripe_webhook` | signature | Stripe events -> `profiles.plan` |
| GET | `/api/profile/me` | `get_me` | optional | Current profile + daily usage |
| PUT | `/api/profile/theme` | `put_theme` | required | Persist light/dark preference |
| PUT | `/api/profile/llm-model` | `put_llm_model` | required | Set preferred model (plan-gated, 403) |

## Backend: helpers by concern (all in `main.py` unless noted)

- Auth: `_get_current_user` (decode Supabase JWT -> `sub`), `_require_user` (401 if missing).
- DB/persistence: `_db` (lazy psycopg conn), `_ensure_tables` (idempotent schema on startup), `_save_session_meta`, `_list_session_metas`, `_get_session_meta`, `_update_session_meta`, `_save_final_scores`, `_save_running_scores`, `_update_cached_status`, `_count_sessions_today`.
- Profiles: `_get_profile`, `_ensure_profile`, `_increment_session_count`.
- Resumes: `_get_saved_resumes_document`, `_persist_saved_resumes_doc`, `_load_saved_resume`, `_save_resume` (+ [`resume_store.py`](../backend/app/resume_store.py) for normalization).
- CORS: `_apex_www_peers`, `_cors_allowlist`, `_origin_with_host` (apex/www expansion of `FRONTEND_URL`).
- Billing: `_stripe_api`, `_get_user_id_by_stripe_customer`, `_update_billing_profile`, `_subscription_price_id`, `_sync_subscription_to_profile`.
- Session shaping: `_get_state` (read LangGraph snapshot), `_format_session` (state -> API JSON), `_skill_averages_from_running`, `_pipeline_group_value`.
- Free-tier: `_check_free_limit` (402 when over daily cap), `FREE_DAILY_LIMIT`.
- Logging: `database_host_for_logs` in [`db_diagnostics.py`](../backend/app/db_diagnostics.py).

## Backend: the agent (LangGraph)

- State machine + checkpointer: [`backend/app/agent/graph.py`](../backend/app/agent/graph.py) — `build_graph` (nodes/edges), `_make_checkpointer` (PostgresSaver when `DATABASE_URL` works, else MemorySaver/fail-fast), module-level `agent` + `checkpointer`.
- Shared state shape: [`backend/app/agent/state.py`](../backend/app/agent/state.py) — `AgentState`.
- Step implementations: [`backend/app/agent/nodes.py`](../backend/app/agent/nodes.py)
  - Flow nodes: `parse_job_posting` -> `analyze_role` -> `generate_questions` -> (`draft_answers` | `roleplay_ask` -> `evaluate_answer`) -> `session_summary`.
  - Routing: `route_by_mode` (prep vs roleplay), `check_continue` (loop vs done).
  - LLM/util: `_llm`, `_llm_json`, `_llm_json_extract`, `_effective_model`, `_company_intel_snippets`, `_fetch_url` (+ `_fetch_url_firecrawl`, `_fetch_url_httpx_fallback`), `_resolve_stage_context`, `_format_interviewers`, `_merge_competency_running`.

## Backend: models & config

- Request/response: [`backend/app/models.py`](../backend/app/models.py) — `SessionCreate`, `AnswerSubmit`, `ResumeProfile`, `ResumeSlot`, `PutResumesRequest`, `SavedResumesResponse`, `LlmModelUpdate`, `ThemeUpdate`, `SessionOut`, `InterviewerInfo`.
- Settings: [`backend/app/config.py`](../backend/app/config.py) — `Settings` (`OPENAI_*`, `DATABASE_URL`, `SUPABASE_*`, `FRONTEND_URL`, `STRIPE_*`, `use_postgres`).
- Model catalog/plan gating: [`backend/app/llm_catalog.py`](../backend/app/llm_catalog.py) — `model_choices_for_api`, `is_model_allowed_for_plan`, `resolve_session_model`.

## Frontend: entry & routing

- [`frontend/src/App.tsx`](../frontend/src/App.tsx) — routes, `ProtectedRoute` (auth gate), `LandingGate` (guests vs signed-in), `ProfileThemeSync`, providers.
- [`frontend/src/main.tsx`](../frontend/src/main.tsx) — React root + theme boot.

## Frontend: libs (`frontend/src/lib`)

- [`api.ts`](../frontend/src/lib/api.ts) — all backend calls + TS types. Key fns: `listSessions`, `createSession`/`createSessionStream`, `getSession`, `submitAnswer`, `continueSession`, `finishSession`, `startRoleplay`, `parseResumeFile`, `extractFields`, `getProgress`, `getProfile`, `putTheme`, `putLlmModel`, `getSavedResumes`/`putSavedResumes`, `createCheckoutSession`, `createCustomerPortalSession`. Helpers: `apiFetch`/`authHeaders` (attach Supabase token), `apiBase` (`VITE_API_ORIGIN`).
- [`auth.tsx`](../frontend/src/lib/auth.tsx) — `AuthProvider`, `useAuth` (session + bounded loading so a hung Supabase doesn't trap the app).
- [`supabase.ts`](../frontend/src/lib/supabase.ts) — browser Supabase client; logs a clear error when `VITE_SUPABASE_*` is missing.
- [`theme.tsx`](../frontend/src/lib/theme.tsx) — `ThemeProvider`, `useTheme`, `applyThemeToDocument`.
- [`utils.ts`](../frontend/src/lib/utils.ts) — `cn` class-merge helper.

## Frontend: pages (`frontend/src/pages`)

- [`Landing.tsx`](../frontend/src/pages/Landing.tsx) — marketing page (bespoke motion).
- [`Login.tsx`](../frontend/src/pages/Login.tsx) — Google + magic-link auth.
- [`Dashboard.tsx`](../frontend/src/pages/Dashboard.tsx) — session list grouped by pipeline.
- [`NewSession.tsx`](../frontend/src/pages/NewSession.tsx) — create-session form (JD/URL, resume, interviewers, mode).
- [`PrepDetail.tsx`](../frontend/src/pages/PrepDetail.tsx) — analysis, Q&A, role-play chat.
- [`Progress.tsx`](../frontend/src/pages/Progress.tsx) — competency trends/charts.
- [`Resumes.tsx`](../frontend/src/pages/Resumes.tsx) — saved-resume library.
- [`Settings.tsx`](../frontend/src/pages/Settings.tsx) — account, theme, subscription, model picker.

## Frontend: components (`frontend/src/components`)

- Product: `AppShell` (authed shell/nav), `ChatWindow` (role-play), `QuestionCard`/`QuestionOnlyCard`, `SkillsScorecard`, `UpgradeModal`, `RouteFade`.
- Landing (marketing-only): `landing/HeroProductDemo`, `HeroAurora`, `HeroConstellation`, `HeroMascot`, `BrandMark`, `AboutFounder`, `TestimonialsCarousel`.
- Primitives (shadcn): `ui/button`, `ui/card`, `ui/input`, `ui/label`, `ui/dialog`, `ui/dropdown-menu`, `ui/separator`, `ui/page-container`, `ui/page-header`.

## "Where do I change X?"

- A new API endpoint -> [`main.py`](../backend/app/main.py) (route) + [`api.ts`](../frontend/src/lib/api.ts) (client) + [`models.py`](../backend/app/models.py) (shapes).
- Agent prompt/behavior -> [`nodes.py`](../backend/app/agent/nodes.py); flow/edges -> [`graph.py`](../backend/app/agent/graph.py); new state field -> [`state.py`](../backend/app/agent/state.py).
- Auth requirement on a route -> `_require_user` vs `_get_current_user` in [`main.py`](../backend/app/main.py).
- Plan gating / model list -> [`llm_catalog.py`](../backend/app/llm_catalog.py).
- Billing entitlements -> `_sync_subscription_to_profile` + webhook in [`main.py`](../backend/app/main.py); see [`docs/stripe-launch-runbook.md`](stripe-launch-runbook.md).
- CORS/origins -> `FRONTEND_URL` + `_cors_allowlist` in [`main.py`](../backend/app/main.py); see [`docs/troubleshooting-403-landing.md`](troubleshooting-403-landing.md).
- DB schema -> `_ensure_tables` in [`main.py`](../backend/app/main.py).
- Env/DB isolation -> [`docs/environment-isolation.md`](environment-isolation.md), [`docs/backend-railway-dev-database.md`](backend-railway-dev-database.md).

## Ops & docs index

See the table in [`ROADMAP.md`](../ROADMAP.md#where-things-live).
