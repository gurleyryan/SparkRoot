#!/usr/bin/env python3
"""
Supabase Setup Script for SparkRoot
Helps configure the environment for Supabase deployment
"""

import sys
import subprocess
from pathlib import Path

def print_header(text):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")

def print_step(step_num, text):
    print(f"\n🔧 Step {step_num}: {text}")

def print_success(text):
    print(f"✅ {text}")

def print_warning(text):
    print(f"⚠️  {text}")

def print_error(text):
    print(f"❌ {text}")

def check_requirements():
    """Check if required tools are installed"""
    print_step(1, "Checking requirements")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print_error("Python 3.8+ is required")
        return False
    print_success("Python version is compatible")
    
    # Check if pip is available
    try:
        subprocess.run(["pip", "--version"], check=True, capture_output=True)
        print_success("pip is available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print_error("pip is not available")
        return False
    
    # Check if npm is available
    try:
        subprocess.run(["npm", "--version"], check=True, capture_output=True)
        print_success("npm is available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print_warning("npm is not available (needed for frontend)")
    
    return True

def install_backend_dependencies():
    """Install backend dependencies including psycopg2"""
    print_step(2, "Installing backend dependencies")
    
    backend_dir = Path("backend")
    if not backend_dir.exists():
        print_error("Backend directory not found")
        return False
    
    requirements_file = backend_dir / "requirements.txt"
    if not requirements_file.exists():
        print_error(f"Requirements file not found: {requirements_file}")
        return False
    
    try:
        # Install requirements from the project root
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", 
            str(requirements_file)
        ], check=True)
        print_success("Backend dependencies installed")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to install backend dependencies: {e}")
        return False

def create_env_files():
    """Create environment files from examples"""
    print_step(3, "Creating environment files")
    
    # Backend .env
    backend_env_example = Path("backend/.env.example")
    backend_env = Path("backend/.env")
    
    if backend_env_example.exists() and not backend_env.exists():
        backend_env.write_text(backend_env_example.read_text())
        print_success("Created backend/.env from example")
        print_warning("Please update backend/.env with your Supabase credentials")
    elif backend_env.exists():
        print_success("backend/.env already exists")
    
    # Frontend .env.local
    frontend_env_example = Path("frontend/.env.local.example")
    frontend_env = Path("frontend/.env.local")
    
    if frontend_env_example.exists() and not frontend_env.exists():
        frontend_env.write_text(frontend_env_example.read_text())
        print_success("Created frontend/.env.local from example")
        print_warning("Please update frontend/.env.local with your API URL")
    elif frontend_env.exists():
        print_success("frontend/.env.local already exists")

def install_frontend_dependencies():
    """Install frontend dependencies"""
    print_step(4, "Installing frontend dependencies")
    
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print_error("Frontend directory not found")
        return False
    
    # Check if package.json exists
    package_json = frontend_dir / "package.json"
    if not package_json.exists():
        print_error("package.json not found in frontend directory")
        return False
    
    try:
        subprocess.run(["npm", "install"], check=True, cwd=frontend_dir)
        print_success("Frontend dependencies installed")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to install frontend dependencies: {e}")
        print_warning("You can install them manually later with: cd frontend && npm install")
        return True
    except FileNotFoundError:
        print_warning("npm not found, skipping frontend dependencies")
        print_warning("Install Node.js and npm, then run: cd frontend && npm install")
        return True

def print_next_steps():
    """Print next steps for the user"""
    print_header("Next Steps")
    
    print("\n📋 Complete your setup:")
    print("1. Create your Supabase project at https://supabase.com")
    print("2. Run the SQL in 'supabase_setup.sql' in your Supabase SQL Editor")
    print("3. Update backend/.env with your Supabase credentials:")
    print("   - SUPABASE_URL")
    print("   - SUPABASE_ANON_KEY") 
    print("   - SUPABASE_SERVICE_KEY")
    print("   - DATABASE_URL")
    print("4. Update frontend/.env.local with your API URL")
    print("5. Test locally:")
    print("   - Backend: cd backend && python main.py")
    print("   - Frontend: cd frontend && npm run dev")
    
    print("\n📚 For detailed deployment instructions, see:")
    print("   - SUPABASE_DEPLOYMENT.md")
    
    print("\n🚀 Ready to deploy? Check the deployment guide in README.md")

def main():
    """Main setup function"""
    print_header("SparkRoot - Supabase Setup")
    
    if not check_requirements():
        print_error("Requirements check failed")
        sys.exit(1)
    
    if not install_backend_dependencies():
        print_error("Backend setup failed")
        sys.exit(1)
    
    create_env_files()
    install_frontend_dependencies()
    
    print_success("Setup complete!")
    print_next_steps()

if __name__ == "__main__":
    main()
