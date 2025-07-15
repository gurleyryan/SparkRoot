#!/bin/bash
# Railway deployment script for MTG Deck Optimizer

echo "Starting MTG Deck Optimizer Backend..."

# Navigate to app directory
cd /app

# Install dependencies from backend folder
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt

# Start the FastAPI application
echo "Starting FastAPI application..."
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
