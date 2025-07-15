#!/usr/bin/env python3
"""
Railway deployment script for MTG Deck Optimizer backend - TEST VERSION
This version tests the deployment structure without starting the server
"""

import sys
import os
from pathlib import Path

def main():
    print("🔍 Debug Info:")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Python path: {sys.path}")
    print(f"Contents of current directory: {sorted(os.listdir('.'))}")
    
    # Look for backend directory
    backend_path = Path("backend")
    if backend_path.exists():
        print(f"✅ Found backend directory at: {backend_path.absolute()}")
        print(f"Backend contents: {list(backend_path.iterdir())}")
        
        # Change to backend directory
        os.chdir(backend_path)
        print(f"Changed to: {os.getcwd()}")
        
        # Check for required files
        required_files = ["main.py", "requirements.txt"]
        missing_files = []
        for file in required_files:
            if not Path(file).exists():
                missing_files.append(file)
            else:
                print(f"✅ Found {file}")
        
        if missing_files:
            print(f"❌ Missing required files: {missing_files}")
            return 1
        
        print("✅ All required files found! Deployment structure is correct.")
        print("🎯 Would start server here with: uvicorn main:app --host 0.0.0.0 --port $PORT")
        return 0
    else:
        print(f"❌ Backend directory not found!")
        return 1

if __name__ == "__main__":
    exit(main())
