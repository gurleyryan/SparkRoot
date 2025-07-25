# User Authentication and Data Management API - Supabase REST API Version

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone
import os
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr
import secrets
import httpx
import typing

# Security configuration
SECRET_KEY: str = str(os.getenv("SECRET_KEY", secrets.token_urlsafe(32)))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or ""

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required")

# Database Models (Pydantic) 
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None
    role: Optional[str] = None
    app_metadata: Optional[Dict[str, Any]] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class CollectionSave(BaseModel):
    name: str = "My Collection"
    description: Optional[str] = None
    collection_data: List[Dict[str, Any]]  # List of collection cards
    is_public: bool = False

# Simple REST API client for Supabase
class SupabaseRestClient:
    async def get_auth_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user from auth.users by looking up username in profiles table"""
        async with httpx.AsyncClient() as client:
            try:
                # Look up user_id in profiles by username
                response = await client.get(
                    f"{self.base_url}/rest/v1/profiles?username=eq.{username}",
                    headers=self.service_headers,
                    timeout=10.0
                )
                if response.status_code == 200:
                    profiles = response.json()
                    if profiles:
                        user_id = profiles[0]["user_id"]
                        # Now get auth user by user_id
                        user_resp = await client.get(
                            f"{self.base_url}/auth/v1/admin/users/{user_id}",
                            headers=self.service_headers,
                            timeout=10.0
                        )
                        if user_resp.status_code == 200:
                            return user_resp.json()
                        else:
                            return None
                    else:
                        return None
                else:
                    return None
            except Exception as e:
                print(f"Error getting auth user by username: {e}")
                return None
    def __init__(self, jwt_token: Optional[str] = None):
        self.base_url = SUPABASE_URL
        self.jwt_token = jwt_token or ""
        self.anon_headers: Dict[str, str] = {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
        if self.jwt_token:
            self.anon_headers["Authorization"] = f"Bearer {self.jwt_token}"
        # Use service key for admin endpoints
        self.service_key = os.getenv("SUPABASE_SERVICE_KEY", "")
        self.service_headers: Dict[str, str] = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json"
        }

    async def create_user_in_auth(self, email: str, password: str, username: str, full_name: str = "") -> Optional[Dict[str, Any]]:
        """Create user using the public signup endpoint (anon key), then create profile."""
        async with httpx.AsyncClient() as client:
            try:
                signup_data: Dict[str, Any] = {
                    "email": email,
                    "password": password,
                    "data": {
                        "username": username,
                        "full_name": full_name
                    }
                }
                response = await client.post(
                    f"{self.base_url}/auth/v1/signup",
                    headers=self.anon_headers,
                    json=signup_data,
                    timeout=10.0
                )
                if response.status_code in [200, 201]:
                    user = response.json()
                    # Optionally, create profile in profiles table
                    user_id = user.get("user", {}).get("id") or user.get("id")
                    if user_id:
                        await self.create_profile(user_id, full_name, username)
                    return user
                else:
                    error_msg = f"User signup failed: {response.status_code} - {response.text}"
                    print(error_msg)
                    raise Exception(error_msg)
            except Exception as e:
                print(f"Error creating user: {e}")
                raise

    async def get_auth_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
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

    async def verify_password_with_signin(self, email: str, password: str) -> Optional[Dict[str, Any]]:
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
                return response.json() if response.status_code == 200 else None
            except Exception as e:
                print(f"Error verifying password: {e}")
                raise

    async def create_profile(self, user_id: str, full_name: str = "", username: str = "") -> Optional[Dict[str, Any]]:
        """Create user profile in profiles table, including username"""
        async with httpx.AsyncClient() as client:
            try:
                profile_data: Dict[str, Any] = {
                    "user_id": user_id,
                    "full_name": full_name,
                    "username": username,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                headers = self.service_headers.copy()
                headers["Prefer"] = "return=representation"
                response = await client.post(
                    f"{self.base_url}/rest/v1/profiles",
                    headers=headers,
                    json=profile_data,
                    timeout=10.0
                )
                if response.status_code in [200, 201]:
                    result: Dict[str, Any] = response.json() if isinstance(response.json(), dict) else {}
                    if isinstance(result, list) and result:
                        return result[0]  # type: ignore
                    else:
                        return result  # type: Dict[str, Any]
                else:
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

    async def get_profile_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
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
    async def create_user(email: str, password: str, username: str, full_name: str = "") -> Optional[Dict[str, Any]]:
        """Stub for create_user to satisfy type checkers. Actual implementation should be provided elsewhere."""
        # You should implement this method or attach it dynamically as in your current codebase.
        return None
    @staticmethod
    async def get_user_collections(user_id: str, jwt_token: typing.Union[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Get all collections for a user (with API key header)"""
        # If jwt_token is a dict, extract the actual access token
        if isinstance(jwt_token, dict):
            jwt_token = jwt_token.get("access_token") or ""
        async def fetch() -> List[Dict[str, Any]]:
            async with httpx.AsyncClient() as client:
                headers = {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {jwt_token}",
                    "Content-Type": "application/json",
                }
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/collections?user_id=eq.{user_id}",
                    headers=headers
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list):
                        return data  # type: ignore
                    elif isinstance(data, dict):
                        return [data]  # type: ignore
                    else:
                        return []
                else:
                    print(f"Error fetching collections: {resp.text}")
                    return []
        return await fetch()

    @staticmethod
    async def save_collection(user_id: str, jwt_token: str, collection_data: 'CollectionSave') -> Optional[str]:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/collections",
                headers=headers,
                json=collection_data
            )
            if resp.status_code == 201:
                return resp.headers.get("Location")
            else:
                print(f"Error saving collection: {resp.text}")
                return None

    @staticmethod
    async def get_user_settings(user_id: str, jwt_token: typing.Union[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        # If jwt_token is a dict, extract the actual access token
        if isinstance(jwt_token, dict):
            jwt_token = jwt_token.get("access_token") or ""
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_settings?user_id=eq.{user_id}",
                headers=headers
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return typing.cast(Dict[str, Any], data[0]) if data else None
                elif isinstance(data, dict):
                    return typing.cast(Dict[str, Any], data)
                else:
                    return None
            else:
                print(f"Error fetching user settings: {resp.text}")
                return None

    @staticmethod
    async def update_user_settings(user_id: str, jwt_token: str, settings: 'UserSettings') -> bool:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
            }
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/user_settings?user_id=eq.{user_id}",
                headers=headers,
                json=settings
            )
            if resp.status_code == 204:
                return True
            else:
                print(f"Error updating user settings: {resp.text}")
                return False

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token"""
        to_encode: Dict[str, Any] = data.copy()
        if expires_delta:
            expire: datetime = datetime.now(timezone.utc) + expires_delta
        else:
            expire: datetime = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        # Ensure 'sub' is always set to user email for token validation
        sub_value = data.get("sub") or data.get("email")
        to_encode.update({"exp": int(expire.timestamp()), "sub": sub_value})
        encoded_jwt: str = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)  # type: ignore
        return encoded_jwt

    @staticmethod
    async def authenticate_user(email_or_username: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate user using Supabase REST API by email or username"""
        try:
            print(f"🔐 Authenticating user: {email_or_username}")
            user_email: Optional[str] = None
            if "@" in email_or_username:
                user_email = email_or_username
            else:
                user_obj: Optional[Dict[str, Any]] = await supabase_client.get_auth_user_by_username(email_or_username)
                if user_obj and user_obj.get("email"):
                    user_email = user_obj["email"]
                else:
                    print("❌ Username not found")
                    return None
            if user_email is None:
                print("❌ Email not found for authentication")
                return None
            auth_result: Optional[Dict[str, Any]] = await supabase_client.verify_password_with_signin(user_email, password)
            if not auth_result:
                print("❌ Authentication failed")
                return None
            user: Optional[Dict[str, Any]] = auth_result.get("user") if auth_result else None
            if not user:
                print("❌ No user in auth result")
                return None
            user_id: str = user["id"]
            print(f"✅ Authentication successful for user: {user_id}")
            profile: Optional[Dict[str, Any]] = await supabase_client.get_profile_by_user_id(user_id)
            return {
                "id": user_id,
                "email": user["email"],
                "username": profile.get("username") if profile else None,
                "full_name": profile.get("full_name") if profile else None,
                "created_at": user.get("created_at"),
                "auth_result": auth_result
            }
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return None

    @staticmethod
    async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        """Get user by email using admin API"""
        try:
            auth_user: Optional[Dict[str, Any]] = await supabase_client.get_auth_user_by_email(email)
            if not auth_user:
                return None
            user_id: str = auth_user["id"]
            profile: Optional[Dict[str, Any]] = await supabase_client.get_profile_by_user_id(user_id)
            return {
                "id": user_id,
                "email": auth_user["email"],
                "username": profile.get("username") if profile else None,
                "full_name": profile.get("full_name") if profile else None,
                "created_at": auth_user.get("created_at")
            }
        except Exception as e:
            print(f"Error getting user by email: {e}")
            return None

