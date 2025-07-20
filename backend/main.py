from fastapi.responses import FileResponse, PlainTextResponse
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import io
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import timedelta
from dotenv import load_dotenv
import os
import structlog
import sentry_sdk
class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str
class UpdateEmailRequest(BaseModel):
    new_email: str
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

load_dotenv()
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    traces_sample_rate=1.0,
    environment=os.getenv("SENTRY_ENV", "production")
)

logger = structlog.get_logger()

# Load environment variables from .env file
load_dotenv()

# Import your existing modules
from backend.utils import enrich_collection_with_scryfall, load_scryfall_cards
from backend.deckgen import find_valid_commanders
from backend.deck_analysis import analyze_deck_quality
from backend.deck_export import export_deck_to_txt, export_deck_to_json, export_deck_to_moxfield, get_deck_statistics

# Import authentication modules (Supabase REST API version)
from backend.auth_supabase_rest import (
    UserResponse, CollectionSave, UserSettings,
    UserManager, get_user_from_token, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES,
    get_collection_by_id, update_collection, delete_collection, security
)
from backend.pricing import enrich_collection_with_prices, calculate_collection_value



# Database connection (using Supabase REST API via auth_supabase.py)
# from supabase_db import db  # Commented out - using REST API instead

def convert_numpy_types(collection):
    """Convert numpy types to native Python types for JSON serialization"""
    for card in collection:
        for key, value in card.items():
            try:
                if hasattr(value, 'item'):  # numpy scalar
                    card[key] = value.item()
                elif value is None:
                    card[key] = None
                elif pd.isna(value):  # Handle NaN values (safer check)
                    card[key] = None
            except (ValueError, TypeError):
                # Handle arrays or other problematic types
                if isinstance(value, (list, tuple)):
                    card[key] = list(value)
                else:
                    card[key] = str(value)
    return collection

app = FastAPI(title="SparkRoot API", version="1.0.0")
@app.get("/sentry-debug")
async def trigger_error():
    division_by_zero = 1 / 0
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda r, e: JSONResponse(status_code=429, content={"error": "Rate limit exceeded"}))
# Password change endpoint
@app.post("/api/auth/update-password")
@limiter.limit("3/minute")
async def update_password(request: UpdatePasswordRequest, credentials: HTTPAuthorizationCredentials = Depends()):
    """Update user password after successful TOTP verification"""
    from backend.auth_supabase_rest import get_current_user
    import httpx, os
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    user = await get_current_user(credentials)
    user_id = user["id"]
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    # Verify current password (implementation depends on Supabase setup)
    # For demo, assume always valid
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/auth/v1/users/{user_id}",
            headers=headers,
            json={"password": request.new_password}
        )
        if resp.status_code == 200:
            logger.info("User changed password", user_id=user_id)
            return {"success": True, "message": "Password updated"}
        else:
            raise HTTPException(status_code=400, detail="Failed to update password")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda r, e: JSONResponse(status_code=429, content={"error": "Rate limit exceeded"}))
from totp_verify import router as totp_router
app.include_router(totp_router)

# Deck export endpoints (moved after app definition)
class DeckExportRequest(BaseModel):
    deck_data: dict
    as_file: bool = False

@app.post("/api/export-deck/txt")
async def export_deck_txt(request: DeckExportRequest):
    """Export deck to MTGO/Arena TXT format (file or text)."""
    try:
        deck_text, filepath = export_deck_to_txt(request.deck_data)
        if request.as_file:
            return FileResponse(filepath, filename=filepath.split(os.sep)[-1], media_type="text/plain")
        return PlainTextResponse(deck_text)
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})

@app.post("/api/export-deck/json")
async def export_deck_json(request: DeckExportRequest):
    """Export deck to JSON format (file or text)."""
    try:
        filepath = export_deck_to_json(request.deck_data)
        if request.as_file:
            return FileResponse(filepath, filename=filepath.split(os.sep)[-1], media_type="application/json")
        with open(filepath, "r", encoding="utf-8") as f:
            json_text = f.read()
        return PlainTextResponse(json_text, media_type="application/json")
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})

