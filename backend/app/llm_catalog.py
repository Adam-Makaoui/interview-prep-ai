"""User-selectable LLM models (tier-gated for future monetization)."""

from __future__ import annotations

from app.config import settings

# API model ids must match https://developers.openai.com/api/docs/models/
MODEL_CATALOG: list[dict] = [
    {
        "id": "gpt-5.4-nano",
        "label": "GPT-5.4 nano",
        "description": "Fastest responses, lowest cost — great default for most prep.",
        "min_plan": "free",
    },
    {
        "id": "gpt-4o-mini",
        "label": "GPT-4o mini",
        "description": "Widely used, reliable balance of quality and cost.",
        "min_plan": "free",
    },
    {
        "id": "gpt-5.4-mini",
        "label": "GPT-5.4 mini",
        "description": "More capable reasoning — included with Pro.",
        "min_plan": "pro",
    },
]


def _plan_rank(plan: str) -> int:
    return {"free": 0, "pro": 1}.get((plan or "free").lower(), 0)


def model_choices_for_api(plan: str) -> list[dict]:
    """Catalog entries with `available` for the user's plan."""
    pr = _plan_rank(plan)
    out: list[dict] = []
    for m in MODEL_CATALOG:
        out.append(
            {
                **m,
                "available": _plan_rank(m["min_plan"]) <= pr,
            }
        )
    return out


def is_model_allowed_for_plan(plan: str, model_id: str) -> bool:
    mid = (model_id or "").strip()
    if not mid:
        return False
    pr = _plan_rank(plan)
    for m in MODEL_CATALOG:
        if m["id"] == mid and _plan_rank(m["min_plan"]) <= pr:
            return True
    return False


def resolve_session_model(profile: dict | None) -> str:
    """Pick the OpenAI model id for LangGraph nodes."""
    if not profile:
        return settings.openai_model
    plan = profile.get("plan") or "free"
    stored = (profile.get("llm_model") or "").strip()
    if stored and is_model_allowed_for_plan(plan, stored):
        return stored
    if is_model_allowed_for_plan(plan, settings.openai_model):
        return settings.openai_model
    for m in MODEL_CATALOG:
        if is_model_allowed_for_plan(plan, m["id"]):
            return m["id"]
    return settings.openai_model