# Token verification function

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, options={"verify_signature": False}) # type: ignore
        print("JWT PAYLOAD:", payload)
        email = payload.get("email")
        user_id = payload.get("sub")
        # Fetch profile info from public.profiles
        async with httpx.AsyncClient() as client:
            profile_resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{user_id}",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            profile = None
            if profile_resp.status_code == 200:
                profiles = profile_resp.json()
                if profiles:
                    profile = profiles[0]
        # --- PATCH: Always extract app_metadata and role from JWT ---
        app_metadata: Dict[str, Any] = payload.get("app_metadata") or {}
        role = app_metadata.get("role") or payload.get("role") or ""
        return {
            "id": user_id,
            "email": email,
            "username": profile.get("username") if profile else "",
            "full_name": profile.get("full_name") if profile else "",
            "avatar_url": profile.get("avatar_url") if profile else None,
            "created_at": profile.get("created_at") if profile else None,
            "access_token": token,
            "role": role,
            "app_metadata": app_metadata,
            "user_metadata": payload.get("user_metadata"),
        }
    except Exception as e:
        print(f"Error in get_current_user: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Alias for backward compatibility
get_user_from_token = get_current_user

# Helper functions for backward compatibility
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None):
    """Create access token - wrapper for UserManager method"""
    return UserManager.create_access_token(data, expires_delta)

