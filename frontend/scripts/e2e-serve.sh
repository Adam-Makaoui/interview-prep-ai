#!/usr/bin/env bash
# Single process tree for Playwright: backend + Vite (avoids multi-webServer reuse bugs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BE="$ROOT/backend"
FE="$ROOT/frontend"
cleanup() {
  [[ -n "${UV_PID:-}" ]] && kill "$UV_PID" 2>/dev/null || true
}
trap cleanup EXIT

if ! curl -sf "http://localhost:8000/api/health" >/dev/null 2>&1; then
  (cd "$BE" && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
  UV_PID=$!
  for _ in $(seq 1 60); do
    curl -sf "http://localhost:8000/api/health" >/dev/null 2>&1 && break
    sleep 1
  done
else
  UV_PID=""
fi

cd "$FE"
exec npm run dev
