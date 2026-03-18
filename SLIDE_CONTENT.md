# InterviewPrep AI — Gamma Slide Deck Content

> **How to use**: Copy each slide section below directly into Gamma AI as separate slides. Speaker notes are included under each slide for your reference.

---

## Slide 1: Title

**InterviewPrep AI**
An Agentic Interview Preparation System

*Built with LangGraph + FastAPI + React*

> **Speaker notes**: "I built InterviewPrep AI in under 6 hours to solve a real problem: interview prep is generic. This tool uses a LangGraph state machine — not a simple LLM wrapper — to create context-aware, stage-specific prep with interactive coaching."

---

## Slide 2: The Problem

**Interview prep today is broken**

- Candidates Google "top 10 questions" — none are tailored to their specific JD, stage, or interviewers
- Existing tools treat every interview the same — a recruiter screen gets the same prep as a VP technical deep-dive
- No feedback loop — you practice in a vacuum with no scoring or coaching
- Panel interviews get no special treatment even though each interviewer focuses on different things

> **Speaker notes**: "This isn't hypothetical. I experienced this myself preparing for interviews. ChatGPT gives you generic questions. Mock interview apps don't adapt to the stage. None of them know who your interviewers are or what the company actually values."

---

## Slide 3: The Solution — Architecture

**7-Node LangGraph State Machine**

```
START ─► Parse JD ─► Analyze Role ─► Generate Questions
                                            │
                                   ┌────────┴────────┐
                                   ▼                  ▼
                              Draft Answers     Roleplay Ask
                                   │                  │
                                   ▼            ┌─────┘
                              Summary ◄──── Evaluate
                                   │           │  ▲
                                   ▼           └──┘
                                  END      check_continue
```

Key: Each node is a focused LLM call. State accumulates as it flows through the graph. Two conditional edges make routing decisions.

> **Speaker notes**: "This is a DAG, not a flat reasoning loop. Each node has a single responsibility. The state grows as it flows — by the time we generate questions, the LLM has company culture signals, key skills, and stage context all synthesized from the raw JD. The two conditional edges — route_by_mode and check_continue — are autonomous decisions the agent makes based on accumulated state."

---

## Slide 4: What Makes This Agentic

**Not a wrapper — a reasoning system**

1. **Multi-Step Context Chain** — Parse → Analyze → Generate → Draft. Each node enriches the state. Questions are informed by analysis, answers are personalized against resume + analysis.

2. **Autonomous Routing** — `route_by_mode` decides prep vs. roleplay. `check_continue` decides next question vs. summary. The graph topology changes based on input.

3. **Human-in-the-Loop (Two-Pause Pattern)** — `interrupt_before` pauses for the user's answer. `interrupt_after` pauses so the user can read their feedback before the next question. Two interrupts create a controlled coaching loop.

4. **Stage-Aware Intelligence** — A recruiter screen generates "walk me through your resume" questions. A technical round generates system design questions. Custom stages get LLM-generated context on the fly.

5. **Panel Interview Awareness** — Each question is attributed to the interviewer most likely to ask it based on their title. The analysis node generates per-interviewer focus areas.

6. **Async Background Processing** — After questions are generated, the user navigates to the session page immediately. Answer drafting runs in a background thread; the frontend polls until answers arrive. No blocking wait.

> **Speaker notes**: "The differentiator isn't the LLM — anyone can call GPT-4. It's the state machine around the LLM: conditional routing that changes behavior based on context, human-in-the-loop gates at the right points, background processing with polling, session persistence across interactions, and multi-node context chains."

---

## Slide 5: Live Demo

**Demo flow**:

1. **Dashboard** → Show session history with navigation
2. **New Session** → Paste a real JD (text or URL)
3. **Auto-Fill** → One click extracts company, role, stage from JD
4. **Upload Resume** → Upload a PDF, text gets extracted and editable
5. **Add Interviewer** → Name + auto-lookup title via DuckDuckGo web search
6. **SSE Progress** → Watch parse → analyze → generate stream live
7. **Instant Navigation** → Land on session page as soon as questions are ready (answers draft in background)
8. **Q&A Tab** → Collapsible cards: click to expand answer framework, timing, strategy, red flags
9. **Theme Badges** → "Technical Depth", "Soft Skills", "Culture Fit" per question
10. **Interviewer Attribution** → "Likely: Sarah Chen" badge on each question
11. **Role-Play** → Answer a question → feedback card (score, strengths, improvements) → "Next Question" button
12. **Checkpoint** → After 5 questions: score trends + "Continue" vs "Finish"

> **Speaker notes**: "I'll walk through the full flow. Notice the streaming — as each node completes, you see it. Once questions generate, I land on the session page immediately while answers draft in the background. The questions adapt to the stage and show which interviewer would ask them. In role-play, the graph pauses TWICE — once for my answer, once for me to read feedback — that's the two-pause interrupt pattern. After 5 questions there's a checkpoint with score trends."

---

## Slide 6: Technical Choices

