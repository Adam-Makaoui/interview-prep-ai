# Soft Launch Checklist

Use this checklist on launch day. Keep issue status in Notion and keep final go/no-go notes in `GO_LIVE_GTM.md`.

## Go / No-Go Gates

- Production deploy is on the intended commit.
- Railway `/api/health` passes.
- `scripts/prod_smoke.py` passes against the production Railway URL.
- Google sign-in passes.
- Magic-link sign-in passes.
- Resume upload passes for PDF, DOCX, and TXT.
- Prep session creation passes.
- Role-play submit/continue passes.
- Stripe test-mode checkout and webhook entitlement update pass.
- Demo video is embedded with `VITE_DEMO_VIDEO_ID`.
- Share card preview renders in Slack, LinkedIn, and X.
- No P0/P1 launch issues are open in Notion.

## Launch Channels

- Trusted users and founder network first.
- One X thread with the demo video.
- Reddit replies only where the product directly answers an active question.
- Show HN draft after the first two channels surface no launch blockers.
- Product Hunt only after paid flow, demo, and onboarding feel stable.

## Issue Intake Template

- Severity: `P0`, `P1`, `P2`, `P3`
- Area: `Auth`, `Resume`, `Session`, `Billing`, `Landing`, `Email`, `Performance`, `Copy`
- Environment: `Prod`, `Dev`, `Local`
- Steps to reproduce
- Expected behavior
- Actual behavior
- Owner
- Status
- Resolution notes

## Launch-Day Monitoring

- Vercel deployments and function/build logs.
- Railway service logs and restart count.
- Supabase Auth logs and Postgres connection errors.
- Resend delivery logs for magic links.
- Stripe events and webhook delivery status.
- OpenAI usage and errors.
- Browser console/network issues reported by users.
