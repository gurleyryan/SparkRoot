#!/usr/bin/env python3
"""
Railway deployment runner for MTG Deck Optimizer
This file allows Railway to start the FastAPI app from the root directory
"""

import sys
import os
from pathlib import Path

def main():
    # Print debug info
    print("🔍 Debug Info:")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Python path: {sys.path}")
    print(f"Contents of current directory: {os.listdir('.')}")
    
    # Check for backend directory
    backend_path = Path("backend")
    if backend_path.exists():
        print(f"✅ Found backend directory at: {backend_path.absolute()}")
        print(f"Backend contents: {list(backend_path.iterdir())}")
        
        # Add backend to Python path
        sys.path.insert(0, str(backend_path.absolute()))
        
        # Change to backend directory
        os.chdir(backend_path)
        print(f"Changed to: {os.getcwd()}")
        
    else:
        print("❌ Backend directory not found!")
        print("Available directories:")
        for item in Path(".").iterdir():
            if item.is_dir():
                print(f"  📁 {item}")
        return 1
    
    # Now try to import and run
    try:
        import uvicorn
        from main import app
        
        # Get port from environment
        port = int(os.environ.get("PORT", 8000))
        
        print(f"🚀 Starting FastAPI on port {port}")
        
        # Start the server
        uvicorn.run(
            app,
            host="0.0.0.0", 
            port=port,
            log_level="info"
        )
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return 1
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        return 1

if __name__ == "__main__":
    exit(main())
