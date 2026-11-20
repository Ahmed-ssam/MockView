@echo off
rem MockView, local mode (Windows). Needs Python 3.10+ and Node 20+. Double-click to run.
title MockView (keep this window open; close it to stop MockView)
cd /d "%~dp0"
where python >nul 2>nul || (echo Python 3 is required: https://www.python.org/downloads/ & pause & exit /b 1)
where node >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org/ & pause & exit /b 1)
if not exist data mkdir data
set LOCAL_MODE=1
set MOCKVIEW_DATA_DIR=%CD%\data
set DATABASE_URL=sqlite:///%CD:\=/%/data/mockview.db
set CORS_ORIGINS=http://localhost:3000
set LLM_PROVIDER=demo
set NEXT_PUBLIC_API_URL=http://localhost:8000
if not exist backend\.venv (
  echo First run: installing the backend (one time)
  python -m venv backend\.venv || goto :fail
  backend\.venv\Scripts\pip install -q -r backend\requirements.txt || goto :fail
)
if not exist frontend\.next (
  echo First run: installing and building the frontend (a few minutes, one time)
  pushd frontend
  call npm ci --no-audit --no-fund || goto :fail
  call npm run build || goto :fail
  popd
)
pushd backend
..\backend\.venv\Scripts\alembic upgrade head || goto :fail
rem /b = run inside THIS window, so only one window exists and closing it stops everything.
start "" /b ..\backend\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
popd
pushd frontend
start "" /b cmd /c npx next start -H 127.0.0.1 -p 3000
popd
timeout /t 8 >nul
start http://localhost:3000
echo.
echo MockView is running at http://localhost:3000
echo Keep this window open while you use MockView. Close it (or press Ctrl+C) to stop MockView.
echo.
pause >nul
exit /b 0
:fail
echo Something failed. Scroll up for the error message.
pause
exit /b 1
