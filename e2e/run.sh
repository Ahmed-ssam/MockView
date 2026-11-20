#!/usr/bin/env bash
# End-to-end + accessibility tests against a real build of the app.
#   ./e2e/run.sh            run everything
#   ./e2e/run.sh voice a11y run only the named specs (voice dash pdf resume practice admin-user admin-admin a11y local)
# Needs: python deps from backend/requirements.txt, node 18+, Chromium via Playwright (npx playwright install chromium).
# The app runs in DEMO mode on a throwaway SQLite database built from the real Alembic migrations; the
# Supabase login is replaced by e2e/mock_auth.py. Nothing here ever uses a real AI key.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export E2E_OUT="${E2E_OUT:-/tmp/mockview-e2e}"; mkdir -p "$E2E_OUT/shots"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
DB=/tmp/e2e.db
PIDS=()
stop() {
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done; PIDS=()
  # belt and braces: make sure nothing from a previous spec still holds the ports
  pkill -f "uvicorn app.main:app" 2>/dev/null; pkill -f "e2e/mock_auth.py" 2>/dev/null
  for port in 8000 54321; do for _ in $(seq 1 20); do python3 -c "import socket;socket.create_connection(('127.0.0.1',$port),0.2).close()" 2>/dev/null || break; sleep 0.25; done; done
}
cleanup() { stop; pkill -f "next start" 2>/dev/null; pkill -f next-server 2>/dev/null; rm -f "$DB"; }
trap cleanup EXIT

export NEXT_PUBLIC_API_URL=http://localhost:8000 NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon
echo "== building frontend"
(cd "$ROOT/frontend" && npm run build >"$E2E_OUT/build.log" 2>&1) || { tail -20 "$E2E_OUT/build.log"; echo "BUILD FAILED"; exit 1; }
# `output: standalone` needs static assets beside the server; `next start` is simpler and equivalent for tests.
(cd "$ROOT/frontend" && nohup npx next start -p 3000 >"$E2E_OUT/web.log" 2>&1 & echo $! >"$E2E_OUT/web.pid"); sleep 4

# fixtures for the resume spec
python3 - <<PY
from reportlab.pdfgen import canvas
for name, lines in (("cv.pdf", ["Jane Doe - Backend Engineer","Five years building REST APIs in Python and FastAPI.","Designed PostgreSQL schemas and Redis caching for payments.","Led migration to Docker and Kubernetes with GitHub Actions CI."]), ("scan.pdf", [""])):
    c = canvas.Canvas("$E2E_OUT/"+name); y = 800
    for l in lines: c.drawString(50, y, l); y -= 20
    c.save()
open("$E2E_OUT/notpdf.pdf", "wb").write(b"just text")
PY

wait_port() { for _ in $(seq 1 60); do python3 -c "import socket;socket.create_connection(('127.0.0.1',$1),0.3).close()" 2>/dev/null && return 0; sleep 0.5; done; echo "port $1 never opened"; return 1; }

fresh_stack() {   # $1 = 1 to make the mock user an admin
  stop; rm -f "$DB"
  (cd "$ROOT/backend" && DATABASE_URL=sqlite:///$DB alembic upgrade head >"$E2E_OUT/migrate.log" 2>&1) || { cat "$E2E_OUT/migrate.log"; return 1; }
  MOCK_ADMIN="$1" python3 "$ROOT/e2e/mock_auth.py" >"$E2E_OUT/auth.log" 2>&1 & PIDS+=($!)
  # `exec` so the PID we record IS uvicorn (not a wrapper subshell that would survive `kill`).
  ( cd "$ROOT/backend" && exec env DATABASE_URL=sqlite:///$DB SUPABASE_JWT_SECRET=e2e-secret LLM_PROVIDER=demo LLM_API_KEY= \
     CORS_ORIGINS=http://localhost:3000 DAILY_INTERVIEW_LIMIT=50 GLOBAL_DAILY_INTERVIEW_LIMIT=0 WRITE_RATE_LIMIT=1000 \
     python -m uvicorn app.main:app --port 8000 >"$E2E_OUT/api.log" 2>&1 ) & PIDS+=($!)
  wait_port 8000 && wait_port 54321
}

local_stack() {   # local mode: no login service at all, settings file in a throwaway dir
  stop; rm -f "$DB"; rm -rf "$E2E_OUT/data"; mkdir -p "$E2E_OUT/data"
  (cd "$ROOT/backend" && DATABASE_URL=sqlite:///$DB alembic upgrade head >"$E2E_OUT/migrate.log" 2>&1) || { cat "$E2E_OUT/migrate.log"; return 1; }
  ( cd "$ROOT/backend" && exec env LOCAL_MODE=1 MOCKVIEW_DATA_DIR="$E2E_OUT/data" DATABASE_URL=sqlite:///$DB LLM_PROVIDER=demo \
     CORS_ORIGINS=http://localhost:3000 python -m uvicorn app.main:app --port 8000 >"$E2E_OUT/api.log" 2>&1 ) & PIDS+=($!)
  wait_port 8000
}

declare -A SPEC=( [voice]="voice.js|0" [dash]="dash.js|0" [pdf]="pdf.js|0" [resume]="resume.js|0" [practice]="practice.js|0"
                  [admin-user]="admin.js user|0" [admin-admin]="admin.js admin|1" [a11y]="a11y.js|1" [local]="local.js|L" )
ORDER=(voice dash pdf resume practice admin-user admin-admin a11y local)
[ $# -gt 0 ] && ORDER=("$@")
FAILED=()
for name in "${ORDER[@]}"; do
  IFS='|' read -r cmd admin <<<"${SPEC[$name]}"
  [ -z "${cmd:-}" ] && { echo "unknown spec: $name"; FAILED+=("$name"); continue; }
  echo; echo "== $name"; { if [ "$admin" = L ]; then local_stack; else fresh_stack "$admin"; fi; } || { FAILED+=("$name"); continue; }
  (cd "$ROOT/e2e/specs" && timeout 600 node $cmd) | tee "$E2E_OUT/$name.log" | grep -E "FAIL|PASSED|FAILED|^      |Error" 
  grep -q "ALL CHECKS PASSED" "$E2E_OUT/$name.log" || FAILED+=("$name")
done
echo
if [ ${#FAILED[@]} -eq 0 ]; then echo "E2E: ALL SPECS PASSED"; else echo "E2E: FAILED -> ${FAILED[*]}  (logs in $E2E_OUT)"; exit 1; fi
