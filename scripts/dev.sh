#!/bin/bash
# Development startup script

echo "🚀 Starting MTG Deck Optimizer Development Environment"

# Get the project root directory (parent of scripts)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Start backend
echo "📡 Starting FastAPI backend..."
cd "$PROJECT_ROOT/backend"
python main.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting Next.js frontend..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo "✅ Development servers started!"
echo "🔗 Frontend: http://localhost:3000 (or next available port)"
echo "🔗 Backend:  http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for Ctrl+C
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
