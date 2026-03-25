# Environment Variable Map

This project now uses **service-specific env files** instead of a single root `.env`.

## Runtime files (local)

| Service | File | Purpose |
|---|---|---|
| Backend (FastAPI) | `backend/.env` | OpenAI, Postgres persistence, JWT verification, CORS |
| Frontend (Vite) | `frontend/.env` | Supabase browser auth client |

## Backend variables (`backend/.env`)

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

## Frontend variables (`frontend/.env`)

| Variable | Required | Why it exists |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL for browser auth client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Preferred | Browser-safe key used by `@supabase/supabase-js` |
| `VITE_SUPABASE_ANON_KEY` | Backward-compatible fallback | Legacy env name still supported by code |
| `VITE_API_ORIGIN` | Production (Vercel) | Railway public origin only; enables cross-origin API calls (see `frontend/src/lib/api.ts`) |
| `VITE_STRIPE_CHECKOUT_URL` | Optional | Upgrade modal checkout link |

## Production deployment mapping

### Railway (backend service)
Set these in Railway project variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `DATABASE_URL`
- `SUPABASE_JWT_SECRET`
- `FRONTEND_URL` = your Vercel app URL (e.g. `https://your-app.vercel.app`)

Optional:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Vercel (frontend service)
Set these in Vercel project variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- **`VITE_API_ORIGIN`** — your Railway public URL **without** a trailing slash (e.g. `https://interviewprep-production.up.railway.app`). The frontend calls this origin for `/api/*` (see `frontend/src/lib/api.ts`). **Prefer this** so you do not have to commit a changing Railway hostname in git.
- `VITE_STRIPE_CHECKOUT_URL` (when billing is enabled)

Optional (same-origin `/api` instead of `VITE_API_ORIGIN`): add a Vercel rewrite in `frontend/vercel.json` mapping `/api/:path*` → `https://<railway-host>/api/:path*` (before the SPA `/(.*)` rule) and omit `VITE_API_ORIGIN`.

## Request/auth data flow

1. Browser signs in with Supabase using `VITE_SUPABASE_URL` + browser-safe key.
2. Browser receives access token and sends it as `Authorization: Bearer <token>` to FastAPI.
3. FastAPI validates token with `SUPABASE_JWT_SECRET`.
4. FastAPI reads/writes sessions/profiles in Postgres using `DATABASE_URL`.
5. Frontend consumes `/api` responses and renders dashboard, prep, scorecard, and role-play.

## Tonight go-live checklist (Phase 1)

1. **Push** the latest commit to the branch Vercel/Railway deploy from.
2. **Railway:** New service from this repo (root = monorepo root; `railway.toml` + `nixpacks.toml` apply). Variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `DATABASE_URL` (direct `db.<ref>.supabase.co` often works on Railway IPv6; URL-encode password), `SUPABASE_JWT_SECRET`, `FRONTEND_URL` = exact Vercel origin. **Do not** set `LANGGRAPH_MEMORY_FALLBACK` in production.
3. **Verify** `https://<railway-host>/api/health` returns `{"status":"ok"}`.
4. **Vercel:** Project with root directory `frontend`. Variables: `VITE_SUPABASE_URL`, anon JWT key, **`VITE_API_ORIGIN`** = same Railway URL as step 3 (scheme + host only).
5. **Supabase → Authentication → URL configuration:** Site URL = Vercel production URL; Redirect URLs include `https://<vercel-host>/**`.
6. **Smoke:** Open Vercel URL → login magic link → create one session → see it on the dashboard.

## Phase 2 (defer)

Custom domain, Stripe, richer landing, roadmap features from your Notion plan — after the Phase 1 smoke test above passes.