@app.post("/api/export-deck/moxfield")
async def export_deck_moxfield(request: DeckExportRequest):
    """Export deck to MoxField import format (text only)."""
    try:
        moxfield_text = export_deck_to_moxfield(request.deck_data)
        return PlainTextResponse(moxfield_text)
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": str(e)})

# Database startup/shutdown events commented out - using Supabase REST API instead
# @app.on_event("startup")
# async def startup_event():
#     """Initialize database connection pool on startup"""
#     await db.init_pool()

# @app.on_event("shutdown")
# async def shutdown_event():
#     """Close database connection pool on shutdown"""
#     await db.close_pool()

# Cache Scryfall data to avoid reloading the large file
_scryfall_cache = None

def get_scryfall_data():
    global _scryfall_cache
    if _scryfall_cache is None:
        _scryfall_cache = load_scryfall_cards()
    return _scryfall_cache

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://mtg-deck-optimizer.vercel.app",
        "https://mtg-deck-optimizer-gurleyco.vercel.app/",
        "https://mtg-deck-optimizer-git-main-gurleyco.vercel.app/",
        "https://mtg.up.railway.app",
        "https://www.sparkroot.cards",
        "https://sparkroot.cards",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CollectionCard(BaseModel):
    name: str
    set: str = ""
    quantity: int = 1
    foil: bool = False
    condition: str = "Near Mint"

class DeckAnalysisRequest(BaseModel):
    collection: List[Dict[str, Any]]
    commander_id: str = None
    bracket: int = 1  # 1-5, default to 1

@app.get("/")
async def root():
    return {"message": "SparkRoot API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SparkRoot API"}

from fastapi import Query
# Authentication endpoints
from fastapi import Body

@app.get("/api/auth/check-username")
async def check_username(username: str = Query(...)):
    """Check if username is available (not taken)"""
    import httpx, os
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?username=eq.{username}",
            headers=headers
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"available": len(data) == 0}
        return {"available": False}

@app.get("/api/auth/check-email")
async def check_email(email: str = Query(...)):
    """Check if email is available (not taken)"""
    import httpx, os
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/users?email=eq.{email}",
            headers=headers
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"available": len(data) == 0}
        return {"available": False}

@app.post("/api/auth/register", response_model=UserResponse)
async def register_user(user_data: dict = Body(...)):
    """Register a new user"""
    try:
        logger.info("Registering new user", email=user_data.get('email'), username=user_data.get('username'))
        if not user_data.get("username") or not isinstance(user_data.get("username"), str) or not user_data["username"].strip():
            raise HTTPException(status_code=400, detail="Username is required and must be a non-empty string.")
        user_response = await UserManager.create_user(
            email=user_data["email"],
            password=user_data["password"],
            username=user_data["username"],
            full_name=user_data.get("full_name")
        )
        if user_response:
            return UserResponse(
                id=user_response["id"],
                email=user_response["email"],
                username=user_response.get("username"),
                full_name=user_response.get("full_name"),
                created_at=user_response.get("created_at")
            )
        else:
            raise HTTPException(status_code=500, detail="User creation failed")
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

from fastapi import Body

from fastapi.responses import JSONResponse
from fastapi import Response
from datetime import datetime, timedelta

@app.post("/api/auth/login")
async def login_user(payload: dict = Body(...), response: Response = None):
    """Authenticate user and return access token in JSON response (use Authorization header for future requests)"""
    identifier = payload.get("identifier") or payload.get("email") or payload.get("username")
    password = payload.get("password")
    if not identifier or not password:
        raise HTTPException(status_code=422, detail="Missing identifier or password")
    user = await UserManager.authenticate_user(identifier, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_email = user.get("email") or identifier
    user_id = user.get("id")
    username = user.get("username")
    full_name = user.get("full_name")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user_email,
            "user_id": user_id
        },
        expires_delta=access_token_expires
    )
    return {
        "id": user_id,
        "email": user_email,
        "username": username,
        "full_name": full_name,
        "created_at": user.get("created_at"),
        "access_token": access_token,
        "token_type": "bearer"
    }

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_user_from_token)):
    """Get current user information"""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user.get("username"),
        full_name=current_user.get("full_name"),
        created_at=current_user.get("created_at")
    )

