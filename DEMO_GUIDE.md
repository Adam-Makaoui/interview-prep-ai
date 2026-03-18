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

### Human-in-the-Loop

```python
agent = build_graph().compile(
    checkpointer=checkpointer,
    interrupt_before=["evaluate"],  # ← THIS LINE
)
```

The `interrupt_before=["evaluate"]` is what makes role-play interactive. The graph runs through `roleplay_ask` (which presents a question), then **pauses**. The user submits their answer via the API, which resumes the graph. This is fundamentally different from a batch pipeline — it's a stateful, interruptible conversation.

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

1. **Land on Dashboard** — Show the session history (empty or with previous sessions)

2. **Click "+ New Session"** — Show the form

3. **Paste a Job Description** — Use a real JD (DataRobot SE role works well)
   - Click **"Auto-Fill Company, Role & Stage"** — watch it extract fields
   - Point out that the user can **edit** the auto-filled values

4. **Add an Interviewer** — Click "+ Add Interviewer", enter a name and title (e.g., "Sarah Chen, VP Solutions Engineering")

5. **Set Stage** — Pick "Hiring Manager" or select "Other" and type a custom stage

6. **Start Prep Session** — Click submit, wait ~15 seconds

7. **Show Analysis Tab** — Point out:
   - Key Skills (extracted from JD, not hardcoded)
   - Culture Signals (inferred from JD language)
   - Interviewer Focus Areas (generated because we added an interviewer)

8. **Show Q&A Tab** — Questions are stage-specific. Point out the "why_asked" field — the agent explains its reasoning.

9. **Switch to Role-Play** — Click the Role-Play tab, then "Start Practice Interview"
   - Answer one question naturally
   - Show the coach feedback (score, strengths, improvements, improved answer)

10. **If time**: Complete all questions and show the final **readiness scorecard**

### Talking Points During Demo
- "The graph paused here waiting for my answer — that's `interrupt_before` in action"
- "Notice the questions changed because I picked a different stage — that's the STAGE_CONTEXT routing"
- "The auto-fill is a separate lightweight LLM call, not a full session creation"

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

## 8. Key Code Walkthrough

### Conditional Edge (agentic routing)

**File**: `backend/app/agent/nodes.py`

```python
def route_by_mode(state: AgentState) -> str:
    """Conditional edge: route to prep or roleplay based on state."""
    return "roleplay" if state.get("mode") == "roleplay" else "prep"
```

This is wired in `graph.py`:
```python
graph.add_conditional_edges(
    "generate",
    route_by_mode,
    {"prep": "draft", "roleplay": "roleplay_ask"},
)
```

### Human-in-the-Loop (interrupt_before)

**File**: `backend/app/agent/graph.py`

```python
agent = build_graph().compile(
    checkpointer=checkpointer,
    interrupt_before=["evaluate"],
)
```

The graph pauses AFTER `roleplay_ask` and BEFORE `evaluate`. The user's answer arrives via the API, which resumes the graph.

### Stage-Aware Context (custom stage LLM fallback)

**File**: `backend/app/agent/nodes.py`

```python
def _resolve_stage_context(stage: str) -> str:
    if stage in STAGE_CONTEXT:
        return STAGE_CONTEXT[stage]
    # LLM generates context for unknown stages
    result = _llm_json(...)
    return result.get("stage_context", f"Interview stage: {stage}")
```

### Multi-Node Context Chain

The state grows as it flows through nodes:

1. **Parse**: `{company, role, job_description}` ← extracted from raw text
2. **Analyze**: `{analysis: {key_skills, culture_signals, ...}}` ← built from parsed data
3. **Generate**: `{questions: [...]}` ← informed by analysis + stage context
4. **Draft**: `{answers: [...]}` ← personalized against resume + analysis

Each node sees everything the previous nodes produced. This is context accumulation, not independent LLM calls.

---

## Quick Reference: API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/extract-fields` | Auto-fill form fields from JD text or URL |
| `POST` | `/api/sessions` | Create a new prep/roleplay session |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/:id` | Get session details |
| `POST` | `/api/sessions/:id/answer` | Submit a roleplay answer |
| `POST` | `/api/sessions/:id/start-roleplay` | Switch prep → roleplay |
| `GET` | `/api/profile/resume` | Get saved resume |
| `PUT` | `/api/profile/resume` | Save/update resume |
