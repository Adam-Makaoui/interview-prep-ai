# InterviewPrep AI

---

## Slide 1: Title

**InterviewPrep AI**
An Agentic Interview Coaching System

Built with **LangGraph** + **FastAPI** + **React** | 6-Hour Build

---

## Slide 2: The Problem

**Generic prep doesn't work**

- "Top 10 interview questions" lists ignore the JD, stage, and who's interviewing you
- A recruiter screen and a VP deep-dive get the same prep
- No feedback loop — you practice in a vacuum
- Panel interviews? Every interviewer cares about different things, but nothing adapts

---

## Slide 3: What I Built

**A 7-node LangGraph state machine that adapts to context**

```
Parse JD ➜ Analyze Role ➜ Generate Questions
                                   |
                         ┌─────────┴─────────┐
                    Draft Answers        Roleplay Ask
                         |                    |
                         ▼              ┌─────┘
                      Summary ◄── Evaluate Answer
                         |           |   ▲
                         ▼           └───┘
                        END       (loop or stop)
```

Each node is a focused LLM call. State accumulates across nodes. Two conditional edges make autonomous routing decisions.

---

## Slide 4: Why This Is Agentic (Not a Wrapper)

| Capability | How It Works |
|---|---|
| **Multi-step reasoning** | Parse → Analyze → Generate → Draft. Each node builds on the last. Questions are shaped by company culture, key skills, and stage. |
| **Autonomous routing** | `route_by_mode` picks prep vs. roleplay. `check_continue` decides next question vs. summary. The graph topology changes based on input. |
| **Human-in-the-loop** | Two interrupt points create a coaching loop: pause for the user's answer, pause again so they read feedback before the next question. |
| **Stage-aware intelligence** | Recruiter screen → "walk me through your resume." Technical → system design. Custom stage → LLM generates context on the fly. |
| **External data enrichment** | Interviewer name → DuckDuckGo web search → extract title → attribute questions to specific panelists. |

---

## Slide 5: LangChain + LangGraph — Why Both

**LangChain** — the foundation
- LLM integrations (OpenAI, Anthropic, etc.) with a unified interface
- Prompt templates, output parsers, and structured JSON mode
- Tools and retrievers for external data (web search, document parsing)

**LangGraph** — the orchestration layer (built on LangChain)
- Turns LLM calls into a **state machine**: nodes, edges, conditional branches
- **Checkpointed state** — every step is saved; swap MemorySaver → Postgres in one line
- **`interrupt_before` / `interrupt_after`** — native human-in-the-loop gates
- **Conditional edges** — the graph decides its own path based on accumulated context
- **Streaming** — fires events per node completion for real-time UX

**Together**: LangChain handles the LLM calls. LangGraph orchestrates *when*, *in what order*, and *with what logic* those calls happen — with pause points for human input.

---

## Slide 6: Key Technical Highlights

**Real-time streaming (SSE)**
Backend streams node-completion events → frontend shows live progress → navigates early when questions are ready → answers draft in background

**Two-Pause Roleplay Pattern**
`interrupt_before=["evaluate"]` — pause for user answer
`interrupt_after=["evaluate"]` — pause for user to read feedback
Result: score card → strengths → improvements → improved answer → tip → then "Next Question"

**Interviewer Web Search**
Type a name → click search → DuckDuckGo finds them → LLM extracts title → questions attributed: "Likely: Sarah Chen (VP Engineering)"

**Document Parsing**
Upload PDF/DOCX → pdfplumber/python-docx extracts text → user edits → save as persistent profile across sessions

---

## Slide 7: DataRobot Customer Applications

**The pattern is universal**: state machine + domain nodes + conditional routing + human gates

| Customer Problem | Same Pattern |
|---|---|
| **Customer Onboarding** | Parse account → analyze needs → generate plan → interactive Q&A → summary |
| **Support Triage** | Parse ticket → classify severity → route to team (conditional edge) → draft response → human review |
| **Compliance Review** | Parse document → check rules → flag issues → human approval gate → report |
| **Sales Discovery** | Parse prospect → analyze industry → generate questions → roleplay → feedback |
| **ML Model Monitoring** | Parse drift alert → analyze impact → generate options → human decision → execute |

---

## Slide 8: Live Demo

**What you'll see:**

1. Paste a real job description → one-click auto-fills company, role, stage
2. Upload a PDF resume → text extracted and editable
3. Add interviewers by name → auto-lookup titles via web search
4. Watch the pipeline stream live: Parse → Analyze → Generate → Draft
5. Land on the session page the moment questions are ready (answers draft in background)
6. Collapsible Q&A cards with theme badges, interviewer attribution, timing, strategy, red flags
7. Switch to Role-Play → answer a question → get a scored feedback card → "Next Question"
8. After 5 questions → checkpoint with score trends → "Continue" or "Finish & See Summary"

---

## Slide 9: Summary + Q&A

**What this demonstrates:**

- Architecting agentic systems with LangGraph — not just calling an LLM
- Conditional routing, human-in-the-loop, session persistence, background processing
- Production-ready patterns: swap MemorySaver → Postgres in one line, add Redis caching, async workers
- A real tool that solves a real problem — built code-first in under 6 hours

**Questions?**
