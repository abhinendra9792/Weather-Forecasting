@echo off
title SkyPulse Weather App
color 0B

echo.
echo  ============================================
echo     SkyPulse - Smart Weather Platform
echo  ============================================
echo.

:: Change to the folder where this bat file lives
cd /d "%~dp0"

:: ── Kill any process already on port 5000 ──────────────────
echo  [1/3] Checking port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING" 2^>nul') do (
    echo         Stopping old process on port 5000 ^(PID: %%a^)...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 /nobreak >nul
)
echo         Port 5000 is ready.

:: ── Check Python ──────────────────────────────────────────
echo  [2/3] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ERROR: Python not found! Install from https://python.org
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('python --version 2^>^&1') do echo         %%v found.

:: ── Install dependencies if needed ──────────────────────────
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo         Flask missing. Installing requirements...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo  ERROR: pip install failed. Run manually: pip install -r requirements.txt
        pause
        exit /b 1
    )
)
echo         Dependencies OK.

:: ── Start Flask + open browser ──────────────────────────────
echo  [3/3] Starting Flask server...
echo.
echo  ┌─────────────────────────────────────────────┐
echo  │  URL  :  http://localhost:5000              │
echo  │  Stop :  Close this window or press Ctrl+C  │
echo  └─────────────────────────────────────────────┘
echo.

:: Open browser after 2 seconds (in background)
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: Run Flask (blocking - keeps window open)
python Backend\app.py

echo.
echo  Server stopped.
pause
