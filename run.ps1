# PowerShell script to start backend and frontend dev servers in VS Code integrated terminals
# Start backend (FastAPI) using root run.py
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'python run.py' -WorkingDirectory $PSScriptRoot

# Start frontend (Next.js)
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd frontend; npm run dev' -WorkingDirectory $PSScriptRoot

Write-Host "Started backend and frontend in separate VS Code terminals."