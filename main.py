#!/usr/bin/env python3
"""
Main entry point for Railway deployment.
This file exists to satisfy Railway's expectation of finding main.py in the root.
"""
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

if __name__ == "__main__":
    # Use the same logic as run.py for consistency
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    
    # Import the app from backend.main
    from backend.main import app
    
    print(f"🚀 Starting MTG Deck Optimizer on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
