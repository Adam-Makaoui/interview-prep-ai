---
name: UX and Feature Improvements
overview: Fix the role-play text input, add a demo session for new users, implement voice input via Web Speech API, enable live progress updates after each Q&A round, improve session loading performance, redesign the Analysis tab, add a scroll gradient to the landing page, migrate to a light Apple-style color scheme, and update the README roadmap.
todos:
  - id: light-theme
    content: Migrate entire app to a light Apple-style color scheme (white backgrounds, subtle shadows, dark text)
    status: completed
  - id: textarea
    content: Replace input with auto-expanding textarea in ChatWindow.tsx
    status: completed
  - id: demo-session
    content: Add static demo session for new users (DummyCompany) in Dashboard + PrepDetail
    status: completed
  - id: voice-input
    content: Add Web Speech API mic button to ChatWindow for voice-to-text input
    status: completed
  - id: analysis-redesign
    content: "Redesign Analysis tab: add industry/products/problem fields, competitor logos, better layout for tips"
    status: completed
  - id: scroll-gradient
    content: Add scroll-driven background gradient to the landing page
    status: completed
  - id: live-progress
    content: Write running_scores to DB after each Q&A round + update /api/profile/progress to read them
    status: completed
  - id: optimize-list
    content: Cache session metadata in sessions table so list endpoint skips checkpoint loads
    status: completed
  - id: settings-page
    content: Add Settings page with subscription management, contact support, and optional theme toggle
    status: completed
  - id: readme-update
    content: "Update README roadmap: mark landing redesign as shipped, add new backlog items"
    status: completed
isProject: false
---

# UX and Feature Improvements

## 1. Auto-expanding textarea for role-play chat

**Problem**: The role-play input in [ChatWindow.tsx](frontend/src/components/ChatWindow.tsx) is a single-line `<input type="text">` (line ~395). Long answers are cramped and hard to read.

**Fix**: Replace `<input>` with a `<textarea>` that auto-expands as the user types. Use a simple `useRef` + `scrollHeight` pattern (no external dependency):

