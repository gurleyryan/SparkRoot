#!/usr/bin/env python3
"""
Start the MTG Deck Optimizer API server with proper environment variables
"""
import os
import subprocess
import sys

# Set environment variables
os.environ["SUPABASE_URL"] = "https://pvqjgpjnrdlhvowttgmd.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWpncGpucmRsaHZvd3R0Z21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNzY3NDMsImV4cCI6MjA1MTk1Mjc0M30.xEFFqTOIr4OUmyF9vJPGJJ7KK1J6xk7mfOTrh1O4I1s"
os.environ["SUPABASE_SERVICE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cWpncGpucmRsaHZvd3R0Z21kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjM3Njc0MywiZXhwIjoyMDUxOTUyNzQzfQ.4gfIRG9GJvOJL3fE-iW8ql1zEo5YUgqRjv79D9_LTTg"

print("🚀 Starting MTG Deck Optimizer API Server...")
print("🔗 Server will be available at: http://localhost:8001")
print("📖 API Documentation at: http://localhost:8001/docs")
print("⏹️ Press Ctrl+C to stop the server")
print()

# Start the server
try:
    subprocess.run([
        sys.executable, "-m", "uvicorn", 
        "backend.main:app", 
        "--host", "0.0.0.0", 
        "--port", "8001", 
        "--reload"
    ], check=True)
except KeyboardInterrupt:
    print("\n👋 Server stopped by user")
except Exception as e:
    print(f"❌ Error starting server: {e}")
