# InterviewIntel Go-Live / GTM Tracker

This file is the repo source of truth for launch readiness. The matching Notion tracker lives in the existing **InterviewIntel — Roadmap** database and mirrors these phases for owner, status, and execution tracking.

## Launch Posture

- **Soft launch:** allowed when production env, auth, resume upload, session creation, demo video, basic SEO/share assets, and smoke checks are green.
- **Broader GTM:** blocked until Stripe checkout, webhooks, Pro entitlements, demo video, share cards, and CI/smoke checks are green.
- **Production rule:** no `LANGGRAPH_MEMORY_FALLBACK` in production. If `DATABASE_URL` fails, fix the database instead of falling back to memory.

## Status Summary

| Area | Status | Launch Gate | Notes |
|---|---|---|---|
| Launch tracker | Ready | Soft launch | Repo tracker created; Notion Roadmap mirror and issue-intake page created. |
| Production env reset verification | Blocked in live smoke | Soft launch | `scripts/prod_smoke.py` passes health/frontend but live Railway CORS preflight rejects `https://www.interviewintel.ai`; fix Railway deploy/env before launch. |
| Stripe billing | Implemented; needs Stripe dashboard secrets | Broader GTM | Checkout, webhook, plan entitlement, portal/cancel behavior are wired in code. |
| One-minute demo video | Scripted; needs recording/upload | Soft launch | Landing is guarded until `VITE_DEMO_VIDEO_ID` is set. |
| GTM hygiene | Implemented; Search Console token pending | Soft launch | 1200x630 OG PNG, sitemap, robots, canonical, JSON-LD, favicon set, analytics script. |
| QA/CI/observability | Implemented | Soft launch | CI workflow, backend smoke tests, production smoke script, launch monitoring checklist. |
| Soft launch execution | Ready when external gates pass | Broader GTM | Notion issue intake and launch checklist are ready. |

## Notion Mirror

Created in the existing **InterviewIntel — Roadmap** database:

