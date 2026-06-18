# Backend only: Railway + second Supabase database for dev

This doc is for operators who configure the **FastAPI service on Railway** to use a **separate Supabase Postgres** from production. Frontend (Vercel) wiring is in [`environment-isolation.md`](./environment-isolation.md); this file stays backend-only.

## How the app uses one URL per deploy

Each Railway deployment runs one process with one `DATABASE_URL`. That same URL feeds:

- Session and profile tables (`_ensure_tables` on startup in `backend/app/main.py`).
- LangGraph checkpoints (`PostgresSaver` in `backend/app/agent/graph.py`).

There is no in-process “second database” switch: **dev = separate Railway env + dev Supabase project**.

---

## 1. Create a dev Supabase project

1. In Supabase Dashboard, **New project** (e.g. `interviewintel-dev`).
2. **Settings → Database → Connection string** — choose the format suited to a **long-lived server** on Railway (direct or pooler per Supabase docs for your plan).
3. **Settings → API → JWT Secret** — copy the secret for **this** project (not production).

You will paste the connection string into Railway as `DATABASE_URL` and the JWT secret as `SUPABASE_JWT_SECRET`.

---

## 2. Railway: `dev` environment (or duplicate service)

1. In Railway, open your backend service and add a **`dev`** environment (or duplicate the service for dev-only).
2. Point **Source → Branch** at `dev` if previews should track that branch (optional; match your team policy).
3. Set variables for **dev** (do not reuse production values for DB/JWT):

| Variable | Dev value |
|----------|-----------|
| `DATABASE_URL` | Connection string from dev Supabase |
| `SUPABASE_JWT_SECRET` | JWT secret from the **same** dev Supabase project |
| `FRONTEND_URL` | Origins that will call this API (comma-separated): e.g. `http://localhost:5173`, preview URL, `https://dev.yourdomain.com` |
| `OPENAI_API_KEY` | Required |
| `OPENAI_MODEL` | Copy from prod or set explicitly |
| `LANGGRAPH_MEMORY_FALLBACK` | Omit on dev if you want durable checkpoints (same as prod rule) |

Copy other non-secret defaults from production only where appropriate. Stripe keys can remain test-only when you add billing on dev later.

4. **Deploy** after saving variables (env is not reliably live until a deploy finishes).

---

## 3. Verify schema and connectivity

### HTTP

```bash
curl -sS "https://YOUR-DEV-RAILWAY.up.railway.app/api/health"
```

Expect `{"status":"ok"}`.

### Logs (sanitized host)

After deploy, Railway logs should include lines like:

- `Session metadata DB connected (Postgres); DB host: ...`
- `Using PostgresSaver (Postgres); checkpoint DB host: ...`

Both hosts must match the **dev** Supabase DB you expect. If you see the wrong host, fix `DATABASE_URL` on that Railway environment and redeploy.

### SQL (dev Supabase → SQL Editor)

Confirm app tables exist:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('sessions', 'profiles');
```

LangGraph creates checkpoint tables (names depend on LangGraph version); after one session, look for tables containing `checkpoint` in the name:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%checkpoint%';
```

### Authenticated smoke (optional)

From a client configured with **dev** Supabase auth and `VITE_API_ORIGIN` pointing at this Railway URL, sign in and create one prep session. In dev Supabase, confirm a new row in `sessions` with a non-null `user_id` matching the JWT `sub`.

---

## 4. Safety checklist

- [ ] Dev `DATABASE_URL` is **not** the production connection string.
- [ ] Dev `SUPABASE_JWT_SECRET` matches the **same** Supabase project as `DATABASE_URL`.
- [ ] Production Railway environment was **not** edited during this setup (unless intentional).

---

## See also

- Full stack isolation (Vercel + Stripe): [`environment-isolation.md`](./environment-isolation.md)
- Architecture branch/env notes: [`ARCHITECTURE.md`](../ARCHITECTURE.md)