# Simple UserSettings model for compatibility
class UserSettings(BaseModel):
    price_source: Optional[str] = "tcgplayer"
    currency: Optional[str] = "USD"
    reference_price: Optional[str] = "market"
    profile_public: Optional[bool] = False
    notifications_enabled: Optional[bool] = True
    playmat_texture: Optional[str] = None
    theme: Optional[str] = "dark"
    default_format: Optional[str] = "commander"
    card_display: Optional[str] = "grid"
    auto_save: Optional[bool] = True
    notifications: Optional[Dict[str, Any]] = None

# Collection management functions (placeholder implementations)
async def get_user_collections(user_id: str, jwt_token: str) -> List[Dict[str, Any]]:
    """Get all collections for a user (placeholder implementation)"""
    headers: Dict[str, str] = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    async def fetch() -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/collections?user_id=eq.{user_id}",
                headers=headers
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data  # type: ignore
                elif isinstance(data, dict):
                    return [data]  # type: ignore
                else:
                    return []
            else:
                print(f"Error fetching collections: {resp.text}")
                return []
    return await fetch()

async def save_collection(user_id: str, collection_data: CollectionSave, jwt_token: str) -> Optional[str]:
    """Save a collection for a user (placeholder implementation)"""
    headers: Dict[str, str] = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    payload: Dict[str, Any] = {
        "user_id": str(user_id),
        "name": str(collection_data.name),
        "description": str(collection_data.description) if collection_data.description is not None else "",
        "collection_data": list(collection_data.collection_data),
        "is_public": bool(collection_data.is_public)
    }
    async def post() -> Optional[str]:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{SUPABASE_URL}/rest/v1/collections",
                headers=headers,
                json=payload
            )
            if resp.status_code in [200, 201]:
                result = resp.json()
                if isinstance(result, list) and result and "id" in result[0]:
                    return str(result[0].get("id"))  # type: ignore
                elif isinstance(result, dict) and "id" in result:
                    return str(result.get("id", ""))  # type: ignore
                else:
                    return None
            else:
                print(f"Error saving collection: {resp.text}")
                return None
    return await post()

async def get_collection_by_id(user_id: str, collection_id: str, jwt_token: str) -> Optional[Dict[str, Any]]:
    headers: Dict[str, str] = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    async def fetch() -> Optional[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/collections?id=eq.{collection_id}&user_id=eq.{user_id}",
                headers=headers
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and data:
                    return data[0]  # type: ignore
                elif isinstance(data, dict):
                    return typing.cast(Dict[str, Any], data)  # Explicit cast for type checker
                else:
                    return None
            else:
                print(f"Error fetching collection: {resp.text}")
                return None
    return await fetch()

async def update_collection(user_id: str, collection_id: str, data: Dict[str, Any], jwt_token: str) -> bool:
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    async def patch():
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/collections?id=eq.{collection_id}&user_id=eq.{user_id}",
                headers=headers,
                json=data
            )
            return resp.status_code in [200, 204]
    return await patch()

async def delete_collection(user_id: str, collection_id: str, jwt_token: str) -> bool:
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    async def delete():
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{SUPABASE_URL}/rest/v1/collections?id=eq.{collection_id}&user_id=eq.{user_id}",
                headers=headers
            )
            return resp.status_code in [200, 204]
    return await delete()

async def get_user_settings(user_id: str, jwt_token: str) -> Optional[Dict[str, Any]]:
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/user_settings?id=eq.{user_id}",
            headers=headers
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                return typing.cast(Dict[str, Any], data[0]) if data else None
            elif isinstance(data, dict):
                return typing.cast(Dict[str, Any], data)
            else:
                return None
        else:
            print(f"Error fetching user settings: {resp.text}")
            return None

async def update_user_settings(user_id: str, settings: UserSettings, jwt_token: str) -> bool:
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    async def patch():
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{SUPABASE_URL}/rest/v1/user_settings?id=eq.{user_id}",
                headers=headers,
                json=settings.model_dump(exclude_unset=True)
            )
            return resp.status_code in [200, 204]
    return await patch()
