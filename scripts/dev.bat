@echo off
REM Windows development startup script

echo 🚀 Starting MTG Deck Optimizer Development Environment

REM Get the project root directory (parent of scripts)
set PROJECT_ROOT=%~dp0..

REM Start backend
echo 📡 Starting FastAPI backend...
start "Backend Server" cmd /k "cd /d %PROJECT_ROOT%\backend && python main.py"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend  
echo 🎨 Starting Next.js frontend...
start "Frontend Server" cmd /k "cd /d %PROJECT_ROOT%\frontend && npm run dev"

echo ✅ Development servers started!
echo 🔗 Frontend: http://localhost:3000 (or next available port)
echo 🔗 Backend:  http://localhost:8000
echo.
echo Press any key to continue...
pause > nul
