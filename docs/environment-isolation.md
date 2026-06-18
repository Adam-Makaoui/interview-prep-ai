# Dev vs production environment isolation

This checklist is for operators (Supabase, Vercel, Railway). For **Railway + Supabase only** (no Vercel), see [`backend-railway-dev-database.md`](./backend-railway-dev-database.md).

The app assumes **one Supabase project per backend**: `DATABASE_URL`, `SUPABASE_JWT_SECRET`, and the frontend `VITE_SUPABASE_*` keys must all refer to the **same** project, or sessions will not list correctly after login.

## 1. Create a dev Supabase project

1. Create a new Supabase project (e.g. `interviewintel-dev`).
2. Copy **Database** connection string into Railway dev as `DATABASE_URL` (use the pooled URI if recommended for serverless-style workloads).
3. Copy **JWT Secret** (Settings → API → JWT Settings) into Railway dev as `SUPABASE_JWT_SECRET`.
4. Copy **Project URL** and **anon** / **publishable** key for Vercel Preview/Development only.
5. Apply the same schema as production (run your SQL migrations or mirror from prod using your normal process).

## 2. Railway: dev environment (or separate service)

Mirror the production service variables with **dev** values:

| Variable | Dev value |
|----------|-----------|
| `DATABASE_URL` | Dev Supabase Postgres |
| `SUPABASE_JWT_SECRET` | Dev project JWT secret |
| `FRONTEND_URL` | Dev/preview origins, e.g. `https://dev.interviewintel.ai` and/or your Vercel preview pattern |
| `OPENAI_API_KEY` | Same or a separate key per policy |
| Stripe | **Test mode** keys, test price id, test webhook secret (see [stripe-launch-runbook.md](./stripe-launch-runbook.md)) |

Do **not** set `LANGGRAPH_MEMORY_FALLBACK=1` on shared staging unless you accept ephemeral graph state.

## 3. Vercel: scope variables by environment

In Vercel → Project → Settings → Environment Variables:

- **Production:** production Supabase URL + key; `VITE_API_ORIGIN` = production Railway URL (no `/api` suffix).
- **Preview** and **Development:** dev Supabase URL + key; `VITE_API_ORIGIN` = dev Railway URL.

Avoid assigning one value to **All** environments unless prod and dev are intentionally identical (not recommended).

## 4. CORS and apex/www

`FRONTEND_URL` is parsed in the backend to allow apex/`www` pairs for bare two-label domains. If you still see preflight failures for `https://www.example.com`, list **both** origins explicitly in `FRONTEND_URL` (comma-separated).

## 5. Verification

- Sign in on a **Preview** deployment; create a session; confirm a row appears in the **dev** Supabase `sessions` table with `user_id` equal to the auth user UUID (`sub`).
- Confirm production DB receives no traffic from that preview URL API calls (inspect prod `sessions` unchanged).
