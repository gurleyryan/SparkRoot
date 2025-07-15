@echo off
echo Starting MTG Deck Optimizer Flask App...
cd /d "%~dp0\src"
..\.venv\Scripts\python.exe app.py
pause
