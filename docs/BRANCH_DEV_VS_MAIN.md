# Branch comparison: `dev` vs `main` (live)

**Merge direction:** `main` is the production branch for Vercel Production deploys ([`GO_LIVE_GTM.md`](../GO_LIVE_GTM.md)). To ship what is on `dev`, open a PR **from `dev` into `main`** (or merge locally and push `main`). Merging `main` into `dev` only brings updates when `main` has moved ahead; as of the snapshot below, `main` had no unique commits.

**Regenerate this file** after fetching:

```bash
git fetch origin
git log --oneline origin/main..origin/dev
git diff --stat origin/main..origin/dev
```

## Commits on `origin/dev` not on `origin/main`

```
13a33d3 deps(frontend): align @tailwindcss/vite with Vite 8 for npm ci
1b9af27 ui(new-session): soften section banner to lavender so it doesn't compete with the active toggle
64a0a0e feat(profile): persist theme as a DB-backed preference and auto-redirect signed-in visitors
1c57bec ci: stabilize backend test discovery and store product backlog
c011213 ui(new-session): popped indigo section banners and bold add-interviewer CTA
38cc6a6 ui: add standalone resume management
4835d53 ui(new session): premium section headings, drop helper noise
9da6aa2 ui: polish product copy and usage language
7ee8b9c launch: add go-live tracker, billing, smoke checks, and UI polish
5d09dde Merge pull request #2 from Adam-Makaoui/cursorresume-upload-fix-ed29
aa308be Harden resume upload errors and file validation
```

## File-level diff (`git diff --stat origin/main..origin/dev`)

```
 .github/workflows/ci.yml                 |  52 +++
 ARCHITECTURE.md                          |  37 +-
 GO_LIVE_GTM.md                           | 211 +++++++++++
 README.md                                |   8 +
 backend/.env.example                     |   6 +
 backend/app/config.py                    |   6 +
 backend/app/main.py                      | 263 ++++++++++++-
 backend/app/models.py                    |   6 +
 backend/app/resume_store.py              |   4 +-
 backend/pytest.ini                       |   6 +
 backend/requirements.txt                 |   2 +
 backend/tests/test_smoke.py              |  97 +++++
 docs/demo-video-script.md                |  52 +++
 docs/product-opportunities.md            |  79 ++++
 docs/soft-launch-checklist.md            |  48 +++
 docs/stripe-launch-runbook.md            |  40 ++
 frontend/.env.example                    |   5 +
 frontend/README.md                       |   4 +-
 frontend/eslint.config.js                |   4 +
 frontend/index.html                      |  35 +-
 frontend/package-lock.json               | 444 ++++------------------
 frontend/package.json                    |   4 +-
 frontend/public/apple-touch-icon.png     | Bin 0 -> 19342 bytes
 frontend/public/favicon-16.png           | Bin 0 -> 1604 bytes
 frontend/public/favicon-192.png          | Bin 0 -> 21708 bytes
 frontend/public/favicon-32.png           | Bin 0 -> 2141 bytes
 frontend/public/favicon-512.png          | Bin 0 -> 165306 bytes
 frontend/public/favicon.ico              | Bin 0 -> 139635 bytes
 frontend/public/llms.txt                 |  16 +
 frontend/public/og-image.png             | Bin 0 -> 94906 bytes
 frontend/public/og-image.svg             |  30 ++
 frontend/public/robots.txt               |   4 +
 frontend/public/site.webmanifest         |  21 ++
 frontend/public/sitemap.xml              |  13 +
 frontend/src/App.tsx                     |  87 ++++-
 frontend/src/components/AppShell.tsx     |  14 +-
 frontend/src/components/UpgradeModal.tsx |  50 ++-
 frontend/src/components/ui/dialog.tsx    | 125 +++++++
 frontend/src/lib/api.ts                  |  69 +++-
 frontend/src/lib/theme.tsx               |  12 +-
 frontend/src/main.tsx                    |  11 +
 frontend/src/pages/Dashboard.tsx         |  31 +-
 frontend/src/pages/Landing.tsx           |  51 ++-
 frontend/src/pages/NewSession.tsx        | 296 +++++++++------
 frontend/src/pages/Progress.tsx          |  14 +-
 frontend/src/pages/Resumes.tsx           | 370 +++++++++++++++++++
 frontend/src/pages/Settings.tsx          | 613 +++++++++----------------------
 project_specs.md                         |  12 +-
 scripts/prod_smoke.py                    |  68 ++++
 49 files changed, 2306 insertions(+), 1014 deletions(-)
```

*Snapshot generated from a local `git fetch` + diff against `origin/*`. Paths and counts drift as branches move.*
