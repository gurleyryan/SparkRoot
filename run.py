#!/usr/bin/env python3
"""
Railway deployment runner for MTG Deck Optimizer
This file allows Railway to start the FastAPI app from the root directory
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

# Import and run the FastAPI app
if __name__ == "__main__":
    import uvicorn
    from backend.main import app
    
    # Get port from environment (Railway sets this)
    port = int(os.environ.get("PORT", 8000))
    
    # Start the server
    uvicorn.run(
        app,
        host="0.0.0.0", 
        port=port,
        log_level="info"
    )
