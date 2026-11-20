# MockView — AI mock technical interviews

A free-first interview simulator: pick one of 64 specializations, hold a **spoken** interview with an AI interviewer
(welcome → "tell me about yourself" → exactly 10 questions with adaptive follow-ups), then get a deterministic scored
report with a radar chart, strengths/gaps, recommendations, a roadmap, PDF export, history, progress and comparison.

**Stack:** Next.js (App Router) · TypeScript · Tailwind · Recharts · FastAPI · SQLAlchemy · Alembic · Supabase (auth) · PostgreSQL.

## Honest status
Verified here: backend tests (SQLite **and** PostgreSQL), 33 frontend tests, type-check, production build, and a
Playwright end-to-end + axe accessibility suite (demo mode, mock login). **Not verified by the author:** a live Supabase
project, a live LLM call, real microphones/voices and the Windows/macOS installers, expert review of the question content for all 64
specializations, legal review of `/privacy` and `/terms`, and brand/image rights (the logo is an SVG recreation).
Demo mode is clearly labeled and its scores are excluded from progress stats. Usage is limited (see below); nothing promises unlimited use.

## Install it like a normal app (recommended for end users)
MockView is a **desktop application**: it has its own window, its own taskbar icon (the MockView logo) and no browser address bar.
Download the installer for your system from the project's **Releases** page:
- **Windows:** `MockView_installer.exe` (stable link: `https://github.com/<you>/<repo>/releases/latest/download/MockView_installer.exe`). Double-click it, choose the install folder, watch the progress bar, Finish. A **MockView** icon appears on the desktop and in the Start menu. No Python, Node or browser needed.
- **macOS:** open `MockView.dmg`, drag MockView to Applications. First launch: right-click → Open (the app is not signed by Apple).
- **Linux:** make `MockView.AppImage` executable and double-click it.

Double-click the icon to start. On first launch, open **API key & settings**, paste your free Gemini key, press **Check key & load my models**, pick a model from the list, **Test key**, **Save**.
Interviewer voices use the operating system's installed voices. **Spoken answers** are recorded in the app and transcribed with *your* Gemini key (the audio is sent to Google for that one request and never stored by MockView). Without a key you can type answers.
Your data and key live in `%APPDATA%\MockView` (Windows), `~/Library/Application Support/MockView` (macOS) or `~/.config/MockView` (Linux).
Windows may show a "Windows protected your PC" notice because the installer is not code-signed: choose **More info → Run anyway**.
The four interviewers are shown by their role only (no personal names).

### Publishing a release (maintainers)
Push a tag: `git tag v1.0.0 && git push origin v1.0.0`. `.github/workflows/release.yml` builds the three installers with electron-builder on GitHub's free runners and attaches them to the Release. Icons come from `desktop/assets/make_icons.py` (copy its outputs into `electron/build/`). Shell: `electron/main.js` + `electron/package.json`; local API: `desktop/server_main.py`. To build locally: build the frontend with `NEXT_PUBLIC_API_URL=http://localhost:8000`, run `python desktop/package_web.py desktop/dist`, `pyinstaller desktop/mockview.spec --distpath desktop/dist`, then `cd electron && npm install && npx electron-builder`.

## Run from source on your own computer (free, no account)
This is the recommended way. Nothing is hosted, so it costs nothing, and your interviews stay on your machine.
You need **Python 3.10+**, **Node.js 20+** and **Chrome or Edge** (for voice).

- **Mac / Linux:** open a terminal in this folder and run `./start.sh`
- **Windows:** double-click `start.bat` (it keeps one window open; close that window to stop MockView)

The first run installs and builds everything (a few minutes). Then your browser opens http://localhost:3000.
1. Open **Settings** and paste your free Gemini key from https://aistudio.google.com/apikey, then press **Test key** and **Save**.
2. Press **Start New Interview**, allow the microphone, and answer out loud.

Without a key, MockView runs in a clearly labeled **demo mode** (simulated questions and scores, excluded from progress stats).
Your key and data live in the `data/` folder next to the scripts (key file is owner-only). The key is sent only to Google and is never shown again after saving.
Local mode (`LOCAL_MODE=1`, set by the scripts) has no accounts, no usage limits (you are spending your own Gemini quota) and only answers requests addressed to localhost.
To reset everything, stop the app and delete the `data/` folder.

## Developer setup (hosted mode, with Supabase login)
```bash
cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env && alembic upgrade head && uvicorn app.main:app --reload     # :8000
cd ../frontend && cp .env.example .env.local && npm ci && npm run dev               # :3000
```
Sign-in needs Supabase (below). `./e2e/run.sh` runs the whole app with a mock login if you just want to click through.

## Configure
1. **Supabase:** create a project; put URL + anon key in `frontend/.env.local`, and the **JWT secret** in `backend/.env` (`SUPABASE_JWT_SECRET`). Optional `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server only) lets "Delete my account" remove the login too.
2. **AI provider** (`backend/.env`): `LLM_PROVIDER=openai_compatible | anthropic | gemini | demo`, plus `LLM_MODEL`, `LLM_API_KEY` (and `LLM_BASE_URL` for OpenAI-compatible). Gemini keys from Google AI Studio start with `AQ.` (newer) or `AIza` (older); both work. `AQ.` keys are tried on the Gemini API first and on Vertex AI second.
   Check it from your own machine: `cd backend && python -m app.tools.check_llm` (never prints the key).
3. **Database:** `alembic upgrade head` (the Docker image does this on start). Use Postgres in production.
4. **Admin:** in Supabase → Authentication → Users → edit the user's **app_metadata** to `{"role":"admin"}` (not user_metadata, which users can edit). Admins see metadata only, never answers or resumes.
5. **Cost limits:** `DAILY_INTERVIEW_LIMIT` per user (default 3), `GLOBAL_DAILY_INTERVIEW_LIMIT` site-wide (default 300, 0 = off).

## Docker
```bash
docker compose up --build     # db + backend :8000 + frontend :3000
```
`NEXT_PUBLIC_*` values are baked in at build time (compose passes them as build args).

## Tests
```bash
cd backend && pytest -q                                   # SQLite
TEST_DATABASE_URL=postgresql+psycopg://u:p@host/db pytest -q   # PostgreSQL
cd frontend && npx tsc --noEmit && npm test && npm run build
./e2e/run.sh                                              # needs Chromium: npx playwright install chromium
```

## Privacy by design
Audio is never recorded or stored (speech is transcribed in the browser by the Web Speech API — note some browsers send it to their speech service). Only answer text is stored; resumes only with consent. Users can hard-delete an interview, a resume, or all their data.

## Operations notes
- Run the backend with **one worker**: the write rate limiter is in-memory. Scale out only after moving it to Redis.
- Behind a proxy you control, set `TRUST_PROXY=1`. Set `APP_ENV=production` (hides API docs). Optional `SENTRY_DSN`.
- Scoring is deterministic (`app/scoring/engine.py`, version 1.0); the LLM only supplies per-criterion judgments.
- See `docs/DEPLOYMENT.md`.
