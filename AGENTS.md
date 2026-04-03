# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

InterviewPrep AI is a monorepo with two services:
- **Backend** (`/backend`): Python FastAPI + LangGraph AI agent (port 8000)
- **Frontend** (`/frontend`): React + Vite + TypeScript + Tailwind CSS (port 5173)

### Running services

See `README.md` "Quick Start" and "Restarting" sections for the canonical commands. Key notes:

- **Backend**: `cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000`
- **Frontend**: `cd frontend && npm run dev`
- The Vite dev server proxies `/api` requests to `http://localhost:8000` (configured in `vite.config.ts`).

### Authentication caveat

Without Supabase configured (`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` unset in frontend, `SUPABASE_JWT_SECRET` unset in backend):
- The **backend** allows anonymous access (returns `user_id: "anonymous"`).
- The **frontend** `ProtectedRoute` still redirects to `/login` because the Supabase client is `null` and `user` is `null`. To test protected frontend routes locally without Supabase, you must either provide real Supabase credentials in `frontend/.env` or temporarily bypass the auth check in `ProtectedRoute` (revert before committing).

### Environment variables

- `backend/.env` — copy from `backend/.env.example`. `OPENAI_API_KEY` is required for any AI functionality. All other vars are optional for local dev (DB, Supabase auth fall back gracefully).
- `frontend/.env` — copy from `frontend/.env.example`. Only needed if testing Supabase auth.

### Lint / Type-check / Test

| Command | Directory | Notes |
|---------|-----------|-------|
| `npm run lint` | `frontend/` | ESLint; repo has some pre-existing lint warnings/errors |
| `npx tsc -b --noEmit` | `frontend/` | TypeScript type check (clean) |
| `npm run test` | `frontend/` | Playwright E2E tests (requires `npx playwright install` first) |
| `npm run build` | `frontend/` | Full production build (tsc + vite build) |

### System dependency note

The VM needs `python3.12-venv` (`sudo apt-get install -y python3.12-venv`) to create the backend virtualenv. The update script handles this.
