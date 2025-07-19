#!/usr/bin/env python3
"""
Main entry point for Railway deployment.
This file exists to satisfy Railway's expectation of finding main.py in the root.
"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    
    # Check if we have Supabase configuration
    supabase_url = os.environ.get('SUPABASE_URL')
    database_url = os.environ.get('DATABASE_URL')
    
    if supabase_url:
        print(f"� Using Supabase REST API: {supabase_url}")
    elif database_url and not database_url.startswith('sqlite'):
        print(f"📊 Using database: {database_url[:50]}...")
    else:
        print("🔧 Using SQLite for local development")
        os.environ['DATABASE_URL'] = 'sqlite:///./data/mtg_optimizer.db'
    
    # Import the app from backend.main
    from backend.main import app
    
    print(f"🚀 Starting SparkRoot on port {port}")
    print(f"📂 Current directory: {os.getcwd()}")
    
    try:
        uvicorn.run(app, host="0.0.0.0", port=port)
    except Exception as e:
        print(f"❌ Failed to start app: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
