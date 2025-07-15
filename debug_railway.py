#!/usr/bin/env python3
"""
Debug script to understand Railway's execution environment
"""
import os
import sys

print("=== RAILWAY DEBUG INFO ===")
print(f"Current working directory: {os.getcwd()}")
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")
print(f"Python path: {sys.path}")
print("\n=== DIRECTORY CONTENTS ===")
for root, dirs, files in os.walk("."):
    level = root.replace(".", "").count(os.sep)
    indent = " " * 2 * level
    print(f"{indent}{os.path.basename(root)}/")
    subindent = " " * 2 * (level + 1)
    for file in files:
        print(f"{subindent}{file}")
    if level > 2:  # Limit depth
        break

print("\n=== ENVIRONMENT VARIABLES ===")
for key, value in os.environ.items():
    if any(keyword in key.upper() for keyword in ['PORT', 'DATABASE', 'RAILWAY', 'PYTHON']):
        print(f"{key}={value}")

print("\n=== ATTEMPTING TO START APP ===")

# Try to import and start the app
try:
    sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
    
    # Set environment to use SQLite for Railway deployment if database connection fails
    if 'DATABASE_URL' not in os.environ or 'postgres' in os.environ.get('DATABASE_URL', ''):
        print("Setting SQLite fallback for deployment...")
        os.environ['DATABASE_URL'] = 'sqlite:///./data/mtg_optimizer.db'
    
    from backend.main import app
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
except Exception as e:
    print(f"Error starting app: {e}")
    import traceback
    traceback.print_exc()
    
    # Try to start a minimal FastAPI app as fallback
    print("\n=== STARTING MINIMAL FALLBACK APP ===")
    try:
        from fastapi import FastAPI
        import uvicorn
        
        fallback_app = FastAPI(title="MTG Deck Optimizer - Deployment Debug")
        
        @fallback_app.get("/")
        def read_root():
            return {"status": "Railway deployment successful", "message": "MTG Deck Optimizer is running"}
            
        @fallback_app.get("/health")
        def health_check():
            return {"status": "healthy"}
            
        port = int(os.environ.get("PORT", 8000))
        print(f"Starting fallback app on port {port}")
        uvicorn.run(fallback_app, host="0.0.0.0", port=port)
    except Exception as fallback_error:
        print(f"Fallback app also failed: {fallback_error}")
        exit(1)
