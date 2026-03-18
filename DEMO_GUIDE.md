# InterviewPrep AI — Demo & Architecture Guide

> **Purpose**: This document prepares you for a 15-minute presentation of InterviewPrep AI. It covers the problem, architecture, what makes this agentic, technical choices, a live demo script, and how this pattern applies to DataRobot customer problems.

---

## 1. The Problem (2 min)

Interview prep today is **fragmented and generic**:

- Candidates Google "top 10 behavioral questions" — none are tailored to their specific JD, stage, or interviewers.
- Existing tools (ChatGPT, mock interview apps) treat every interview the same — a phone screen with a recruiter gets the same questions as a technical deep-dive with a VP of Engineering.
- There's no feedback loop — you practice in a vacuum with no scoring or coaching.

**InterviewPrep AI solves this** by building an agentic system that reasons through the job description, understands the interview stage, and generates contextually appropriate questions, answer frameworks, and interactive practice with real-time feedback.

---

## 2. Architecture Deep Dive (5 min)

### The 7-Node LangGraph State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LangGraph State Machine                      │
│                                                                     │
│  START ──► [Parse JD] ──► [Analyze Role] ──► [Generate Questions]  │
│                                                      │              │
│                                          ┌───────────┴──────────┐  │
│                                          │ route_by_mode        │  │
│                                          ▼                      ▼  │
│                                    [Draft Answers]      [Roleplay Ask] │
│                                          │                      │  │
│                                          ▼              ┌───────┘  │
│                                    [Summary] ◄──────── [Evaluate]  │
│                                          │              │     ▲   │
│                                          ▼              │     │   │
│                                         END             └─────┘   │
│                                                     check_continue │
└─────────────────────────────────────────────────────────────────────┘
```

### What Each Node Does

| Node | Responsibility | Key Design Decision |
|------|---------------|-------------------|
| **Parse JD** | Extracts company/role from raw text or URL | Idempotent — skips LLM if fields are already filled |
| **Analyze Role** | Generates key skills, culture signals, interview tips | Builds the context chain — everything downstream uses this output |
| **Generate Questions** | Creates 8-10 stage-specific questions | Injects `STAGE_CONTEXT` — a recruiter screen generates different questions than a technical round |
| **Draft Answers** | Writes STAR-method answer frameworks (prep mode) | Personalizes against the user's resume |
| **Roleplay Ask** | Presents questions as a realistic interviewer persona | Does NOT reveal it's AI — creates immersive practice |
| **Evaluate** | Scores answers 1-10 with coaching feedback | Uses `interrupt_before` — the graph PAUSES here waiting for user input |
| **Summary** | Synthesizes all feedback into a readiness scorecard | Aggregates individual scores into holistic assessment |

### Conditional Edges (the "agent" part)

1. **`route_by_mode`** — After question generation, the graph autonomously routes to either the prep path (draft answers → summary) or the roleplay path (ask → evaluate → loop). This is a *decision*, not just piping data through.

2. **`check_continue`** — After evaluating each roleplay answer, the graph decides whether to ask the next question or wrap up with a summary. The agent tracks state (`current_q_index`) and makes the routing decision.

### Human-in-the-Loop (Two-Pause Pattern)

```python
agent = build_graph().compile(
    checkpointer=checkpointer,
    interrupt_before=["evaluate"],   # PAUSE 1: user types their answer
    interrupt_after=["evaluate"],    # PAUSE 2: user reads their feedback
)
```

This creates a two-pause roleplay loop:
1. **Pause 1** (`interrupt_before`): Graph stops after `roleplay_ask` presents a question. User types their answer. API call `POST /sessions/:id/answer` resumes the graph into `evaluate`.
2. **Pause 2** (`interrupt_after`): Graph stops after `evaluate` scores the answer. User reads their feedback card. API call `POST /sessions/:id/continue` resumes into the next `roleplay_ask`.

This is fundamentally different from a batch pipeline — it's a stateful, interruptible conversation where the user controls the pace.

---

## 3. What Makes This Agentic (3 min)

This is **not** a simple LLM wrapper. Here's what differentiates it:

### Multi-Step Reasoning
Each node builds on the output of previous nodes. The analysis informs question generation, which informs answer drafting. The LLM doesn't see raw data — it sees progressively enriched context.

### Autonomous Routing
The `route_by_mode` and `check_continue` conditional edges are decisions the agent makes based on state. The graph topology changes based on input (prep vs. roleplay), not just the prompts.

### Context Accumulation
State grows across nodes: `parse → analyze → generate`. By the time we generate questions, the LLM has company culture signals, key skills, role focus, and stage context — all synthesized from the raw JD.

### Stage-Aware System Prompts
The `STAGE_CONTEXT` mapping ensures a phone screen generates "tell me about yourself" questions while a technical round generates system design questions. For **custom stages** (e.g., "case study"), an LLM fallback generates the stage description on the fly.

### Iterative Feedback Loop
In roleplay mode, the evaluate → ask loop creates a genuine coaching cycle. Each answer gets scored, the score feeds into the running summary, and the final readiness assessment reflects the entire practice session.

### Panel Interview Awareness
When interviewers are provided, the analysis node generates `interviewer_focus` areas based on their titles, and these flow into question generation. A "VP Engineering" triggers different questions than a "Recruiter."

---

## 4. Technical Choices & Trade-offs (2 min)

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| **Agent framework** | LangGraph | ReAct / CrewAI / plain LangChain | LangGraph gives explicit flow control. ReAct is great for tool-use agents, but our problem is a structured pipeline with branches and human-in-the-loop — a state machine, not a reasoning loop. |
| **LLM output** | JSON-mode (`response_format`) | Function calling / tool use | Our nodes are deterministic steps, not autonomous tool decisions. JSON-mode is simpler, faster, and equally structured. |
| **State persistence** | MemorySaver (in-memory) | SQLiteSaver / PostgreSQL | Demo-appropriate. MemorySaver is zero-config. Production would use SQLiteSaver (single-binary) or Postgres (multi-server). The switch is one line — swap the checkpointer. |
| **Backend** | FastAPI | Flask / Django | FastAPI gives us async support, automatic OpenAPI docs, and Pydantic validation. Perfect for an API-first architecture. |
| **Frontend** | React + Vite + Tailwind | Next.js | Vite is faster to develop with for a demo. Next.js adds SSR/routing complexity we don't need yet. The React components are portable to Next.js for production. |
| **URL scraping** | httpx + BeautifulSoup | Playwright / Selenium | Lightweight and fast. LinkedIn will block headless browsers anyway — for production we'd use a scraping API or browser extension. |

---

## 5. Live Demo Script (2 min)

### Setup
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:5173`

