"""Smoke tests for launch-critical FastAPI surfaces."""

import os

os.environ.setdefault("OPENAI_API_KEY", "sk-test-dummy")
os.environ.setdefault("OPENAI_MODEL", "gpt-5.4-nano")
os.environ["DATABASE_URL"] = ""
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret")
os.environ.setdefault("FRONTEND_URL", "https://interviewintel.ai")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("STRIPE_PRICE_PRO_MONTHLY", "price_test_pro")

from fastapi.testclient import TestClient

from app.main import app
from app.resume_store import MAX_SLOTS, normalize_document


client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_preflight_allows_www_origin_for_resume_parse():
    response = client.options(
        "/api/parse-resume",
        headers={
            "Origin": "https://www.interviewintel.ai",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://www.interviewintel.ai"


def test_parse_resume_txt_extracts_text():
    response = client.post(
        "/api/parse-resume",
        files={"file": ("resume.txt", b"Alex Rivera\nSenior Solutions Engineer", "text/plain")},
    )
    assert response.status_code == 200
    assert "Senior Solutions Engineer" in response.json()["text"]


def test_profile_me_anonymous_fallback():
    response = client.get("/api/profile/me")
    assert response.status_code == 200
    body = response.json()
    assert body["authenticated"] is False
    assert body["plan"] == "free"


def test_billing_checkout_requires_auth():
    response = client.post("/api/billing/checkout")
    assert response.status_code == 401


def test_resume_store_caps_saved_resumes_to_two():
    doc = normalize_document(
        {
            "default_id": "three",
            "items": [
                {"id": "one", "label": "One", "text": "one"},
                {"id": "two", "label": "Two", "text": "two"},
                {"id": "three", "label": "Three", "text": "three"},
            ],
        },
    )
    assert MAX_SLOTS == 2
    assert [item["id"] for item in doc["items"]] == ["one", "two"]
    assert doc["default_id"] == "one"


def test_stripe_webhook_rejects_invalid_signature():
    response = client.post(
        "/api/billing/webhook",
        content=b'{"type":"checkout.session.completed","data":{"object":{}}}',
        headers={"stripe-signature": "t=1,v1=not-a-real-signature"},
    )
    assert response.status_code == 400
