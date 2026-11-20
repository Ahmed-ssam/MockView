#!/usr/bin/env bash
# MockView, local mode: runs on YOUR computer, no account, no cloud. Needs Python 3.10+ and Node 20+.
#   ./start.sh          install (first run), then start and open http://localhost:3000
# Your data (interviews, settings, your Gemini key) lives in ./data and never leaves this machine,
# except requests to Google's Gemini API when you add a key.
set -euo pipefail
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo "Python 3 is required: https://www.python.org/downloads/"; exit 1; }
command -v node    >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org/"; exit 1; }
mkdir -p data

export LOCAL_MODE=1 MOCKVIEW_DATA_DIR="$PWD/data" DATABASE_URL="sqlite:///$PWD/data/mockview.db"
export CORS_ORIGINS=http://localhost:3000 LLM_PROVIDER=demo
export NEXT_PUBLIC_API_URL=http://localhost:8000

if [ ! -d backend/.venv ]; then
  echo "== First run: installing the backend (one time)"
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
if [ ! -d frontend/.next ]; then
  echo "== First run: installing and building the frontend (a few minutes, one time)"
  (cd frontend && npm ci --no-audit --no-fund && npm run build)
fi

(cd backend && .venv/bin/alembic upgrade head)

(cd backend && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1) & API=$!
(cd frontend && exec npx next start -H 127.0.0.1 -p 3000) & WEB=$!
trap 'kill $API $WEB 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 60); do curl -fs http://localhost:3000 >/dev/null 2>&1 && break; sleep 1; done
echo; echo "MockView is running:  http://localhost:3000   (press Ctrl+C to stop)"
echo "Add your free Gemini key in Settings for real AI interviews. Use Chrome or Edge for voice."
(xdg-open http://localhost:3000 || open http://localhost:3000) >/dev/null 2>&1 || true
wait