### Demo Flow

1. **Land on Dashboard** — Show the session history (empty or with previous sessions). Point out "Back to Sessions" navigation.

2. **Click "+ New Session"** — Show the form

3. **Paste a Job Description** — Use a real JD (DataRobot SE role works well)
   - Toggle between "Paste Text" and "Paste URL" modes
   - Click **"Auto-Fill Company, Role & Stage"** — watch it extract fields
   - Point out that the user can **edit** the auto-filled values

4. **Upload Resume** — Click "Upload PDF / DOCX" to upload a resume file
   - "The backend uses pdfplumber to extract text from the PDF, then I can edit it and save as my default"
   - Or show the "Saved resume loaded" state if already saved

5. **Add an Interviewer** — Click "+ Add Interviewer", enter a name
   - Click the **search icon** — watch it auto-lookup their title via DuckDuckGo
   - "This uses web search + LLM extraction — no LinkedIn API key needed"

6. **Set Stage** — Pick "Hiring Manager" or select "Other" and type a custom stage

7. **Start Prep Session** — Click submit
   - Watch the **live SSE progress**: Parsing → Analyzing → Generating
   - **As soon as questions are generated, you land on the session page** — no waiting for answer drafting
   - "Notice I'm already seeing questions while answer frameworks are still being drafted in the background"

