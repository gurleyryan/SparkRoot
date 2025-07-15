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
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    
    # Set SQLite fallback for deployment if Supabase connection fails
    if 'DATABASE_URL' not in os.environ or 'postgres' in os.environ.get('DATABASE_URL', ''):
        print("🔧 Setting SQLite fallback for deployment...")
        os.environ['DATABASE_URL'] = 'sqlite:///./data/mtg_optimizer.db'
    
    # Import the app from backend.main
    from backend.main import app
    
    print(f"🚀 Starting MTG Deck Optimizer on port {port}")
    print(f"📂 Current directory: {os.getcwd()}")
    print(f"💾 Database: {os.environ.get('DATABASE_URL', 'Not set')}")
    
    try:
        uvicorn.run(app, host="0.0.0.0", port=port)
    except Exception as e:
        print(f"❌ Failed to start app: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
