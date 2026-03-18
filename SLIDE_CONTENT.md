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

3. **Human-in-the-Loop** — `interrupt_before` and `interrupt_after` create a two-pause roleplay loop: pause for user to answer, pause for user to read feedback. The agent waits, doesn't race ahead.

4. **Stage-Aware Intelligence** — A recruiter screen generates "walk me through your resume" questions. A technical round generates system design questions. Custom stages get LLM-generated context on the fly.

5. **Panel Interview Awareness** — When interviewers are provided, analysis generates focus areas per interviewer title.

> **Speaker notes**: "The differentiator isn't the LLM — anyone can call GPT-4. It's the state machine around the LLM: conditional routing that changes behavior based on context, human-in-the-loop gates at the right points, session persistence across interactions, and multi-node context chains."

---

## Slide 5: Live Demo

**Demo flow**:

1. **Dashboard** → Show session history
2. **New Session** → Paste a real JD
3. **Auto-Fill** → One click extracts company, role, stage
4. **Add Interviewer** → Name + auto-lookup title via web search
5. **Live Progress** → Watch SSE stream as each node completes
6. **Analysis Tab** → Key skills, culture signals, interviewer focus areas
7. **Q&A Tab** → Stage-specific questions with theme badges
8. **Role-Play** → Answer a question, see feedback card with score
9. **Next Question / Checkpoint** → 5-question progress check
10. **Summary** → Readiness scorecard

> **Speaker notes**: "I'll walk through the full flow. Notice the streaming progress — the user sees each step complete in real-time. The questions adapt to the stage I selected. When I answer in role-play, the graph pauses, evaluates my answer, shows me a feedback card with score, strengths, and improvements, then I explicitly advance to the next question. After 5 questions there's a checkpoint with score trends."

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

**Interviewer Web Search Lookup**
- User types a name, clicks the search icon
- DuckDuckGo search finds their LinkedIn profile
- LLM extracts their job title from search snippets
- Zero API keys needed, no LinkedIn scraping

**SSE Streaming Progress**
- Session creation uses `agent.stream(stream_mode="updates")`
- Each node completion fires an SSE event
- Frontend shows step-by-step progress instead of a blank spinner

**Roleplay Feedback Loop**
- `interrupt_after=["evaluate"]` — new LangGraph primitive
- Feedback card: score (color-coded), strengths, improvements, improved answer, tip
- Every 5 questions: checkpoint with score trends and progress analysis

> **Speaker notes**: "These features demonstrate three patterns DataRobot customers care about: external data enrichment via web search, real-time streaming for user experience, and the interrupt_after pattern for controlled feedback loops."

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

- *"Why not use CrewAI?"* — CrewAI is for multi-agent collaboration. This is a single-agent pipeline with branches. LangGraph's state machine gives us more control.
- *"How does this scale?"* — Swap MemorySaver for PostgreSQL checkpointer. Add Redis caching for LLM calls. Async workers for session creation. All supported by LangGraph out of the box.
- *"What about hallucination?"* — JSON-mode constrains output structure. Each node has a narrow, specific prompt. The context chain means later nodes validate earlier output implicitly.
- *"Why build this vs. using an existing tool?"* — Existing tools aren't agentic. They don't do conditional routing, don't have human-in-the-loop, and don't personalize to stage + interviewer.

> **Speaker notes**: "Be ready for these questions. The key message: this demonstrates that I can architect and build agentic systems with production-ready patterns, not just call an LLM API."
