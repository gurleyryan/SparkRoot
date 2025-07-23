#!/usr/bin/env python3
"""
Railway deployment runner for SparkRoot
This file allows Railway to start the FastAPI app from the root directory
"""

import sys
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv("backend/.env")

def main():
    # Print debug info
    print("🔍 Debug Info (run.py main() called):")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Python path: {sys.path}")
    print(f"Contents of current directory: {os.listdir('.')}")
    print(f"Environment variables: {os.environ}")
    
    # Check for backend directory
    backend_path = Path("backend")
    if backend_path.exists():
        print(f"✅ Found backend directory at: {backend_path.absolute()}")
        print(f"Backend contents: {list(backend_path.iterdir())}")
        
        # Add backend to Python path but keep working directory as root
        sys.path.insert(0, str(backend_path.absolute()))
        
        # DON'T change directory - keep at root so relative paths work
        print(f"Staying in root directory: {os.getcwd()}")
        
    else:
        print("❌ Backend directory not found!")
        print("Available directories:")
        for item in Path(".").iterdir():
            if item.is_dir():
                print(f"  📁 {item}")
        return 1
    
    # Check if main.py exists in backend directory
    main_py_path = backend_path / "main.py"
    if not main_py_path.exists():
        print("❌ main.py not found in backend directory!")
        print("Backend contents:")
        for item in backend_path.iterdir():
            print(f"  📄 {item}")
        return 1
    
    # Now try to import and run
    try:
        print("[DEBUG] Importing uvicorn...")
        import uvicorn
        print("[DEBUG] Importing backend.main.app...")
        from backend.main import app
        print("[DEBUG] Successfully imported app from backend.main")
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
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
