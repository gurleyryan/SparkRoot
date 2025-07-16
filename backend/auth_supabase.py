# User Authentication and Data Management API - Supabase Version

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import os
from typing import Optional, List
from pydantic import BaseModel, EmailStr
import secrets
import json

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
    price_source: str = "tcgplayer"
    currency: str = "USD"
    reference_price: str = "market"
    profile_public: bool = False
    notifications_enabled: bool = True

class SocialIntegration(BaseModel):
    provider: str
    provider_id: str
    provider_email: Optional[str] = None
    access_token: Optional[str] = None

# Password handling
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# JWT token handling
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    # PyJWT returns a string in v2+
    return encoded_jwt

def get_user_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
    
    user = UserManager.get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user

class UserManager:
    @staticmethod
    async def create_user(user_data: UserCreate):
        # Check if user already exists
        existing_user = await db.execute_query_one(
            "SELECT id FROM users WHERE email = %s", 
            (user_data.email,)
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create user
        password_hash = get_password_hash(user_data.password)
        
        user_id_result = await db.execute_query_one('''
            INSERT INTO users (email, password_hash, first_name, last_name, display_name)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        ''', (user_data.email, password_hash, user_data.first_name, 
              user_data.last_name, user_data.display_name))
        user_id = user_id_result['id'] if user_id_result else None
        
        if user_id:
            # Create default settings
            await db.execute_query('''
                INSERT INTO user_settings (user_id) VALUES (%s)
            ''', (user_id,))
            return user_id
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
    
    @staticmethod
    async def authenticate_user(email: str, password: str):
        user = await db.execute_query_one(
            "SELECT * FROM users WHERE email = %s", 
            (email,)
        )
        
        if not user or not verify_password(password, user['password_hash']):
            return False
        return user
    
    @staticmethod
    def get_user_by_id(user_id: int):
        return db.execute_query_one(
            "SELECT * FROM users WHERE id = %s", 
            (user_id,)
        )
    
    @staticmethod
    def get_user_collections(user_id: int):
        return db.execute_query('''
            SELECT id, name, description, is_public, created_at, updated_at
            FROM collections WHERE user_id = %s
            ORDER BY updated_at DESC
        ''', (user_id,), fetch=True)
    
    @staticmethod
    def save_collection(user_id: int, collection_data: CollectionSave):
        collection_id = db.execute_query_one('''
            INSERT INTO collections (user_id, name, description, collection_data, is_public)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        ''', (user_id, collection_data.name, collection_data.description,
              json.dumps(collection_data.collection_data), collection_data.is_public))
        
        return collection_id['id'] if collection_id else None
    
    @staticmethod
    def get_user_settings(user_id: int):
        return db.execute_query_one(
            "SELECT * FROM user_settings WHERE user_id = %s", 
            (user_id,)
        )
    
    @staticmethod
    def update_user_settings(user_id: int, settings: UserSettings):
        db.execute_query('''
            UPDATE user_settings SET
                price_source = %s, currency = %s, reference_price = %s,
                profile_public = %s, notifications_enabled = %s,
                updated_at = NOW()
            WHERE user_id = %s
        ''', (settings.price_source, settings.currency, settings.reference_price,
              settings.profile_public, settings.notifications_enabled, user_id))
    
    @staticmethod
    def save_deck(user_id: int, name: str, commander_name: str, deck_data: dict, deck_analysis: dict = None, is_public: bool = False, bracket: int = 1):
        """Save a generated deck to the database, including bracket."""
        deck_id = db.execute_query_one('''
            INSERT INTO saved_decks (user_id, name, commander_name, deck_data, deck_analysis, is_public, bracket)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''', (user_id, name, commander_name, json.dumps(deck_data), 
              json.dumps(deck_analysis) if deck_analysis else None, is_public, bracket))
        return deck_id['id'] if deck_id else None
    
    @staticmethod
    def get_user_decks(user_id: int):
        """Get all saved decks for a user, including bracket."""
        return db.execute_query('''
            SELECT id, name, commander_name, is_public, bracket, created_at, updated_at
            FROM saved_decks WHERE user_id = %s
            ORDER BY updated_at DESC
        ''', (user_id,), fetch=True)
    
    @staticmethod
    def get_deck_by_id(deck_id: int, user_id: int = None):
        """Get a specific deck by ID, including bracket."""
        if user_id:
            # User can see their own decks or public decks
            return db.execute_query_one('''
                SELECT * FROM saved_decks 
                WHERE id = %s AND (user_id = %s OR is_public = true)
            ''', (deck_id, user_id))
        else:
            # Only public decks for anonymous users
            return db.execute_query_one('''
                SELECT * FROM saved_decks 
                WHERE id = %s AND is_public = true
            ''', (deck_id,))

# Cache management for pricing data
class PriceCache:
    @staticmethod
    def get_price(card_name: str, set_code: str, source: str = "tcgplayer"):
        """Get cached price data"""
        return db.execute_query_one('''
            SELECT * FROM price_cache 
            WHERE card_name = %s AND set_code = %s AND source = %s
            AND last_updated > NOW() - INTERVAL '1 day'
        ''', (card_name, set_code, source))
    
    @staticmethod
    def cache_price(card_name: str, set_code: str, source: str, market_price: float, 
                   low_price: float = None, high_price: float = None, currency: str = "USD"):
        """Cache price data"""
        db.execute_query('''
            INSERT INTO price_cache (card_name, set_code, source, market_price, low_price, high_price, currency)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (card_name, set_code, source) 
            DO UPDATE SET 
                market_price = EXCLUDED.market_price,
                low_price = EXCLUDED.low_price,
                high_price = EXCLUDED.high_price,
                currency = EXCLUDED.currency,
                last_updated = NOW()
        ''', (card_name, set_code, source, market_price, low_price, high_price, currency))
