# Audit Script for MTG Deck Optimizer
# This script checks for common security, dependency, and configuration issues in the repo.

import os
import sys
import subprocess

REQUIRED_FILES = [
    'requirements.txt',
    'frontend/package.json',
    'backend/main.py',
    'API_DOCS.md',
]

REQUIRED_ENV_VARS = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'SENTRY_DSN',
]

def check_files():
    missing = [f for f in REQUIRED_FILES if not os.path.exists(f)]
    if missing:
        print(f"Missing required files: {missing}")
        return False
    print("All required files present.")
    return True

def check_env():
    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        print(f"Missing required environment variables: {missing}")
        return False
    print("All required environment variables set.")
    return True

def check_dependencies():
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'check'], check=True)
        print("Python dependencies OK.")
    except Exception as e:
        print(f"Python dependency issue: {e}")
    try:
        subprocess.run(['npm', 'audit', '--prefix', 'frontend'], check=True)
        print("Frontend dependencies OK.")
    except Exception as e:
        print(f"Frontend dependency issue: {e}")

def main():
    print("--- MTG Deck Optimizer Audit ---")
    check_files()
    check_env()
    check_dependencies()
    print("Audit complete.")

if __name__ == "__main__":
    main()