| Decision | Chosen | Why |
|----------|--------|-----|
| **Agent Framework** | LangGraph | Explicit flow control with conditional edges and human-in-the-loop. Not a reasoning loop — a structured pipeline with branches. |
| **LLM Output** | JSON-mode | Deterministic pipeline steps, not autonomous tool decisions. Simpler, faster, equally structured. |
| **State Persistence** | MemorySaver | Zero-config for demo. Production swap: one line to SQLiteSaver or Postgres. |
| **Backend** | FastAPI | Async, auto OpenAPI docs, Pydantic validation. Perfect for API-first. |
| **Frontend** | React + Vite | Fast dev cycle. Components portable to Next.js for production. |
| **Streaming** | SSE + LangGraph stream() | Real-time node completion events. No WebSocket complexity. |

> **Speaker notes**: "Every choice has a trade-off. LangGraph over CrewAI because we need explicit control, not autonomous agent loops. JSON-mode over function-calling because our pipeline is deterministic. MemorySaver is a demo choice — swapping to SQLiteSaver for persistence is a one-line change."

---

## Slide 7: Key Feature Highlights

**Interviewer Web Search + Panel Attribution**
- User types a name, clicks the search icon → DuckDuckGo finds their LinkedIn → LLM extracts title
- Questions are attributed: "Likely asked by: Sarah Chen" based on their title vs. question theme
- Zero API keys, no LinkedIn scraping

**Async Q&A with Background Processing**
- `agent.stream(stream_mode="updates")` fires SSE events per node
- Frontend navigates on `generate` complete — doesn't wait for `draft`
- PrepDetail polls every 2s. "Drafting answer frameworks..." banner until answers arrive

**Two-Pause Roleplay Feedback Loop**
- `interrupt_before=["evaluate"]` → pause for user answer
- `interrupt_after=["evaluate"]` → pause for user to read feedback
- Feedback card: color-coded score, strengths, improvements, improved answer, tip
- Every 5 questions: checkpoint with score trends and "Continue Drilling" vs "Finish & See Summary"

**Resume File Upload**
- PDF/DOCX/TXT → `pdfplumber` or `python-docx` extracts text → user edits → save as default
- Persistent across sessions in `resume_profile.json`

> **Speaker notes**: "These features demonstrate patterns DataRobot customers care about: external data enrichment via web search, real-time streaming for UX, background processing with polling, the two-pause interrupt pattern for controlled feedback loops, and document parsing for structured input."

---

## Slide 8: DataRobot Customer Applications

**The core pattern**: LangGraph state machine + domain nodes + conditional routing + human-in-the-loop

| Customer Problem | How This Pattern Applies |
|-----------------|------------------------|
| **Customer Onboarding** | Parse account → analyze requirements → generate plan → interactive Q&A → summary |
| **Support Ticket Triage** | Parse ticket → analyze severity → route to team (conditional edge) → draft response → human review |
| **Compliance Review** | Parse document → check rules (multi-node) → flag issues → human approval gate → report |
| **Sales Discovery Agent** | Parse prospect → analyze industry → generate questions → roleplay practice → feedback |
| **ML Model Monitoring** | Parse drift alert → analyze changes → generate options → human decision → execute |

> **Speaker notes**: "The interview prep domain is the demo, but the pattern is universal. Every one of these customer problems needs the same primitives: multi-step reasoning, conditional routing, human gates, and session persistence. This is exactly what DataRobot's solutions team helps customers build."

---

## Slide 9: Q&A

**Key talking points if asked:**

- *"Why not use CrewAI?"* — CrewAI is for multi-agent collaboration. This is a single-agent pipeline with branches. LangGraph's state machine gives us more control over flow and interrupts.
- *"Why LangGraph over plain LangChain?"* — LangChain gives you chains and tools. LangGraph gives you a state machine with conditional edges, checkpointed state, and interrupt points. Our problem is a structured pipeline with branches and human-in-the-loop — not a reasoning loop.
- *"How does this scale?"* — Swap MemorySaver for PostgreSQL checkpointer (one line). Add Redis caching for LLM calls. Async workers for session creation. All supported by LangGraph out of the box.
- *"What about hallucination?"* — JSON-mode constrains output structure. Each node has a narrow, specific prompt. The context chain means later nodes validate earlier output implicitly.
- *"Where is the resume stored?"* — File-based JSON for the demo (`resume_profile.json`). Production: user profile table in Postgres — same swap pattern as the checkpointer.
- *"Why build this vs. using an existing tool?"* — Existing tools aren't agentic. They don't do conditional routing, don't have human-in-the-loop, and don't personalize to stage + interviewer + resume.
- *"Walk me through the code"* — Start at `graph.py` (7 nodes, 2 conditional edges). Open `nodes.py` to show a node function. Open `main.py` to show the SSE streaming endpoint. Show `state.py` for the TypedDict.

> **Speaker notes**: "Be ready for these questions. The key message: this demonstrates that I can architect and build agentic systems with production-ready patterns, not just call an LLM API. If they ask to see code, start with graph.py — it's 56 lines and shows the entire state machine topology. Then nodes.py for any specific node."
