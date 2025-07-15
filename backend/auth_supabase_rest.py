# User Authentication and Data Management API - Supabase REST API Version

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import os
from typing import Optional, List
from pydantic import BaseModel, EmailStr
import secrets
import json
import httpx
import asyncio
import uuid

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required")

# Database Models (Pydantic) 
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: str  # UUID string (auth.users.id)
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class CollectionSave(BaseModel):
    name: str = "My Collection"
    description: Optional[str] = None
    collection_data: List[dict]  # List of collection cards
    is_public: bool = False

# Simple REST API client for Supabase
class SupabaseRestClient:
    async def get_auth_user_by_username(self, username: str) -> Optional[dict]:
        """Get user from auth.users by display_name (username) using admin API"""
        async with httpx.AsyncClient() as client:
            try:
                # Query auth.users by display_name
                response = await client.get(
                    f"{self.base_url}/auth/v1/admin/users",
                    headers=self.service_headers,
                    params={"display_name": username},
                    timeout=10.0
                )
                if response.status_code == 200:
                    users = response.json().get("users", [])
                    if users:
                        return users[0]
                    else:
                        return None
                else:
                    error_msg = f"Auth user lookup by username failed: {response.status_code} - {response.text}"
                    print(error_msg)
                    return None
            except Exception as e:
                print(f"Error getting auth user by username: {e}")
                return None
    def __init__(self):
        self.base_url = SUPABASE_URL
        self.anon_headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json"
        }
        self.service_headers = {
            "apikey": SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY}",
            "Content-Type": "application/json"
        }

    async def create_user_in_auth(self, email: str, password: str, username: str) -> Optional[dict]:
        """Create user directly in auth.users table using admin API, with display_name as username"""
        async with httpx.AsyncClient() as client:
            try:
                user_data = {
                    "email": email,
                    "password": password,
                    "email_confirm": True,  # Bypass email confirmation
                    "display_name": username
                }
                response = await client.post(
                    f"{self.base_url}/auth/v1/admin/users",
                    headers=self.service_headers,
                    json=user_data,
                    timeout=10.0
                )
                if response.status_code in [200, 201]:
                    return response.json()
                else:
                    error_msg = f"Auth user creation failed: {response.status_code} - {response.text}"
                    print(error_msg)
                    raise Exception(error_msg)
            except Exception as e:
                print(f"Error creating auth user: {e}")
                raise

    async def get_auth_user_by_email(self, email: str) -> Optional[dict]:
        """Get user from auth.users by email using admin API"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/auth/v1/admin/users",
                    headers=self.service_headers,
                    params={"email": email},
                    timeout=10.0
                )
                if response.status_code == 200:
                    users = response.json().get("users", [])
                    if users:
                        return users[0]
                    else:
                        return None
                else:
                    error_msg = f"Auth user lookup failed: {response.status_code} - {response.text}"
                    print(error_msg)
                    raise Exception(error_msg)
            except Exception as e:
                print(f"Error getting auth user: {e}")
                raise

    async def verify_password_with_signin(self, email: str, password: str) -> Optional[dict]:
        """Verify password using sign in endpoint"""
        async with httpx.AsyncClient() as client:
            try:
                sign_in_data = {
                    "email": email,
                    "password": password
                }
                response = await client.post(
                    f"{self.base_url}/auth/v1/token?grant_type=password",
                    headers=self.anon_headers,
                    json=sign_in_data,
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    error_msg = f"Password verification failed: {response.status_code} - {response.text}"
                    print(error_msg)
                    raise Exception(error_msg)
            except Exception as e:
                print(f"Error verifying password: {e}")
                raise

    async def create_profile(self, user_id: str, full_name: str = None) -> Optional[dict]:
        """Create user profile in profiles table"""
        async with httpx.AsyncClient() as client:
            try:
                profile_data = {
                    "user_id": user_id,
                    "full_name": full_name,
                    "updated_at": datetime.utcnow().isoformat()
                }
                # Add Prefer header to get inserted row back
                headers = self.service_headers.copy()
                headers["Prefer"] = "return=representation"
                response = await client.post(
                    f"{self.base_url}/rest/v1/profiles",
                    headers=headers,
                    json=profile_data,
                    timeout=10.0
                )
                if response.status_code in [200, 201]:
                    result = response.json()
                    return result[0] if isinstance(result, list) else result
                else:
                    # Print full response for debugging
                    print("Profile creation failed:")
                    print(f"Status: {response.status_code}")
                    print(f"Headers: {response.headers}")
                    print(f"Response text: {response.text}")
                    try:
                        print(f"Response JSON: {response.json()}")
                    except Exception:
                        pass
                    error_msg = f"Profile creation failed: {response.status_code} - {response.text}"
                    raise Exception(error_msg)
            except Exception as e:
                print(f"Error creating profile: {e}")
                raise

    async def get_profile_by_user_id(self, user_id: str) -> Optional[dict]:
        """Get profile by user_id"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/rest/v1/profiles?user_id=eq.{user_id}",
                    headers=self.service_headers,
                    timeout=10.0
                )
                if response.status_code == 200:
                    profiles = response.json()
                    if profiles:
                        return profiles[0]
                    else:
                        return None
                else:
                    error_msg = f"Profile lookup failed: {response.status_code} - {response.text}"
                    print(error_msg)
                    raise Exception(error_msg)
            except Exception as e:
                print(f"Error getting profile: {e}")
                raise

