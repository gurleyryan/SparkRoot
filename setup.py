#!/usr/bin/env python3
"""
MTG Collection Manager Setup Script
Installs dependencies and initializes the database
"""

import subprocess
import sys
import os
import sqlite3
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print(f"Output: {result.stdout}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed")
        print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        print(f"Current version: {version.major}.{version.minor}.{version.micro}")
        return False
    
    print(f"✅ Python version check passed ({version.major}.{version.minor}.{version.micro})")
    return True

def install_python_dependencies():
    """Install Python packages from requirements.txt"""
    if not os.path.exists('requirements.txt'):
        print("❌ requirements.txt not found")
        return False
    
    return run_command(
        f"{sys.executable} -m pip install -r requirements.txt",
        "Installing Python dependencies"
    )

def install_node_dependencies():
    """Install Node.js dependencies"""
    frontend_dir = Path("frontend")
    if not frontend_dir.exists():
        print("⚠️  Frontend directory not found, skipping Node.js setup")
        return True
    
    # Check if package.json exists
    package_json = frontend_dir / "package.json"
    if not package_json.exists():
        print("📦 Creating package.json for frontend...")
        create_package_json()
    
    # Change to frontend directory and install
    original_dir = os.getcwd()
    try:
        os.chdir(frontend_dir)
        success = run_command("npm install", "Installing Node.js dependencies")
        return success
    finally:
        os.chdir(original_dir)

def create_package_json():
    """Create a basic package.json for the frontend"""
    package_json_content = """{
  "name": "mtg-collection-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/node": "20.10.0",
    "@types/react": "18.2.42",
    "@types/react-dom": "18.2.17",
    "autoprefixer": "10.4.16",
    "eslint": "8.55.0",
    "eslint-config-next": "15.0.3",
    "postcss": "8.4.32",
    "tailwindcss": "3.3.6",
    "typescript": "5.3.3"
  }
}"""
    
    with open("frontend/package.json", "w") as f:
        f.write(package_json_content)
    print("✅ Created package.json")

def create_directories():
    """Create necessary directories"""
    directories = [
        "data",
        "user-data",
        "backend",
        "frontend/components",
        "frontend/pages",
        "frontend/styles"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"📁 Created directory: {directory}")

def initialize_database():
    """Initialize the SQLite database"""
    print("\n🗄️  Initializing database...")
    
    # Ensure data directory exists
    Path("data").mkdir(exist_ok=True)
    
    # Create database connection
    db_path = "data/mtg_optimizer.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                display_name TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                profile_public BOOLEAN DEFAULT FALSE
            )
        ''')
        
        # Create user settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                price_source TEXT DEFAULT 'tcgplayer',
                currency TEXT DEFAULT 'USD',
                reference_price TEXT DEFAULT 'market',
                profile_public BOOLEAN DEFAULT FALSE,
                notifications_enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create collections table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                name TEXT NOT NULL,
                description TEXT,
                collection_data TEXT,  -- JSON data
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create social integrations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS social_integrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                provider TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                provider_email TEXT,
                access_token TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, provider)
            )
        ''')
        
        # Create price cache table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS price_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_name TEXT NOT NULL,
                set_code TEXT NOT NULL,
                source TEXT NOT NULL,
                market_price REAL,
                low_price REAL,
                high_price REAL,
                currency TEXT DEFAULT 'USD',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(card_name, set_code, source)
            )
        ''')
        
        conn.commit()
        print("✅ Database initialized successfully")
        
        # Show table info
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"📊 Created tables: {[table[0] for table in tables]}")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False
    finally:
        conn.close()
    
    return True

def create_env_template():
    """Create a template .env file"""
    env_content = """# MTG Collection Manager Environment Variables

# Security
SECRET_KEY=your-secret-key-here-generate-a-secure-one

# TCGPlayer API (optional - for pricing)
TCGPLAYER_PUBLIC_KEY=your-tcgplayer-public-key
TCGPLAYER_PRIVATE_KEY=your-tcgplayer-private-key

# Database
DATABASE_URL=sqlite:///data/mtg_optimizer.db

# Development
DEBUG=true
"""
    
    if not os.path.exists('.env'):
        with open('.env', 'w') as f:
            f.write(env_content)
        print("✅ Created .env template file")
        print("⚠️  Please edit .env with your actual API keys")
    else:
        print("⚠️  .env file already exists, skipping creation")

def check_scryfall_data():
    """Check if Scryfall data exists"""
    scryfall_path = "data/scryfall_all_cards.json"
    if not os.path.exists(scryfall_path):
        print(f"⚠️  Scryfall data not found at {scryfall_path}")
        print("💡 You can download it from: https://api.scryfall.com/bulk-data")
        print("💡 Look for 'Default Cards' and save as scryfall_all_cards.json in the data/ directory")
        return False
    else:
        # Check file size
        size_mb = os.path.getsize(scryfall_path) / (1024 * 1024)
        print(f"✅ Scryfall data found ({size_mb:.1f} MB)")
        return True

def main():
    """Main setup function"""
    print("🎮 MTG Collection Manager Setup")
    print("=" * 50)
    
    # Change to script directory
    script_dir = Path(__file__).parent.absolute()
    os.chdir(script_dir)
    print(f"📂 Working directory: {script_dir}")
    
    success_count = 0
    total_steps = 7
    
    # Step 1: Check Python version
    if check_python_version():
        success_count += 1
    
    # Step 2: Create directories
    create_directories()
    success_count += 1
    
    # Step 3: Install Python dependencies
    if install_python_dependencies():
        success_count += 1
    
    # Step 4: Install Node.js dependencies
    if install_node_dependencies():
        success_count += 1
    
    # Step 5: Initialize database
    if initialize_database():
        success_count += 1
    
    # Step 6: Create environment template
    create_env_template()
    success_count += 1
    
    # Step 7: Check Scryfall data
    if check_scryfall_data():
        success_count += 1
    
    # Summary
    print("\n" + "=" * 50)
    print("🎯 Setup Summary")
    print(f"✅ {success_count}/{total_steps} steps completed successfully")
    
    if success_count == total_steps:
        print("\n🎉 Setup completed successfully!")
        print("\n🚀 Next steps:")
        print("1. Edit .env file with your API keys (optional)")
        print("2. Download Scryfall data if needed")
        print("3. Start the backend: cd backend && python main.py")
        print("4. Start the frontend: cd frontend && npm run dev")
    else:
        print(f"\n⚠️  Setup completed with {total_steps - success_count} issues")
        print("Please review the errors above and run setup again if needed")

if __name__ == "__main__":
    main()
