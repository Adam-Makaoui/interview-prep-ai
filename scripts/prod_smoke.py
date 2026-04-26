"""Production smoke checks for launch day.

Usage:
    python scripts/prod_smoke.py \
      --frontend https://interviewintel.ai \
      --api https://your-railway-service.up.railway.app
"""

from __future__ import annotations

import argparse
import json
import sys
from urllib import error, request


def _request(method: str, url: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], str]:
    req = request.Request(url, method=method, headers=headers or {})
    try:
        with request.urlopen(req, timeout=15) as res:
            body = res.read().decode("utf-8", errors="replace")
            return res.status, dict(res.headers), body
    except error.HTTPError as exc:  # pragma: no cover - this is a CLI script
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, dict(exc.headers), body
    except Exception as exc:  # pragma: no cover - this is a CLI script
        return 0, {}, str(exc)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run launch-critical production smoke checks.")
    parser.add_argument("--frontend", default="https://interviewintel.ai", help="Browser origin to test CORS against.")
    parser.add_argument("--api", required=True, help="Railway API origin, no trailing /api.")
    args = parser.parse_args()

    frontend = args.frontend.rstrip("/")
    api = args.api.rstrip("/")
    checks: list[tuple[str, bool, str]] = []

    status, _, body = _request("GET", f"{api}/api/health")
    checks.append(("backend health", status == 200 and '"status":"ok"' in body.replace(" ", ""), body[:200]))

    status, headers, body = _request(
        "OPTIONS",
        f"{api}/api/parse-resume",
        headers={
            "Origin": frontend,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    allowed_origin = headers.get("access-control-allow-origin", "")
    checks.append(("resume CORS preflight", status == 200 and allowed_origin == frontend, json.dumps(headers, indent=2)[:600] or body))

    status, _, body = _request("GET", frontend)
    checks.append(("frontend responds", status == 200 and "InterviewIntel" in body, body[:200]))

    for name, ok, detail in checks:
        marker = "PASS" if ok else "FAIL"
        print(f"[{marker}] {name}")
        if not ok:
            print(detail)

    return 0 if all(ok for _, ok, _ in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
