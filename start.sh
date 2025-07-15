#!/bin/bash
# Railway start script - backup method
echo "🚀 Starting MTG Deck Optimizer"
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"

# Ensure we're in the right directory
cd /app || exit 1

# Start the application using our run.py
exec python run.py