- [Go-Live: Launch tracker + decision gates](https://www.notion.so/34e90cf4db1181c18166e92c87feb34b)
- [Go-Live: Production env verification after Railway reset](https://www.notion.so/34e90cf4db1181579db1c26d52ac8019)
- [Go-Live: Stripe checkout + entitlements](https://www.notion.so/34e90cf4db1181c7a2e0e8651b917863)
- [Go-Live: 60-second YouTube how-it-works video](https://www.notion.so/34e90cf4db118120995beb54a137995d)
- [Go-Live: SEO/share/analytics hygiene](https://www.notion.so/34e90cf4db118188a6bbd18769e362e6)
- [Go-Live: QA, CI, and observability](https://www.notion.so/34e90cf4db1181f4a882cb1b849ac2f2)
- [Go-Live: Soft launch execution and issue intake](https://www.notion.so/34e90cf4db1181a89c8efb2067209ca7)
- [Launch Issue Intake](https://www.notion.so/34e90cf4db11810381c5d272f6206a63)

## Phase 1 — Production Readiness After Railway Reset

### Railway Backend

- After any variable change, trigger a fresh Railway deploy. Refreshing the dashboard is not enough unless a deploy actually starts and finishes.
- Confirm the backend service source branch is the intended production branch, usually `main`.
- `OPENAI_API_KEY` is set.
- `OPENAI_MODEL` is set or intentionally defaults to the backend default.
- `OPENAI_EXTRACT_MODEL` is set only if a cheaper extraction model is desired.
- `DATABASE_URL` points to the intended Supabase Postgres database.
- `SUPABASE_JWT_SECRET` matches the same Supabase project used by the frontend.
- `FRONTEND_URL` includes the production origin. A bare apex or `www` origin is enough because the backend expands apex and `www` peers.
- `LANGGRAPH_MEMORY_FALLBACK` is absent in production.
- `/api/health` returns `{"status":"ok"}` after deploy.
- Railway logs show `CORS allow_origins` with the real production origin.
- If resume upload still shows `Disallowed CORS origin`, verify Vercel `VITE_API_ORIGIN` points at this same Railway service and not an older backend URL.

### Vercel Frontend

- `VITE_API_ORIGIN` points to the Railway public origin with no trailing slash and no `/api`.
- `VITE_SUPABASE_URL` matches the backend Supabase project.
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` is set.
- `VITE_STRIPE_CHECKOUT_URL` is set only if using a static Stripe Payment Link fallback.
- Production deploy is built from `main`.
- Dev/preview deploy is built from `dev`.

### Supabase / Resend / Google

- Supabase Site URL uses the production domain.
- Supabase Redirect URLs include production, `www`, and dev domains as needed.
- Google OAuth JavaScript origins and redirect URI match Supabase.
- Resend SMTP domain has SPF, DKIM, and DMARC passing.
- Magic link is tested against Gmail, Outlook, iCloud, and Yahoo before broader GTM.

### Production Smoke Test

- Open the production domain in a clean browser profile.
- Sign in with Google.
- Sign out, then sign in with magic link.
- Upload PDF, DOCX, and TXT resumes.
- Create a prep session from a pasted job description.
- Confirm the new session appears on Dashboard.
- Open Prep Detail and verify analysis, questions, answer frameworks, and chat.
- Start role-play and submit one answer.
- Open Settings and confirm plan, saved resumes, and model picker render correctly.
- Hard refresh authenticated routes.
- Confirm no CORS, 401, or 5xx errors in the browser Network tab.

## Phase 2 — Stripe Billing And Entitlements

### Required Backend Work

- Add Stripe dependency.
- Add Stripe settings:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_PRO_MONTHLY`
  - `STRIPE_CUSTOMER_PORTAL_RETURN_URL`
- Add profile columns:
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `stripe_subscription_status`
  - `stripe_price_id`
  - `plan_updated_at`
- Add authenticated checkout endpoint.
- Add authenticated customer portal endpoint.
- Add Stripe webhook endpoint with signature verification.
- Update profile plan idempotently from Stripe subscription events.

### Required Frontend Work

- Use backend checkout endpoint for authenticated upgrades.
- Keep static `VITE_STRIPE_CHECKOUT_URL` only as a fallback for launch operations.
- Make landing pricing, Settings, and UpgradeModal use the same Pro price.
- Show Manage Subscription for Pro users when portal is configured.

### Billing Acceptance Criteria

- A signed-in free user can start checkout.
- Stripe Checkout completes in test mode.
- Webhook updates `profiles.plan` to `pro`.
- Pro model choices become available.
- Daily free-session limit no longer blocks Pro users.
- Customer Portal opens for Pro users.
- Cancelled or unpaid subscriptions downgrade to `free`.

## Phase 3 — One-Minute How-It-Works Video

### Script

| Time | Shot | Voiceover / Caption |
|---|---|---|
| 0-5s | Landing hero and CTA | "InterviewIntel turns a job posting into a focused prep plan." |
| 5-15s | Paste job posting or URL | "Paste the role, or bring in the posting URL." |
| 15-25s | Attach resume and auto-fill | "Attach your resume so the prep is grounded in your real experience." |
| 25-35s | Generated analysis | "Get the likely interview focus, risks, and company-specific angles." |
| 35-45s | Answer framework | "Build structured answers with examples mapped to the role." |
| 45-55s | Role-play | "Practice with an interviewer-style prompt and get scored feedback." |
| 55-60s | Scorecard / CTA | "Walk in with a sharper story. Start your prep in minutes." |

### Recording Checklist

- Use staging or production with non-sensitive demo data.
- Use a demo resume with fictional contact information.
- Hide browser bookmarks, extension icons, console, and tokens.
- Record at 1080p or 4K, crop to the app window.
- Export with readable cursor size and subtle zooms.
- Upload unlisted to YouTube.
- Replace `DEMO_VIDEO_ID` in `frontend/src/pages/Landing.tsx`.
- Verify embed on desktop and mobile.

## Phase 4 — GTM Hygiene

- Add a designed 1200x630 OG image.
- Add `og:image`, `og:image:width`, `og:image:height`, and `twitter:image`.
- Add canonical URL.
- Add `robots.txt`.
- Add `sitemap.xml`.
- Add JSON-LD for `SoftwareApplication` and `Organization`.
- Add favicon sizes: 16, 32, 180, 512, and `.ico`.
- Add Search Console verification.
- Choose analytics: Vercel Analytics, Plausible, PostHog, or Google Analytics.
- Finalize founder/About copy before public GTM.

## Phase 5 — QA, CI, And Observability

- GitHub Actions must run frontend build and lint on `main` and `dev`.
- Playwright smoke tests should run on demand or before larger launches.
- Backend smoke tests should cover:
  - `/api/health`
  - CORS preflight for `/api/parse-resume`
  - PDF/DOCX/TXT parse success
  - authenticated `/api/profile/me`
  - Stripe webhook signature path
- Launch-week monitoring:
  - Vercel deployments
  - Railway logs
  - Supabase auth logs
  - Resend delivery logs
  - Stripe events
  - OpenAI usage
  - optional LangSmith traces
  - optional Sentry/PostHog frontend errors

## Phase 6 — Soft Launch

### Allowed Soft Launch Channels

- Trusted users.
- Founder network.
- Small Reddit replies, not broad posts.
- X thread with demo video.
- Show HN draft only after demo and smoke test are green.

### Broader GTM Gate

Do not broaden GTM until all are true:

- Stripe checkout and entitlements are verified.
- Demo video is embedded and polished.
- Share cards render correctly in Slack, LinkedIn, and X.
- Production smoke test passes.
- No launch-blocking issues remain in Notion.

## Issue Intake

Use Notion for launch issues with:

- Severity: `P0`, `P1`, `P2`, `P3`
- Area: `Auth`, `Resume`, `Session`, `Billing`, `Landing`, `Email`, `Performance`, `Copy`
- Environment: `Prod`, `Dev`, `Local`
- Reproduction steps
- Owner
- Status
- Resolution notes
