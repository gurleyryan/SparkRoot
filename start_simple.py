#!/usr/bin/env python3
"""
Simple Railway starter - Alternative approach
"""
import os
import subprocess
import sys

if __name__ == "__main__":
    # Get port from environment
    port = os.environ.get("PORT", "8000")
    
    # Change to backend directory and run uvicorn
    os.chdir("/app/backend")
    
    # Run uvicorn directly
    cmd = [
        sys.executable, "-m", "uvicorn", 
        "main:app", 
        "--host", "0.0.0.0", 
        "--port", port
    ]
    
    print(f"Starting FastAPI with command: {' '.join(cmd)}")
    subprocess.run(cmd)