# Initialize the client
supabase_client = SupabaseRestClient()

class UserManager:
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        """Create a JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    @staticmethod
    async def create_user(email: str, password: str, username: str, full_name: str = None) -> Optional[dict]:
        """Create a new user with auth.users (with display_name=username) + profile"""
        try:
            print(f"🔐 Creating user: {email} (username: {username})")
            # Step 1: Create user in auth.users with display_name
            auth_user = await supabase_client.create_user_in_auth(email, password, username)
            if not auth_user:
                print("❌ Failed to create auth user")
                return None
            user_id = auth_user["id"]
            print(f"✅ Auth user created with ID: {user_id}")
            # Step 2: Create profile
            profile = await supabase_client.create_profile(user_id, full_name)
            if not profile:
                print("⚠️ Auth user created but profile creation failed")
                # Still return success since auth user exists
            else:
                print("✅ Profile created")
            return {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "created_at": auth_user.get("created_at")
            }
        except Exception as e:
            print(f"❌ Error creating user: {e}")
            return None

    @staticmethod
    async def authenticate_user(email_or_username: str, password: str) -> Optional[dict]:
        """Authenticate user using Supabase REST API by email or username"""
        try:
            print(f"🔐 Authenticating user: {email_or_username}")
            # Try email first
            user_email = None
            if "@" in email_or_username:
                user_email = email_or_username
            else:
                # Try to look up by username in profiles
                user_obj = await supabase_client.get_auth_user_by_username(email_or_username)
                if user_obj and user_obj.get("email"):
                    user_email = user_obj["email"]
                else:
                    print("❌ Username not found")
                    return None
            # Try to sign in to verify password
            auth_result = await supabase_client.verify_password_with_signin(user_email, password)
            if not auth_result:
                print("❌ Authentication failed")
                return None
            user = auth_result.get("user")
            if not user:
                print("❌ No user in auth result")
                return None
            user_id = user["id"]
            print(f"✅ Authentication successful for user: {user_id}")
            profile = await supabase_client.get_profile_by_user_id(user_id)
            return {
                "id": user_id,
                "email": user["email"],
                "full_name": profile.get("full_name") if profile else None,
                "created_at": user.get("created_at"),
                "auth_result": auth_result
            }
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return None

    @staticmethod
    async def get_user_by_email(email: str) -> Optional[dict]:
        """Get user by email using admin API"""
        try:
            auth_user = await supabase_client.get_auth_user_by_email(email)
            if not auth_user:
                return None
            
            user_id = auth_user["id"]
            profile = await supabase_client.get_profile_by_user_id(user_id)
            
            return {
                "id": user_id,
                "email": auth_user["email"],
                "full_name": profile.get("full_name") if profile else None,
                "created_at": auth_user.get("created_at")
            }
        except Exception as e:
            print(f"Error getting user by email: {e}")
            return None

# Token verification function
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get the current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")  # sub contains the email
        user_id: str = payload.get("user_id")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await UserManager.get_user_by_email(email)
    if user is None:
        raise credentials_exception
    return user

# Alias for backward compatibility
get_user_from_token = get_current_user

# Helper functions for backward compatibility
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create access token - wrapper for UserManager method"""
    return UserManager.create_access_token(data, expires_delta)

# Simple UserSettings model for compatibility
class UserSettings(BaseModel):
    display_name: Optional[str] = None
    pricing_preference: Optional[str] = "market"
    deck_format: Optional[str] = "commander"

# Collection management functions (placeholder implementations)
def get_user_collections(user_id: str) -> List[dict]:
    """Get all collections for a user (placeholder implementation)"""
    print(f"📦 Getting collections for user: {user_id}")
    return []

def save_collection(user_id: str, collection_data: CollectionSave) -> str:
    """Save a collection for a user (placeholder implementation)"""
    collection_id = str(uuid.uuid4())
    print(f"💾 Saving collection '{collection_data.name}' for user: {user_id}")
    print(f"📦 Generated collection ID: {collection_id}")
    return collection_id

def get_user_settings(user_id: str) -> dict:
    """Get user settings (placeholder implementation)"""
    print(f"⚙️ Getting settings for user: {user_id}")
    return {
        "display_name": "User",
        "pricing_preference": "market",
        "deck_format": "commander"
    }

def update_user_settings(user_id: str, settings: UserSettings) -> bool:
    """Update user settings (placeholder implementation)"""
    print(f"🔧 Updating settings for user: {user_id}")
    print(f"   Settings: {settings.dict()}")
    return True

# Add methods to UserManager
UserManager.get_user_collections = staticmethod(get_user_collections)
UserManager.save_collection = staticmethod(save_collection)
UserManager.get_user_settings = staticmethod(get_user_settings)
UserManager.update_user_settings = staticmethod(update_user_settings)