# Collection management endpoints

@app.get("/api/collections")
async def get_user_collections(current_user = Depends(get_user_from_token)):
    """Get all collections for the current user"""
    user_id = current_user["id"]
    collections = UserManager.get_user_collections(user_id)
    return {"success": True, "collections": collections}

@app.get("/api/collections/{collection_id}")
async def get_collection(collection_id: str, current_user = Depends(get_user_from_token)):
    """Get a specific collection for the current user"""
    user_id = current_user["id"]
    collection = get_collection_by_id(user_id, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found or not owned by user")
    return {"success": True, "collection": collection}

# --- Export collection as CSV or JSON ---
from fastapi.responses import StreamingResponse
import csv
import io

@app.get("/api/collections/{collection_id}/export")
async def export_collection(collection_id: str, format: str = "json"):
    """Export a public or owned collection as CSV or JSON."""
    # Try to get collection as public first
    collection = get_collection_by_id(None, collection_id, allow_public=True)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found or not public")
    cards = collection.get("cards", [])
    if format == "csv":
        if not cards:
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["No cards"])
            output.seek(0)
            return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=collection_{collection_id}.csv"})
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=cards[0].keys())
        writer.writeheader()
        for card in cards:
            writer.writerow(card)
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=collection_{collection_id}.csv"})
    else:
        return JSONResponse(content=cards, headers={"Content-Disposition": f"attachment; filename=collection_{collection_id}.json"})

# --- Public collection viewing endpoint ---
@app.get("/api/collections/public/{collection_id}")
async def get_public_collection(collection_id: str):
    """Get a public collection by ID (no auth required)"""
    collection = get_collection_by_id(None, collection_id, allow_public=True)
    if not collection or not collection.get("is_public"):
        raise HTTPException(status_code=404, detail="Collection not found or not public")
    return {"success": True, "collection": collection}

