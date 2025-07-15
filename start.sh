#!/bin/bash
# Railway deployment script

echo "Setting up MTG Deck Optimizer Backend..."

# Install dependencies
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt

# Start the application
echo "Starting FastAPI application..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
