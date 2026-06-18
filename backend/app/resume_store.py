"""Normalized multi-slot resume storage (max 2 labeled resumes per user)."""

from __future__ import annotations

import uuid
from typing import Any

VERSION = 1
MAX_SLOTS = 2
MAX_TEXT_LEN = 80_000
MAX_LABEL_LEN = 120


def new_slot_id() -> str:
    return str(uuid.uuid4())


def default_document() -> dict[str, Any]:
    rid = new_slot_id()
    return {
        "version": VERSION,
        "default_id": rid,
        "items": [{"id": rid, "label": "Default", "text": ""}],
    }


def migrate_from_legacy_resume(legacy: str) -> dict[str, Any]:
    rid = new_slot_id()
    text = (legacy or "")[:MAX_TEXT_LEN]
    return {
        "version": VERSION,
        "default_id": rid,
        "items": [{"id": rid, "label": "Default", "text": text}],
    }


def _clamp_slot(raw: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    sid = str(raw.get("id") or "").strip()
    if not sid:
        return None
    label = str(raw.get("label") or "Resume").strip()[:MAX_LABEL_LEN] or "Resume"
    text = str(raw.get("text") or "")[:MAX_TEXT_LEN]
    return {"id": sid, "label": label, "text": text}


def normalize_document(blob: Any, legacy_resume: str = "") -> dict[str, Any]:
    """Return a valid in-memory document. Uses legacy_resume if blob is missing or invalid."""
    legacy = (legacy_resume or "")[:MAX_TEXT_LEN]

    if blob is None:
        if legacy.strip():
            return migrate_from_legacy_resume(legacy)
        return default_document()

    if not isinstance(blob, dict):
        return migrate_from_legacy_resume(legacy) if legacy.strip() else default_document()

    items_raw = blob.get("items")
    if not isinstance(items_raw, list):
        return migrate_from_legacy_resume(legacy) if legacy.strip() else default_document()

    items: list[dict[str, Any]] = []
    for x in items_raw[:MAX_SLOTS]:
        s = _clamp_slot(x if isinstance(x, dict) else {})
        if s:
            items.append(s)

    default_id = str(blob.get("default_id") or "").strip()
    if not items:
        return migrate_from_legacy_resume(legacy) if legacy.strip() else default_document()

    id_set = {i["id"] for i in items}
    if default_id not in id_set:
        default_id = items[0]["id"]

    if len(items) > MAX_SLOTS:
        items = items[:MAX_SLOTS]

    return {"version": VERSION, "default_id": default_id, "items": items}


def default_resume_text(doc: dict[str, Any]) -> str:
    default_id = doc.get("default_id")
    for item in doc.get("items") or []:
        if isinstance(item, dict) and item.get("id") == default_id:
            return str(item.get("text") or "")
    items = doc.get("items") or []
    if items and isinstance(items[0], dict):
        return str(items[0].get("text") or "")
    return ""


def document_for_file_json(data: dict[str, Any], doc: dict[str, Any]) -> dict[str, Any]:
    """Merge saved document into file dict, keep legacy `resume` in sync with default text."""
    out = {**data, "saved_resumes": doc, "resume": default_resume_text(doc)}
    return out
