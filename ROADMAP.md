# InterviewIntel Roadmap

> Single source of truth for what is shipped, in progress, and planned.
> Notion mirrors this file for owners, dates, and status only. When they disagree, this file wins.

## Where things live

| Topic | Canonical doc |
|-------|---------------|
| What we are building next (this file) | `ROADMAP.md` |
| Where any feature/function lives (locator) | [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md) |
| Launch readiness runbook + gates | [`GO_LIVE_GTM.md`](GO_LIVE_GTM.md) |
| Launch-day checklist | [`docs/soft-launch-checklist.md`](docs/soft-launch-checklist.md) |
| Stripe setup (test + live) | [`docs/stripe-launch-runbook.md`](docs/stripe-launch-runbook.md) |
| Dev/prod environment isolation | [`docs/environment-isolation.md`](docs/environment-isolation.md), [`docs/backend-railway-dev-database.md`](docs/backend-railway-dev-database.md) |
| Branch / merge state (dev vs main) | [`docs/BRANCH_DEV_VS_MAIN.md`](docs/BRANCH_DEV_VS_MAIN.md) |
| Landing 403 troubleshooting | [`docs/troubleshooting-403-landing.md`](docs/troubleshooting-403-landing.md) |
| Demo video script | [`docs/demo-video-script.md`](docs/demo-video-script.md) |
| Future product ideas (not launch) | [`docs/product-opportunities.md`](docs/product-opportunities.md) |
| Architecture + deploy reference | [`ARCHITECTURE.md`](ARCHITECTURE.md) |

## Status at a glance

| Area | Status | Gate |
|------|--------|------|
| Session-persistence fix (auth on `/api/sessions*` + backfill `user_id`) | Code done on `dev`; PR open to `main`; not in prod yet | Soft launch |
| Dev/prod isolation | Dev frontend auth fixed; dev Railway backend crash fixed (deploy SUCCESS); dev public domain 502 = Railway port routing (dashboard fix pending) | Soft launch |
| Production live smoke | Pending: intermittent landing 403 + apex/www CORS confirmation | Soft launch |
| GTM hygiene | Done except Google Search Console verification | Soft launch |
| Stripe billing | Implemented in code; needs Stripe dashboard secrets (test + live) | Broader GTM |
| One-minute demo video | Scripted; needs recording + `VITE_DEMO_VIDEO_ID` | Soft launch |
| Auth, Google OAuth, Resend email, custom domain, resume upload, CI | Shipped | - |

## Now (launch gates)

These block soft launch. Ordered.

1. **Ship the session-persistence fix to production** — merge PR [`dev` -> `main`](GO_LIVE_GTM.md), redeploy, then run `scripts/prod_smoke.py` and verify a session still lists after sign-out/in. Risk: `/api/sessions*` now requires a valid JWT (401 for tokenless callers).
2. **Finish dev/prod isolation** — wire the new dev Supabase project into a Railway `dev` environment and Vercel Preview/Development vars. Steps: [`docs/environment-isolation.md`](docs/environment-isolation.md). Rotate the dev Supabase credentials first (they were shared in chat).
3. **Make production smoke green** — diagnose the intermittent landing 403 ([`docs/troubleshooting-403-landing.md`](docs/troubleshooting-403-landing.md)), confirm CORS covers apex + `www`, then run the manual smoke list in [`GO_LIVE_GTM.md`](GO_LIVE_GTM.md).
4. **Stripe billing secrets** — add test-mode secrets on dev and live-mode secrets on prod per [`docs/stripe-launch-runbook.md`](docs/stripe-launch-runbook.md). (Broader GTM gate, but start once dev is isolated.)
5. **Demo video** — record per [`docs/demo-video-script.md`](docs/demo-video-script.md), upload unlisted, set `VITE_DEMO_VIDEO_ID`.
6. **Google Search Console verification** — last remaining GTM hygiene item.

## Next

- Auto-redirect signed-in users `/` -> `/app` (re-apply as its own small change).
- Session-length documentation: short `ARCHITECTURE.md` note on Supabase JWT (1h access + 7d refresh).
- Monetization model tiers: enforce Pro-only models server-side, bundle defaults/limits with Stripe checkout, reflect in pricing copy.
- "How it works" inline clips: per-band Screen.studio loops replacing static mockups.
- Testimonials swap: replace the 3D rotating ring with a horizontal auto-scrolling strip.
- Founder About copy + real headshot.
- LangSmith observability (free tier, tracing LLM calls).

## Later / Backlog

- Landing polish v2 — FAQ section (deferred until real repeat questions arrive).
- YouTube embed upgrade to `lite-youtube-embed` for lazy loading.
- AI SEO: `/llms.txt`, long-form how-it-works, pricing explainer, 3-5 use-case pages.
- UI polish: loading skeletons, error states with retry, transitions.
- Chrome extension: side panel detecting JDs on LinkedIn/Greenhouse.
- Parked hero motion intensifiers (video bg / Lottie / WebGL) — only if A/B shows engagement gain.
- Parked Level 2 isolation hardening, weekly blog engine, and paid ads until organic CAC is known.

## Future product ideas

Larger product bets, scoped only after core launch flows are stable. Full notes in [`docs/product-opportunities.md`](docs/product-opportunities.md): Question Library, Past-answer Journal, Company Prep Dossier, Mock Interview Replay, Shareable Scorecard.

## Recently shipped (condensed)

App shell + sidebar, session deletion, progress tracking, daily free tier, landing redesign with animated hero/aurora, dark-first UI + theme toggle, shadcn/ui product shell, auto-expanding role-play input, voice input, demo session, analysis tab redesign, settings page (subscription/appearance/saved resumes/model picker), live progress updates, session-list optimization, custom domain (`interviewintel.ai` + `dev.` subdomain), Google OAuth, Resend SMTP, multi-origin CORS, branch-based environments.