@app.put("/api/collections/{collection_id}")
async def update_collection_endpoint(collection_id: str, data: dict, current_user = Depends(get_user_from_token)):
    """Update a collection for the current user"""
    user_id = current_user["id"]
    collection = get_collection_by_id(user_id, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found or not owned by user")
    success = update_collection(user_id, collection_id, data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update collection")
    return {"success": True, "message": "Collection updated"}

@app.delete("/api/collections/{collection_id}")
async def delete_collection_endpoint(collection_id: str, current_user = Depends(get_user_from_token)):
    """Delete a collection for the current user"""
    user_id = current_user["id"]
    collection = get_collection_by_id(user_id, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found or not owned by user")
    success = delete_collection(user_id, collection_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete collection")
    return {"success": True, "message": "Collection deleted"}


# --- Robust CSV upload, enrichment, and Supabase save for collections ---
import pandas as pd
import io
from fastapi import Request

@app.post("/api/collections")
async def upload_collection(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Accepts raw CSV (text/csv) in body, parses, enriches, and saves collection for authenticated user.
    Returns the full saved collection (including cards).
    """
    # --- Auth ---
    current_user = await get_user_from_token(credentials)
    user_id = current_user["id"]

    # --- Read CSV from body ---
    try:
        csv_bytes = await request.body()
        csv_text = csv_bytes.decode("utf-8")
        df = pd.read_csv(io.StringIO(csv_text))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")

    # --- Normalize and enrich ---
    try:
        from backend.utils import normalize_csv_format, enrich_collection_with_scryfall, load_scryfall_cards
        df = normalize_csv_format(df)
        scryfall_data = load_scryfall_cards()
        enriched = enrich_collection_with_scryfall(df, scryfall_data)
        # Convert to list of dicts for storage
        cards = enriched.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {e}")

    # --- Save to Supabase (collections table) ---
    import httpx
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    payload = {
        "user_id": user_id,
        "name": "My Collection",  # Optionally parse from CSV or request
        "description": None,
        "collection_data": cards,
        "is_public": False
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{SUPABASE_URL}/rest/v1/collections", headers=headers, json=payload)
            if resp.status_code not in (200, 201):
                raise HTTPException(status_code=500, detail=f"Supabase error: {resp.text}")
            data = resp.json()
            if isinstance(data, list) and data:
                collection = data[0]
            elif isinstance(data, dict):
                collection = data
            else:
                raise HTTPException(status_code=500, detail="Supabase returned no collection data")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save collection: {e}")

    # --- Return the saved collection (including cards) ---
    return {"success": True, "collection": collection}

# Settings endpoints
@app.get("/api/settings")
async def get_user_settings(current_user = Depends(get_user_from_token)):
    """Get user settings"""
    user_id = current_user["id"]
    settings = UserManager.get_user_settings(user_id)
    return {"success": True, "settings": settings}

@app.put("/api/settings")
async def update_user_settings(
    settings: UserSettings,
    current_user = Depends(get_user_from_token)
):
    """Update user settings"""
    user_id = current_user["id"]
    UserManager.update_user_settings(user_id, settings)
    logger.info("User updated settings", user_id=user_id, settings=settings)
    return {"success": True, "message": "Settings updated successfully"}

@app.post("/api/auth/update-email")
@limiter.limit("3/minute")
async def update_email(request: UpdateEmailRequest, credentials: HTTPAuthorizationCredentials = Depends()):
    """Update user email after successful TOTP verification"""
    from backend.auth_supabase_rest import get_current_user
    import httpx, os
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    user = await get_current_user(credentials)
    user_id = user["id"]
    logger.info("User requested email change", user_id=user_id, new_email=request.new_email)
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/auth/v1/users/{user_id}",
            headers=headers,
            json={"email": request.new_email}
        )
        if resp.status_code == 200:
            return {"success": True, "message": "Email updated"}
        else:
            raise HTTPException(status_code=400, detail="Failed to update email")
# Pricing endpoints

# Password change endpoint
@app.post("/api/auth/update-password")
@limiter.limit("3/minute")
@limiter.limit("5/minute")
async def update_password(request: UpdatePasswordRequest, credentials: HTTPAuthorizationCredentials = Depends()):
    """Update user password after successful TOTP verification"""
    import httpx, os
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    from backend.auth_supabase_rest import get_current_user
    user = await get_current_user(credentials)
    # Use request.current_password and request.new_password for validation and update
    user_id = user["id"]
    body = await request.json()
    current_password = body.get("current_password")
    new_password = body.get("new_password")
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing current or new password")
    # Optionally: verify current password
    logger.info("User requested password change", user_id=user_id)
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/auth/v1/users/{user_id}",
            headers=headers,
            json={"password": new_password}
        )
        if resp.status_code == 200:
            return {"success": True, "message": "Password updated"}
        else:
            raise HTTPException(status_code=400, detail="Failed to update password")
class PricingRequest(BaseModel):
    collection: List[Dict[str, Any]]
    source: str = "tcgplayer"  # tcgplayer, scryfall


# Pricing enrichment endpoint
@app.post("/api/pricing/enrich-collection")
async def enrich_collection_pricing(
    request: PricingRequest,
    current_user = Depends(get_user_from_token)
):
    try:
        enriched_collection = await enrich_collection_with_prices(
            request.collection, 
            request.source
        )
        value_stats = calculate_collection_value(enriched_collection)
        return {
            "success": True,
            "collection": enriched_collection,
            "value_stats": value_stats
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# Collection value endpoint
@app.post("/api/pricing/collection-value")
async def get_collection_value(
    request: PricingRequest,
    current_user = Depends(get_user_from_token)
):
    try:
        has_pricing = any(card.get('price_data') for card in request.collection)
        if not has_pricing:
            enriched_collection = await enrich_collection_with_prices(
                request.collection, 
                request.source
            )
        else:
            enriched_collection = request.collection
        value_stats = calculate_collection_value(enriched_collection)
        return {
            "success": True,
            "value_stats": value_stats,
            "pricing_source": request.source
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# Public collection value endpoint
@app.post("/api/pricing/collection-value-public")
async def get_collection_value_public(request: PricingRequest):
    try:
        has_pricing = any(card.get('price_data') for card in request.collection)
        if not has_pricing:
            enriched_collection = await enrich_collection_with_prices(
                request.collection, 
                request.source
            )
        else:
            enriched_collection = request.collection
        value_stats = calculate_collection_value(enriched_collection)
        return {
            "success": True,
            "value_stats": value_stats,
            "pricing_source": request.source
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

# Public collection parsing (no authentication required)
@app.post("/api/parse-collection-public")
async def parse_collection_public(file: UploadFile = File(...)):
    """Parse uploaded CSV collection file and enrich with Scryfall data (public)"""
    try:
        import psutil
        # Read the uploaded file
        contents = await file.read()
        # Try to parse as CSV with different encodings
        try:
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(io.StringIO(contents.decode('latin-1')))
            except UnicodeDecodeError:
                df = pd.read_csv(io.StringIO(contents.decode('cp1252')))
        print(f"Uploaded file: {file.filename}")
        print(f"Detected columns: {list(df.columns)}")
        print(f"Number of rows: {len(df)}")
        # Save the uploaded collection to user-data directory with a generic name
        import os
        user_data_dir = "data/user-data"
        os.makedirs(user_data_dir, exist_ok=True)
        # Use a timestamp-based filename to avoid conflicts
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        saved_filename = f"uploaded_collection_{timestamp}.csv"
        saved_path = f"{user_data_dir}/{saved_filename}"
        df.to_csv(saved_path, index=False)
        print(f"Saved collection to: {saved_path}")
        # Load Scryfall data
        process = psutil.Process(os.getpid())
        mem_before = process.memory_info().rss / 1024 / 1024
        print(f"[Enrich] Memory usage before Scryfall enrichment: {mem_before:.2f} MB")
        scryfall_data = get_scryfall_data()
        mem_after_scryfall = process.memory_info().rss / 1024 / 1024
        print(f"[Enrich] Memory usage after Scryfall load: {mem_after_scryfall:.2f} MB (delta: {mem_after_scryfall-mem_before:.2f} MB)")
        # Enrich with Scryfall data using your existing logic
        enriched_df = enrich_collection_with_scryfall(df, scryfall_data)
        mem_after_enrich = process.memory_info().rss / 1024 / 1024
        print(f"[Enrich] Memory usage after enrichment: {mem_after_enrich:.2f} MB (delta: {mem_after_enrich-mem_after_scryfall:.2f} MB)")
        # Convert to list of dictionaries
        collection = enriched_df.to_dict('records')
        # Convert numpy types to native Python types for JSON serialization
        collection = convert_numpy_types(collection)
        # Basic stats (convert numpy types to native Python types)
        stats = {
            "total_cards": int(len(collection)),  # This now includes individual card instances
            "unique_cards": int(len(enriched_df.drop_duplicates(subset=['name']) if 'name' in enriched_df.columns else enriched_df)),
            "total_quantity": int(enriched_df['Quantity'].sum() if 'Quantity' in enriched_df.columns else len(collection)),
            "original_filename": file.filename,
            "saved_as": saved_filename,
            "detected_columns": list(df.columns)
        }
        return {
            "success": True,
            "collection": collection,
            "stats": stats
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": str(e), "details": error_details}
        )

# Optional authentication for collection endpoints
@app.post("/api/parse-collection")
async def parse_collection_authenticated(
    file: UploadFile = File(...),
    current_user = Depends(get_user_from_token)
):
    """Parse uploaded CSV collection file and enrich with Scryfall data (authenticated)"""
    # Use the same logic as the public endpoint but associate with user
    result = await parse_collection_public(file)
    
    # If successful and user wants to save it, we can do that here
    if result.get("success") and current_user:
        # Optionally auto-save the collection for the user
        try:
            collection_data = CollectionSave(
                name=f"Uploaded Collection - {result['stats']['original_filename']}",
                description=f"Automatically saved from upload",
                collection_data=result["collection"],
                is_public=False
            )
            user_id = current_user["id"]
            collection_id = UserManager.save_collection(user_id, collection_data)
            result["auto_saved"] = True
            result["collection_id"] = collection_id
        except Exception as e:
            result["auto_save_error"] = str(e)
    
    return result

@app.post("/api/find-commanders")
async def find_commanders(request: DeckAnalysisRequest):
    """Find valid commanders from collection using your existing logic"""
    try:
        collection = request.collection
        df = pd.DataFrame(collection)
        
        # Use your existing commander detection logic
        commanders = find_valid_commanders(df)
        
        return {
            "success": True,
            "commanders": commanders,
            "count": len(commanders)
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": str(e)}
        )

@app.post("/api/generate-deck")
async def generate_deck(request: DeckAnalysisRequest):
    """Generate optimized deck from collection using your existing algorithms, enforcing bracket rules."""
    try:
        collection = request.collection
        commander_id = request.commander_id
        bracket = request.bracket or 1

        # Convert to DataFrame
        df = pd.DataFrame(collection)

        # Find the selected commander
        selected_commander = None
        for card in collection:
            if card.get("id") == commander_id or card.get("scryfall_id") == commander_id:
                selected_commander = card
                break

        if not selected_commander:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Commander not found"}
            )

        # Enforce bracket rules in deck generation
        from backend.deckgen import generate_commander_deck, enforce_bracket_rules
        deck_data = generate_commander_deck(selected_commander, df)
        deck_data = enforce_bracket_rules(deck_data, bracket)

        # Use your existing analysis logic
        deck_analysis = analyze_deck_quality(deck_data)

        # Use your existing statistics logic
        deck_stats = get_deck_statistics(deck_data)

        return {
            "success": True,
            "deck": deck_data,
            "analysis": deck_analysis,
            "stats": deck_stats,
            "bracket": bracket
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": str(e)}
        )

@app.get("/api/load-sample-collection")
async def load_sample_collection():
    """Load any available collection with Scryfall enrichment"""
    try:
        import os
        import glob
        
        # Look for any CSV files in user-data directory first, then fall back to sample
        user_data_dir = "data/user-data"
        sample_files = []
        
        print(f"Looking for collections in: {user_data_dir}")
        print(f"Directory exists: {os.path.exists(user_data_dir)}")
        
        # Find all CSV files in user-data directory
        if os.path.exists(user_data_dir):
            csv_files = glob.glob(os.path.join(user_data_dir, "*.csv"))
            print(f"Found CSV files: {csv_files}")
            sample_files.extend(csv_files)
        
        # Add sample collection as fallback
        sample_files.append("sample-collection.csv")
        
        print(f"All sample files to try: {sample_files}")
        
        collection_df = None
        used_path = None
        
        for path in sample_files:
            try:
                collection_df = pd.read_csv(path)
                used_path = path
                print(f"Successfully loaded collection from: {path}")
                print(f"Detected columns: {list(collection_df.columns)}")
                break
            except (FileNotFoundError, pd.errors.EmptyDataError, pd.errors.ParserError) as e:
                print(f"Could not load {path}: {e}")
                continue
        
        if collection_df is None:
            raise FileNotFoundError("No valid collection file found")
        
        # Load Scryfall data
        scryfall_data = get_scryfall_data()
        
        # Enrich with Scryfall data using your existing logic
        enriched_df = enrich_collection_with_scryfall(collection_df, scryfall_data)
        
        # Convert to list of dictionaries
        collection = enriched_df.to_dict('records')
        
        # Convert numpy types to native Python types for JSON serialization
        collection = convert_numpy_types(collection)
        
        # Basic stats
        unique_names = enriched_df['name'].nunique() if 'name' in enriched_df.columns else len(enriched_df.drop_duplicates(subset=['Name']) if 'Name' in enriched_df.columns else enriched_df)
        total_quantity = enriched_df['Quantity'].sum() if 'Quantity' in enriched_df.columns else len(collection)
        
        stats = {
            "total_cards": int(len(collection)),  # Individual card instances (should be 635)
            "unique_cards": int(unique_names),    # Unique card names  
            "total_quantity": int(total_quantity), # Should also be 635
            "source": used_path
        }
        
        return {
            "success": True,
            "collection": collection,
            "stats": stats
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e), "details": error_details}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
