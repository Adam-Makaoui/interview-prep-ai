# Interview Prep Coach

An AI-powered interview preparation tool built with **Dapr** and **Diagrid Catalyst**. Submit a job listing, and the system automatically analyzes the role, generates tailored interview questions, and drafts personalized answers using your resume -- all orchestrated through a durable, observable workflow.

## Architecture

```
┌─────────────┐     Pub/Sub      ┌──────────────────┐     Activities     ┌──────────────┐
│   Web App   │───────────────▶  │  Dapr Workflow    │──────────────────▶ │  AI Agent    │
│  (FastAPI)  │   "new-interview"│  (Orchestrator)   │  analyze_role      │  (OpenAI)    │
│             │                  │                   │  generate_questions │              │
│  Submit     │                  │  Step 1 → 2 → 3   │  draft_answers     │  GPT-4o-mini │
│  Dashboard  │◀── State Mgmt ──│  (durable/resume) │───State Mgmt──────▶│              │
│  Detail     │                  │                   │                    │              │
└─────────────┘                  └──────────────────┘                    └──────────────┘
```

### Flow

1. User submits interview details via the web form (company, role, JD, stage, resume)
2. The app saves the record to **Dapr State Store** and publishes a `new-interview` event via **Dapr Pub/Sub**
3. The Pub/Sub subscription triggers the **Dapr Workflow**, which runs 3 AI-powered steps:
   - **Analyze Role**: AI extracts key skills, culture signals, and interview tips
   - **Generate Questions**: AI creates 8-10 stage-specific interview questions
   - **Draft Answers**: AI writes personalized answer frameworks using your resume
4. Each step saves progress to the State Store; the dashboard auto-refreshes as steps complete
5. If the process crashes mid-step, the workflow **resumes from the last checkpoint** (durable execution)

## Dapr APIs Used

| API | Purpose | Why |
|-----|---------|-----|
| **State Management** | Persist interviews, prep materials, and the interview index | Pluggable backends -- Redis locally, any managed store in Catalyst |
| **Pub/Sub** | Event-driven: `new-interview` triggers the workflow asynchronously | Decouples intake from processing; enables scaling and fan-out |
| **Workflow** | Orchestrates the multi-step prep pipeline with durability | Automatic checkpointing, failure recovery, and observability in Catalyst |
| **AI (OpenAI)** | Role analysis, question generation, personalized answer drafting | Extensible via Dapr Conversation API for provider-agnostic LLM access |

## Project Structure

```
├── app.py                  # FastAPI web app (UI + REST API + Pub/Sub subscription)
├── workflow.py             # Dapr Workflow definition (3-step durable pipeline)
├── agent.py                # AI agent (OpenAI calls for analysis/questions/answers)
├── templates/
│   ├── base.html           # Base template with Tailwind CSS
│   ├── index.html          # Dashboard (list all interviews)
│   ├── submit.html         # Submit form (company, role, JD, stage, resume)
│   └── detail.html         # Detail page (prep materials + auto-refresh)
├── components/
│   ├── statestore.yaml     # Dapr state store component config
│   └── pubsub.yaml         # Dapr pub/sub component config
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
└── README.md               # This file
```

## Prerequisites

- **Python 3.11+** (tested with 3.12)
- **Docker Desktop** (running) -- required for `dapr init`
- **Dapr CLI** -- [install guide](https://docs.dapr.io/getting-started/install-dapr-cli/)
- **OpenAI API key** -- [get one here](https://platform.openai.com/api-keys)

## How to Run Locally

### 1. Install Dapr CLI and initialize

```bash
# Install Dapr CLI (macOS)
brew install dapr/tap/dapr-cli

# Initialize Dapr (requires Docker running)
dapr init
```

### 2. Set up the Python environment

```bash
# Create virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key:
# OPENAI_API_KEY=sk-...
```

### 4. Run the application

```bash
dapr run \
  --app-id interview-prep \
  --app-port 8000 \
  --dapr-http-port 3500 \
  --resources-path ./components \
  -- python app.py
```

### 5. Open the dashboard

Navigate to **http://localhost:8000** in your browser.

## Running with Diagrid Catalyst

1. Sign up for a free account at [catalyst.diagrid.io](https://catalyst.diagrid.io)
2. Install the Diagrid CLI and authenticate:
   ```bash
   diagrid login
   diagrid whoami
   ```
3. Create a project and configure components (state store, pub/sub) in the Catalyst dashboard
4. Connect your local app to Catalyst using the project endpoints
5. Use the Catalyst dashboard to visualize topology, workflow traces, and component health

## Production Considerations

- **Scalability**: Dapr Workflow distributes work across instances; Catalyst manages auto-scaling
- **Security**: PII protection on resume data via Dapr middleware; API key management via Catalyst secrets
- **LLM Flexibility**: Swap OpenAI for Azure OpenAI, Anthropic, or AWS Bedrock by changing the conversation component config -- zero code changes
- **Enrichment**: Add Dapr Bindings to data enrichment APIs (Clearbit, Apollo) for automatic interviewer research
- **Multi-user**: Add authentication and per-user state namespacing for a multi-tenant deployment
- **Observability**: OpenTelemetry tracing and Prometheus metrics are built-in via Catalyst

## Author

**Adam Makaoui**

## License

MIT -- see [LICENSE](LICENSE)
