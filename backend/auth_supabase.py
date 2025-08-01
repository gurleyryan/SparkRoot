import secrets
import json
import jwt
import os
from fastapi import Depends, HTTPException, status, Request, APIRouter
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from typing import Optional, List
from pydantic import BaseModel, EmailStr
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
    collection_data: List[Dict[str, Any]]
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


router = APIRouter()


# Robust, authenticated deck delete endpoint
@router.delete("/api/decks/{deck_id}")
async def delete_deck(deck_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    # Only allow deleting user's own deck
    deck = await UserManager.get_deck_by_id(deck_id, user_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or not owned by user")
    result = await db.execute_query_one("DELETE FROM saved_decks WHERE id = %s AND user_id = %s RETURNING id", (deck_id, user_id))
    if not result:
        raise HTTPException(status_code=404, detail="Deck not found or already deleted")
    return {"success": True, "deleted_id": deck_id}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# JWT token handling
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode: Dict[str, Any] = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt: str = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)  # type: ignore
    return encoded_jwt

async def get_user_from_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload: Dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
    user = await UserManager.get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user

class UserManager:
    @staticmethod
    async def create_user(user_data: UserCreate) -> Optional[int]:
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
    async def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
        user = await db.execute_query_one(
            "SELECT * FROM users WHERE email = %s", 
            (email,)
        )
        
        if not user or not verify_password(password, user['password_hash']):
            return None
        return user
    
    @staticmethod
    async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
        return await db.execute_query_one(
            "SELECT * FROM users WHERE id = %s", 
            (user_id,)
        )
    
    @staticmethod
    async def get_user_collections(user_id: int) -> List[Dict[str, Any]]:
        return await db.execute_query('''
            SELECT id, name, description, is_public, created_at, updated_at
            FROM collections WHERE user_id = %s
            ORDER BY updated_at DESC
        ''', (user_id,), fetch=True)
    
    @staticmethod
    async def save_collection(user_id: int, collection_data: CollectionSave) -> Optional[int]:
        collection_id = await db.execute_query_one('''
            INSERT INTO collections (user_id, name, description, collection_data, is_public)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        ''', (user_id, collection_data.name, collection_data.description,
              json.dumps(collection_data.collection_data), collection_data.is_public))
        
        return collection_id['id'] if collection_id else None
    
    @staticmethod
    async def get_user_settings(user_id: int) -> Optional[Dict[str, Any]]:
        return await db.execute_query_one(
            "SELECT * FROM user_settings WHERE user_id = %s", 
            (user_id,)
        )
    
    @staticmethod
    async def update_user_settings(user_id: int, settings: UserSettings) -> None:
        await db.execute_query('''
            UPDATE user_settings SET
                price_source = %s, currency = %s, reference_price = %s,
                profile_public = %s, notifications_enabled = %s,
                updated_at = NOW()
            WHERE user_id = %s
        ''', (settings.price_source, settings.currency, settings.reference_price,
              settings.profile_public, settings.notifications_enabled, user_id))
    
    @staticmethod
    async def save_deck(
        user_id: int,
        name: str,
        commander_name: str,
        deck_data: Dict[str, Any],
        deck_analysis: Optional[Dict[str, Any]] = None,
        is_public: bool = False,
        bracket: int = 1
    ) -> Optional[int]:
        """Save a generated deck to the database, including bracket."""
        deck_id = await db.execute_query_one('''
            INSERT INTO saved_decks (user_id, name, commander_name, deck_data, deck_analysis, is_public, bracket)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        ''', (user_id, name, commander_name, json.dumps(deck_data), 
              json.dumps(deck_analysis) if deck_analysis else None, is_public, bracket))
        return deck_id['id'] if deck_id else None
    
    @staticmethod
    async def get_user_decks(user_id: int) -> List[Dict[str, Any]]:
        """Get all saved decks for a user, including bracket."""
        return await db.execute_query('''
            SELECT id, name, commander_name, is_public, bracket, created_at, updated_at
            FROM saved_decks WHERE user_id = %s
            ORDER BY updated_at DESC
        ''', (user_id,), fetch=True)
    
    @staticmethod
    async def get_deck_by_id(deck_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get a specific deck by ID, including bracket."""
        if user_id is not None:
            # User can see their own decks or public decks
            return await db.execute_query_one('''
                SELECT * FROM saved_decks 
                WHERE id = %s AND (user_id = %s OR is_public = true)
            ''', (deck_id, user_id))
        else:
            # Only public decks for anonymous users
            return await db.execute_query_one('''
                SELECT * FROM saved_decks 
                WHERE id = %s AND is_public = true
            ''', (deck_id,))

# Cache management for pricing data

class PriceCache:
    @staticmethod
    async def get_price(card_name: str, set_code: str, source: str = "tcgplayer") -> Optional[Dict[str, Any]]:
        """Get cached price data"""
        return await db.execute_query_one('''
            SELECT * FROM price_cache 
            WHERE card_name = %s AND set_code = %s AND source = %s
            AND last_updated > NOW() - INTERVAL '1 day'
        ''', (card_name, set_code, source))
    
    @staticmethod
    async def cache_price(
        card_name: str,
        set_code: str,
        source: str,
        market_price: float,
        low_price: Optional[float] = None,
        high_price: Optional[float] = None,
        currency: str = "USD"
    ) -> None:
        """Cache price data"""
        await db.execute_query('''
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


# --- FastAPI Endpoints ---

@router.post("/api/auth/register")
async def register(user: UserCreate) -> dict[str, int | bool]:
    user_id = await UserManager.create_user(user)
    if user_id is None:
        raise HTTPException(status_code=500, detail="User registration failed")
    return {"success": True, "user_id": user_id}

@router.post("/api/auth/login")
async def login(user: UserLogin):
    db_user = await UserManager.authenticate_user(user.email, user.password)
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token({"sub": db_user["id"]}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/api/auth/me")
async def get_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    user = await db.execute_query_one("SELECT * FROM users WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Extract role from JWT app_metadata
    app_metadata = payload.get("app_metadata", {})
    role = app_metadata.get("role", "user")
    user["app_metadata"] = {"role": role}
    return user

@router.get("/api/collections")
async def get_collections(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    collections = await UserManager.get_user_collections(user_id)
    return collections

@router.post("/api/collections")
async def save_collection(
    collection: CollectionSave,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict[str, int | bool]:
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    collection_id = await UserManager.save_collection(user_id, collection)
    if collection_id is None:
        raise HTTPException(status_code=500, detail="Failed to save collection")
    return {"success": True, "collection_id": collection_id}

@router.get("/api/decks")
async def get_decks(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    decks = await UserManager.get_user_decks(user_id)
    return decks

@router.post("/api/decks")
async def save_deck(
    request: Request, 
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict[str, int | bool]:
    data = await request.json()
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    name = data.get("name")
    commander_name = data.get("commander_name")
    deck_data = data.get("deck_data")
    deck_analysis = data.get("deck_analysis")
    is_public = data.get("is_public", False)
    bracket = data.get("bracket", 1)
    deck_id = await UserManager.save_deck(user_id, name, commander_name, deck_data, deck_analysis, is_public, bracket)
    if deck_id is None:
        raise HTTPException(status_code=500, detail="Failed to save deck")
    return {"success": True, "deck_id": deck_id}

@router.get("/api/decks/{deck_id}")
async def get_deck(deck_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    deck = await UserManager.get_deck_by_id(deck_id, user_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck

@router.get("/api/settings")
async def get_settings(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    settings = await UserManager.get_user_settings(user_id)
    return settings

@router.post("/api/settings")
async def update_settings(settings: UserSettings, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload: dict[str, Any] = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])  # type: ignore
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing user ID in token")
    await UserManager.update_user_settings(user_id, settings)
    return {"success": True}
