"""Sanitized database URL helpers for logs.

Never log credentials or full connection strings. Used so Railway/dev operators
can confirm which Postgres host the API and LangGraph checkpointer use.
"""
from urllib.parse import urlparse


def database_host_for_logs(database_url: str) -> str:
    """Return host[:port] from a Postgres URL, or a safe placeholder.

    Examples:
        postgresql://user:pass@db.abc.supabase.co:5432/postgres -> db.abc.supabase.co:5432
        empty -> (no DATABASE_URL)
    """
    raw = (database_url or "").strip()
    if not raw:
        return "(no DATABASE_URL)"
    parsed = urlparse(raw)
    host = parsed.hostname
    if not host:
        return "(unparsed DATABASE_URL)"
    if parsed.port:
        return f"{host}:{parsed.port}"
    return host