```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null);
const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setInput(e.target.value);
  const el = e.target;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`; // cap at ~6 lines
};
```

- Starts at 1-line height, grows up to ~6 lines, then scrolls internally
- Enter submits (same as now), Shift+Enter inserts a newline
- Minimal change: swap the element, add the resize handler, keep all existing styling

---

## 2. Demo / dummy session for new accounts

**Problem**: New users land on an empty dashboard with nothing to click. The user wants a pre-seeded "DummyCompany" session so people can explore the app immediately.

**Approach**: Seed a static demo session into the frontend that renders when the user has zero real sessions. This avoids needing actual LangGraph state or DB rows for a fake session.

- Add a `DEMO_SESSION` constant in [Dashboard.tsx](frontend/src/pages/Dashboard.tsx) with company="DummyCompany", role="Solutions Engineer", stage="Hiring Manager", mode="prep", status="complete", and representative mock data (questions, answers, scores)
- When `sessions.length === 0`, show the demo card with a "Demo" badge and slightly different styling (dashed border or subtle label)
- Clicking it navigates to `/app/prep/demo`
- In [PrepDetail.tsx](frontend/src/pages/PrepDetail.tsx), detect `id === "demo"` and render the static demo data without hitting the API
- No backend changes needed -- this is entirely client-side

---

## 3. Voice input via Web Speech API

**Problem**: Typing long answers during role-play is slow. Voice input lets users practice answering as they would in a real interview.

**Approach**: Use the browser-native `SpeechRecognition` API (Chrome, Edge, Safari) with a microphone button in the chat input area.

- Add a mic toggle button next to the textarea in [ChatWindow.tsx](frontend/src/components/ChatWindow.tsx)
- When active: start `SpeechRecognition`, stream interim results into the textarea in real-time, show a pulsing indicator
- When stopped or on final result: populate the textarea with the transcript (user can edit before sending)
- Handle unsupported browsers gracefully (hide the mic button, no errors)
- No external dependencies -- `SpeechRecognition` is built into modern browsers
- Future upgrade path: add OpenAI Whisper API for better accuracy (separate task, requires backend endpoint)

---

## 4. Live progress updates after each Q&A round

**Problem**: The "My Progress" page (`/api/profile/progress`) only reads `sessions.final_scores`, which is written when a session completes. Users want to see scores update after every answer.

**Approach**: Write partial scores to the DB after each evaluation step, not just at session end.

- In [backend/app/main.py](backend/app/main.py): after `submitAnswer` and `continueSession` return successfully, call a new `_save_running_scores(session_id, result)` that writes `running_competency_scores` + `skill_averages` to a `running_scores JSONB` column on the `sessions` table
- Modify `/api/profile/progress` to also consider `running_scores` from in-progress sessions (union with `final_scores` from completed ones)
- When a session completes, `_save_final_scores` still writes `final_scores` as before (the canonical "done" scores)
- DB migration: `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS running_scores JSONB` in `_ensure_tables()`

---

## 5. Optimize session list loading

**Problem**: `GET /api/sessions` calls `_get_state()` (LangGraph checkpoint read from Postgres) for **every** session in a loop. Each call is a separate DB round-trip. With N sessions, this is N sequential checkpoint loads.

**Approach**: Cache essential session metadata so the list endpoint doesn't need to load full LangGraph state.

- Add columns to the `sessions` table: `status TEXT`, `question_count INTEGER`, `mode TEXT` (some of these already exist)
- After every state-changing operation (create, answer, continue, finish), update these cached columns alongside existing `_update_session_meta`
- The `list_sessions` endpoint reads **only from the `sessions` table** (single query, no checkpoint loads)
- Individual `get_session/{id}` still loads full state from checkpointer (needed for chat history, questions, etc.)
- This turns an O(N) checkpoint-load loop into a single SQL query

---

## 6. Update README roadmap

Mark the landing page redesign as shipped and add new items to backlog.

- Move "Landing Page Redesign" from Backlog to Shipped with description of what was built (hero, scroll animations, Framer Motion, mockups, social proof, pricing, login X button, sign-out redirect)
- Add new backlog items: auto-expanding textarea, voice input, live progress updates, demo session, session list optimization
- Remove items that are now redundant

---

## 7. Notion roadmap (deferred)

The Notion MCP authentication timed out. Once you re-authenticate (you'll see an OAuth popup next time I try), I can:
- Search for the roadmap database
- Update phase names (keep Phase 1 "Quick Wins/MVP", Phase 2 "Production", merge Phase 3 into others or rename, Phase 4 "Monetization")
- Create a Kanban board view (Status-based grouping)
- Mark completed items

For now, the README serves as the source of truth. Notion can be synced in a follow-up session.

---

## 8. Light Apple-style color scheme (across entire app)

**Problem**: The current dark-mode-only design (gray-950 backgrounds, gray-900 cards) feels heavy. The user wants a lighter, cleaner aesthetic closer to Apple's design language.

**Scope**: This touches every page and component. The migration order matters -- do it first so all subsequent work uses the new palette.

**Design tokens (before -> after)**:

- Page background: `bg-gray-950` -> `bg-white` / `bg-gray-50`
- Card background: `bg-gray-900/60` -> `bg-white` with `shadow-sm` + `border border-gray-200`
- Primary text: `text-white` / `text-gray-300` -> `text-gray-900` / `text-gray-600`
- Secondary text: `text-gray-500` -> `text-gray-400`
- Borders: `border-gray-800/60` -> `border-gray-200`
- Input backgrounds: `bg-gray-900` -> `bg-gray-50` or `bg-white`
- Accent colors: keep indigo-500/600 as primary, emerald/amber/red for semantic colors
- Sidebar ([AppShell.tsx](frontend/src/components/AppShell.tsx)): light gray (`bg-gray-50`) with a subtle left border, not dark

**Files affected**:

- `frontend/src/pages/Landing.tsx` -- hero, feature sections, pricing, footer
- `frontend/src/pages/Login.tsx` -- login card
- `frontend/src/pages/Dashboard.tsx` -- session cards, empty state
- `frontend/src/pages/PrepDetail.tsx` -- tabs, analysis sections, all cards
- `frontend/src/pages/NewSession.tsx` -- form inputs, buttons
- `frontend/src/pages/Progress.tsx` -- charts, stat cards
- `frontend/src/components/AppShell.tsx` -- sidebar
- `frontend/src/components/ChatWindow.tsx` -- chat bubbles, input
- `frontend/src/components/QuestionCard.tsx` -- Q&A cards
- `frontend/src/components/SkillsScorecard.tsx` -- scorecard

**Approach**: Do a systematic find-and-replace pass per file, then manual visual review. Key patterns:
- `bg-gray-950` -> `bg-white` or `bg-gray-50`
- `bg-gray-900` -> `bg-white`
- `bg-gray-800` -> `bg-gray-100`
- `text-white` -> `text-gray-900` (for headings)
- `text-gray-300` -> `text-gray-700` (for body)
- `border-gray-800` / `border-gray-700` -> `border-gray-200`
- Add `shadow-sm` to cards that had border-only styling

---

## 9. Scroll-driven background gradient on landing page

**Problem**: The landing page background is flat white (after light theme migration). Adding a subtle gradient that shifts as users scroll creates visual depth and guides the eye downward.

**Approach**: Use Framer Motion's `useScroll` + `useTransform` to interpolate a CSS gradient based on scroll progress.

```tsx
const { scrollYProgress } = useScroll();
const bgGradient = useTransform(
  scrollYProgress,
  [0, 0.3, 0.6, 1],
  [
    "linear-gradient(to bottom, #f8fafc, #ffffff)",       // top: cool slate
    "linear-gradient(to bottom, #ffffff, #eef2ff)",       // features: hint of indigo
    "linear-gradient(to bottom, #eef2ff, #f0fdf4)",       // social proof: hint of green
    "linear-gradient(to bottom, #f0fdf4, #f8fafc)",       // pricing: back to neutral
  ]
);
```

- Wraps the entire landing page in a `motion.div` with `style={{ background: bgGradient }}`
- Subtle pastel transitions between sections (slate -> indigo -> green -> slate)
- Pure Framer Motion, no extra deps

---

## 10. Redesign the Analysis tab

**Problem**: The current Analysis tab in [PrepDetail.tsx](frontend/src/pages/PrepDetail.tsx) renders data in a flat list of cards. The user wants richer company intel (products, industry, problem they solve), competitor logos, and a more structured tips layout.

### Backend changes ([nodes.py](backend/app/agent/nodes.py))

Extend the `company_intel` object in the LLM prompt to include three new fields:

```
"industry": string (e.g. "E-commerce", "FinTech", "DevTools"),
"main_products": array of { "name": string, "description": string } (2-4 items),
"problem_they_solve": one sentence
```

Also add `"domain"` field to each competitor so we can fetch logos:
```
"competitors": array of { "name": string, "one_liner": string, "domain": string }
```

### Frontend changes ([PrepDetail.tsx](frontend/src/pages/PrepDetail.tsx))

Redesign the Analysis tab with distinct visual sections:

**Company Overview card** (new layout):
- Company name + industry pill + size band badge in a header row
- "What they do" paragraph (from `problem_they_solve`)
- Products grid (2-col, each product as a mini-card with name + description)
- Market position as a callout

**Competitors section** (enhanced):
- Each competitor gets a favicon/logo via `https://www.google.com/s2/favicons?domain={domain}&sz=32` (free, no API key)
- Horizontal card layout with logo + name + one-liner
- Fallback to initials circle if domain is missing