8. **Show Q&A Tab** — Point out:
   - "Drafting answer frameworks..." spinner (if answers aren't ready yet)
   - Questions appear with **theme badges** (Technical Depth, Soft Skills, etc.)
   - **"Likely: [interviewer name]"** badges showing which interviewer would ask each question
   - Click a question to **expand** — shows answer framework, key points, timing guidance, response strategy, red flags
   - "Each card is collapsible — collapsed shows the summary, expanded shows the full coaching breakdown"

9. **Show Analysis Tab** — Point out:
   - Key Skills (extracted from JD, not hardcoded)
   - Culture Signals (inferred from JD language)
   - Interviewer Focus Areas (generated because we added an interviewer)

10. **Switch to Role-Play** — Click the Role-Play tab, then "Start Practice Interview"
    - Answer one question naturally
    - Show the **feedback card**: score badge (color-coded), strengths, improvements, improved answer, tip
    - "Notice I have a 'Next Question' button — the graph paused AFTER evaluating so I can read my feedback first"

11. **If time**: Answer 5 questions and show the **checkpoint card** with score trends and "Continue Drilling" vs "Finish & See Summary"

### Talking Points During Demo
- "The graph paused here waiting for my answer — that's `interrupt_before` in action"
- "After I got feedback, it paused AGAIN — that's `interrupt_after`. Two pauses create the feedback loop."
- "Notice the questions changed because I picked a different stage — that's the STAGE_CONTEXT routing"
- "I navigated here before answers were ready — the backend is still drafting in a background thread, and the page polls every 2 seconds"
- "The auto-fill is a separate lightweight LLM call, not a full session creation"
- "Each question says which interviewer would likely ask it — that's the panel awareness"

---

## 6. Challenges & Learnings

### Real Issues Faced

1. **Pydantic v2 + pydantic-settings compatibility** — `extra_forbidden` mode rejected unexpected env vars. Solution: cleaned `.env` to only include expected variables.

2. **LangGraph state re-routing for mode switching** — When switching from prep to roleplay mid-session, `agent.invoke()` wouldn't re-enter the graph because it was at `END`. Solution: `agent.update_state(as_node="generate")` positions the state as if `generate` just completed, letting the conditional edge re-fire.

3. **Git worktree sync** — Cursor uses worktrees internally, so the IDE displayed a different directory than the agent was modifying. Solution: `git fetch origin && git reset --hard origin/main` in the main repo.

4. **Custom stage context** — Hardcoding all possible interview stages doesn't scale. Solution: LLM fallback that generates a stage description for any unknown stage, cached in `stage_context` state field.

---

## 7. Vision: DataRobot Customer Application

The core pattern here — **a LangGraph state machine with domain-specific nodes, conditional routing, and human-in-the-loop** — applies directly to DataRobot customer problems:

### Pattern: Domain-Specific Agentic Workflow

| Customer Problem | How This Pattern Applies |
|-----------------|------------------------|
| **Customer Onboarding Agent** | Parse account data → analyze requirements → generate onboarding plan → interactive Q&A with customer → progress summary |
| **Support Ticket Triage** | Parse ticket → analyze severity/category → route to correct team (conditional edge) → draft response → human review (interrupt_before) |
| **Compliance Review Workflow** | Parse document → check against regulatory rules (multiple analysis nodes) → flag issues → human approval gate → generate report |
| **Sales Discovery Agent** | Parse prospect info → analyze company/industry → generate discovery questions → roleplay practice for AEs → feedback loop |
| **ML Model Monitoring** | Parse drift alert → analyze feature importance changes → generate remediation options (conditional: retrain vs. adjust threshold) → human decision → execute |

### Key Insight for DataRobot

The differentiator isn't the LLM — it's the **state machine around the LLM**. Any customer can call GPT-4. What they can't easily build is:
- Conditional routing that changes behavior based on accumulated context
- Human-in-the-loop gates at the right points in the workflow
- Session persistence that survives across interactions
- Multi-node context chains where each step enriches the next

This is exactly what DataRobot's solutions engineering team would help customers build — and LangGraph makes it possible with production-ready primitives (checkpointers, interrupt points, conditional edges).

---

## 8. Where Everything Happens — Code Map

If someone says "show me where X happens in the code", here's your answer:

### File Structure
```
backend/
  app/
    config.py          ← loads OPENAI_API_KEY from .env
    models.py          ← Pydantic request/response models
    main.py            ← FastAPI routes (all API endpoints)
    agent/
      state.py         ← AgentState TypedDict (the state that flows through the graph)
      graph.py         ← StateGraph wiring: nodes, edges, checkpointer, interrupt points
      nodes.py         ← THE CORE: all 7 node functions + LLM calls + prompts
  resume_profile.json  ← saved resume (local file, persists on disk)
  .env                 ← API key (not committed)

frontend/
  src/
    lib/api.ts         ← all API calls + TypeScript interfaces
    App.tsx            ← React Router: / → Dashboard, /new → NewSession, /prep/:id → PrepDetail
    pages/
      Dashboard.tsx    ← session list
      NewSession.tsx   ← form + SSE streaming + early navigation
      PrepDetail.tsx   ← Analysis/Q&A/Role-Play tabs + answer polling
    components/
      QuestionCard.tsx ← collapsible Q&A card with richer details
      ChatWindow.tsx   ← roleplay chat + FeedbackCard + CheckpointCard
```

### "When I upload a PDF resume, where does it go?"

1. **Frontend** (`NewSession.tsx`): File picker triggers `parseResumeFile()` in `api.ts`
2. **API call**: `POST /api/parse-resume` with multipart form data
3. **Backend** (`main.py` → `parse_resume()`): pdfplumber extracts text from the PDF bytes
4. **Response**: Extracted text goes back to the frontend textarea — user can edit it
5. **If they click "Save as default"**: `PUT /api/profile/resume` writes to `resume_profile.json`

### "When the user submits the form, what happens?"

1. **Frontend** (`NewSession.tsx`): Calls `createSessionStream()` → `POST /api/sessions/stream`
2. **Backend** (`main.py`): Spawns a **background thread** running `agent.stream(initial_state, config, stream_mode="updates")`
3. **SSE events** fire as each node completes: `parse` → `analyze` → `generate` → `draft`
4. **Frontend receives `generate` complete** → navigates to `/prep/:id` immediately (doesn't wait for `draft`)
5. **PrepDetail** loads, shows questions. Polls `GET /api/sessions/:id` every 2 seconds until answers arrive.
6. **Background thread** finishes `draft` → answers appear on next poll

### "In role-play, what happens when I submit an answer?"

1. **Frontend** (`ChatWindow.tsx`): Calls `submitAnswer()` → `POST /api/sessions/:id/answer`
2. **Backend** (`main.py` → `submit_answer()`): Appends user answer to `chat_history`, calls `agent.invoke()`
3. **Graph resumes** into `evaluate_answer` node (`nodes.py`): LLM scores the answer 1-10, generates strengths/improvements/improved_answer
4. **Graph pauses** at `interrupt_after=["evaluate"]` — status becomes `"reviewing_feedback"`
5. **Frontend** sees `reviewing_feedback` status → shows `FeedbackCard` (score, strengths, improvements)
6. **User clicks "Next Question"** → `POST /api/sessions/:id/continue` → graph resumes into `roleplay_ask`
7. **Every 5 questions**: `CheckpointCard` appears with score trends and "Continue" vs "Finish" buttons

### "How do conditional edges work?"

**File**: `backend/app/agent/graph.py` + `nodes.py`

```python
# In graph.py — after generate, route based on mode:
graph.add_conditional_edges("generate", route_by_mode, {"prep": "draft", "roleplay": "roleplay_ask"})

# In nodes.py — the routing function:
def route_by_mode(state: AgentState) -> str:
    return "roleplay" if state.get("mode") == "roleplay" else "prep"

# In graph.py — after evaluate, continue or stop:
graph.add_conditional_edges("evaluate", check_continue, {"continue": "roleplay_ask", "done": "summary"})

# In nodes.py:
def check_continue(state: AgentState) -> str:
    if state.get("session_complete"):
        return "done"
    if state.get("current_q_index", 0) >= len(state.get("questions", [])):
        return "done"
    return "continue"
```

### "How does stage-aware prompting work?"

**File**: `backend/app/agent/nodes.py`

```python
STAGE_CONTEXT = {
    "phone_screen": "Light screening for communication and culture fit...",
    "recruiter_screen": "Recruiter evaluating basic qualifications...",
    "hiring_manager": "Hiring manager assessing team fit, leadership, vision...",
    "technical": "Deep technical evaluation of problem solving...",
    "behavioral": "STAR-method behavioral questions...",
    "final_panel": "Cross-functional panel assessing overall fit...",
}

def _resolve_stage_context(stage: str) -> str:
    if stage in STAGE_CONTEXT:
        return STAGE_CONTEXT[stage]
    # LLM fallback for custom stages like "Case Study"
    result = _llm_json(system="Describe what this interview stage evaluates...", user=stage)
    return result.get("stage_context", f"Interview stage: {stage}")
```

### Multi-Node Context Chain

State grows as it flows through nodes:

1. **Parse**: `{company, role, job_description, stage_context}` ← extracted from raw text/URL
2. **Analyze**: `{analysis: {key_skills, culture_signals, interviewer_focus, ...}}` ← built from parsed data
3. **Generate**: `{questions: [{question, category, theme, likely_asked_by, why_asked}, ...]}` ← informed by analysis + stage + interviewers
4. **Draft**: `{answers: [{answer_framework, key_points, timing_guidance, red_flags, response_strategy, ...}, ...]}` ← personalized against resume + analysis

Each node sees everything the previous nodes produced. This is **context accumulation**, not independent LLM calls.

---

## 9. Key Code Walkthrough Snippets

### Two-Pause Feedback Loop

**File**: `backend/app/agent/graph.py`

```python
agent = build_graph().compile(
    checkpointer=checkpointer,
    interrupt_before=["evaluate"],   # pause for user answer
    interrupt_after=["evaluate"],    # pause for user to read feedback
)
```

### Interviewer Attribution in Questions

**File**: `backend/app/agent/nodes.py` → `generate_questions()`

When interviewers are provided, the prompt includes their names and titles. The output schema adds `"likely_asked_by"` so each question shows which panelist would ask it.

### Collapsible Q&A Cards

**File**: `frontend/src/components/QuestionCard.tsx`

Collapsed shows: question + theme badge + category + interviewer attribution + timing guidance
Expanded shows: answer framework + key points + response strategy + example + avoid + red flags

---

## Quick Reference: API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/sessions/stream` | **Create session with SSE progress** (primary) |
| `POST` | `/api/sessions` | Create session (blocking, fallback) |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/:id` | Get session details (used by polling) |
| `POST` | `/api/sessions/:id/answer` | Submit a roleplay answer |
| `POST` | `/api/sessions/:id/continue` | Advance past feedback pause |
| `POST` | `/api/sessions/:id/finish` | End roleplay early → summary |
| `POST` | `/api/sessions/:id/start-roleplay` | Switch prep → roleplay |
| `POST` | `/api/extract-fields` | Auto-fill form fields from JD |
| `POST` | `/api/lookup-interviewer` | Web search for interviewer title |
| `POST` | `/api/parse-resume` | Extract text from PDF/DOCX/TXT |
| `GET` | `/api/profile/resume` | Get saved resume |
| `PUT` | `/api/profile/resume` | Save/update resume |
