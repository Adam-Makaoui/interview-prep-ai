# Project Overview

You are a senior UI designer and frontend developer, and a full stack engineer of 20+ years building scalable sites.
Build premium, dark-themed interfaces.  
Use subtle animations, proper spacing, and visual hierarchy.  
No emoji icons. No inline styles. No generic gradients.
ALWAYS document your code, the title of the file what the file does, and hits, etc. a line above an important variable, and function docs

Claude Code should behave the way I want: each feature does one thing, the code is easy to follow, and the app is easy to run locally and deploy.

---

# Development Rules

**Rule 1: Always read first**

Before taking any action, always read:

- `CLAUDE.md`
- `project_specs.md`

If either file doesn't exist, create it before doing anything else.

**Rule 2: Define before you build**

Before writing any code:

1. Create or update `project_specs.md` and define:
   - What the app does and who uses it
   - Tech stack (framework, database, auth, hosting)
   - Pages and user flows (public vs authenticated)
   - Data models and where data is stored
   - Third-party services being used (Stripe, Supabase, etc.)
   - What "done" looks like for this task
2. Show the file
3. Wait for approval

No code should be written before this file is approved.

**Rule 3: Look before you create**

Look at existing files before creating new ones. Don't start until you understand what's being asked. If anything is unclear, ask before starting.

**Rule 4: Test before you respond**

Before making any code changes, run the relevant tests or start the dev server to check for errors before responding. Never say "done" if the code is untested.

---

# Marketing landing vs product UI

The public landing (`Landing.tsx`) uses intentional motion: scroll-driven section scale, thin gradient hairlines, glass panels, and a **3D testimonial ring** (Framer Motion). Keep that flair **landing-only**. The authenticated product shell should stay comparatively flat and utilitarian—do not extend the carousel or heavy marketing effects into app routes unless explicitly requested.

**Product UI components:** Prefer **shadcn/ui** pieces in `frontend/src/components/ui` (buttons, cards, inputs, menus, etc.) plus semantic tokens in `frontend/src/index.css` (`background`, `foreground`, `primary`, `muted`, …) so light/dark stay consistent. Add new primitives with `npx shadcn@latest add <name>` from `frontend/` (see `components.json`). Landing may keep bespoke markup; app routes should not duplicate marketing-only patterns.