**Interview Tips section** (redesigned):
- Numbered cards (1, 2, 3...) with a subtle accent left-border instead of plain text blocks
- Each tip gets a small icon or number badge on the left
- More visual hierarchy: bold first sentence, lighter detail

**JD Fit section**: Keep the current 2-col aligned/gaps/risks layout -- it's already solid

---

## 11. Settings page

**Problem**: There's no place for users to manage their subscription, contact support, or adjust preferences. The sidebar currently has Dashboard, New Session, and My Progress.

**Approach**: Add a new `/app/settings` route with a Settings page and a nav entry in the sidebar.

### Sidebar addition ([AppShell.tsx](frontend/src/components/AppShell.tsx))

Add a "Settings" item to `NAV_ITEMS` with a gear icon, placed at the bottom of the nav list (visually separated from the main nav items, above the sign-out button).

### Route ([App.tsx](frontend/src/App.tsx))

Add `<Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />`.

### Settings page (`frontend/src/pages/Settings.tsx` -- new file)

Three sections:

**Subscription**
- Show current plan (Free / Pro) from `getProfile()` response
- If Free: "Upgrade to Pro" CTA card with the same pricing info from the landing page
- If Pro: show active subscription status, next billing date placeholder
- No actual Stripe integration yet -- just the UI structure. The upgrade button can link to a "coming soon" state or the same UpgradeModal used elsewhere

**Contact Support**
- Simple card with a "mailto:" link (e.g. `support@interviewprepai.com` or your email)
- Optional: a small contact form (name, message) that could POST to a backend endpoint or just open the email client
- Keep it minimal -- just a way for users to reach out

**Theme toggle (low priority)**
- A toggle switch for light/dark mode
- Uses `localStorage` to persist preference, a React context (`ThemeProvider`) to apply it
- If building: wrap the app in a `ThemeProvider` that adds/removes a `dark` class on `<html>`, and use Tailwind's `dark:` variant for all color classes
- **If this adds too much complexity**: skip the toggle and ship light-only. The toggle can be added later since Tailwind's `dark:` prefix approach is additive -- we just add `dark:bg-gray-950` etc. alongside the light classes when ready

---

## Files changed (full list)

- `frontend/src/pages/Landing.tsx` -- light theme + scroll gradient
- `frontend/src/pages/Login.tsx` -- light theme + X button (already done)
- `frontend/src/pages/Dashboard.tsx` -- light theme + demo session
- `frontend/src/pages/PrepDetail.tsx` -- light theme + Analysis tab redesign
- `frontend/src/pages/NewSession.tsx` -- light theme
- `frontend/src/pages/Progress.tsx` -- light theme
- `frontend/src/components/AppShell.tsx` -- light sidebar
- `frontend/src/components/ChatWindow.tsx` -- light theme + textarea + voice input
- `frontend/src/components/QuestionCard.tsx` -- light theme
- `frontend/src/components/SkillsScorecard.tsx` -- light theme
- `backend/app/agent/nodes.py` -- extend analysis prompt (industry, products, problem, competitor domains)
- `backend/app/main.py` -- running_scores column, cached metadata for list endpoint
- `frontend/src/pages/Settings.tsx` -- new Settings page (subscription, support, optional theme toggle)
- `frontend/src/App.tsx` -- add /app/settings route
- `README.md` -- roadmap update
