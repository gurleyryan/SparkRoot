# User Authentication and Data Management API

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from typing import Optional, List
from pydantic import BaseModel, EmailStr
import secrets

# Import Supabase database connection
from supabase_db import db

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Database Models (Pydantic)
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    display_name: Optional[str]
    is_active: bool
    created_at: datetime
    profile_public: bool = False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class CollectionSave(BaseModel):
    name: str
    description: Optional[str] = None
    collection_data: List[dict]
    is_public: bool = False

class UserSettings(BaseModel):
    price_source: str = "tcgplayer"  # tcgplayer, cardmarket, cardkingdom, cardhoarder
    currency: str = "USD"
    reference_price: str = "market"  # market, low, high
    profile_public: bool = False
    notifications_enabled: bool = True

class SocialIntegration(BaseModel):
    provider: str  # google, apple, moxfield, etc.
    provider_id: str
    provider_email: Optional[str] = None
    access_token: Optional[str] = None

# Database initialization
def init_database():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect('../data/mtg_optimizer.db')
    cursor = conn.cursor()
    
    # Users table
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
    
    # User settings table
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
    
    # Collections table
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
    
    # Social integrations table
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
    
    # Price data cache table
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
    conn.close()

# Authentication utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    conn = sqlite3.connect('../data/mtg_optimizer.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? AND is_active = TRUE", (email,))
    user = cursor.fetchone()
    conn.close()
    
    if user is None:
        raise credentials_exception
    return user

# Database operations
class UserManager:
    @staticmethod
    def create_user(user_data: UserCreate):
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (user_data.email,))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user
        password_hash = get_password_hash(user_data.password)
        cursor.execute('''
            INSERT INTO users (email, password_hash, first_name, last_name, display_name)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_data.email, password_hash, user_data.first_name, 
              user_data.last_name, user_data.display_name))
        
        user_id = cursor.lastrowid
        
        # Create default settings
        cursor.execute('''
            INSERT INTO user_settings (user_id) VALUES (?)
        ''', (user_id,))
        
        conn.commit()
        conn.close()
        return user_id
    
    @staticmethod
    def authenticate_user(email: str, password: str):
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.close()
        
        if not user or not verify_password(password, user[2]):  # user[2] is password_hash
            return False
        return user
    
    @staticmethod
    def get_user_collections(user_id: int):
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, description, is_public, created_at, updated_at
            FROM collections WHERE user_id = ?
            ORDER BY updated_at DESC
        ''', (user_id,))
        collections = cursor.fetchall()
        conn.close()
        return collections
    
    @staticmethod
    def save_collection(user_id: int, collection_data: CollectionSave):
        import json
        
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO collections (user_id, name, description, collection_data, is_public)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, collection_data.name, collection_data.description,
              json.dumps(collection_data.collection_data), collection_data.is_public))
        
        collection_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return collection_id
    
    @staticmethod
    def get_user_settings(user_id: int):
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
        settings = cursor.fetchone()
        conn.close()
        return settings
    
    @staticmethod
    def update_user_settings(user_id: int, settings: UserSettings):
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE user_settings SET
                price_source = ?, currency = ?, reference_price = ?,
                profile_public = ?, notifications_enabled = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        ''', (settings.price_source, settings.currency, settings.reference_price,
              settings.profile_public, settings.notifications_enabled, user_id))
        conn.commit()
        conn.close()

# Initialize database on import
os.makedirs('../data', exist_ok=True)
init_database()
