import io
import pandas as pd
import csv
import os
import httpx
import structlog
import numpy as np
import traceback
import glob
import uvicorn
import sys
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query, Body, status, Form, Request
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from pydantic import BaseModel
from backend.utils import normalize_csv_format, expand_collection_by_quantity, enrich_single_row_with_scryfall, upsert_user_card, create_collection, update_collection, link_collection_card
from backend.auth_supabase_rest import UserManager, get_user_from_token, get_current_user
from backend.deck_export import export_deck_to_txt, export_deck_to_json, export_deck_to_moxfield, get_deck_statistics
from backend.deckgen import generate_commander_deck, find_valid_commanders
from backend.deck_analysis import analyze_deck_quality
from backend.pricing import enrich_collection_with_prices, calculate_collection_value
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any, List, Optional, cast, AsyncGenerator
from backend.cursor import CardLookup

logger = structlog.get_logger()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

app = FastAPI(title="SparkRoot API", version="1.0.0")
app.add_middleware(SentryAsgiMiddleware)


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


class UserSettings(BaseModel):
    settings: Dict[str, Any]

class UpdatePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str

class UpdateEmailRequest(BaseModel):
    new_email: str

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

@app.post("/api/collections/enrich-csv")
async def enrich_collection_csv(file: UploadFile = File(...)) -> Dict[str, Any]:
    content = await file.read()
    decoded = content.decode("utf-8")
    sample = decoded[:1024]
    sniffer = csv.Sniffer()
    try:
        dialect = sniffer.sniff(sample)
        delimiter = dialect.delimiter
    except Exception:
        delimiter = ","
    df = pd.read_csv(io.StringIO(decoded), delimiter=delimiter)  # type: ignore
    df = normalize_csv_format(df)
    df = expand_collection_by_quantity(df)
    enriched: List[Dict[str, Any]] = []
    for _, row in df.iterrows():  # type: ignore
        row: pd.Series[Any] = row  # Explicit type annotation for row
        enriched_row = await enrich_single_row_with_scryfall(row.to_dict())  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
        enriched.append(enriched_row)
    return {"success": True, "enriched": enriched}

def convert_numpy_types(collection: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert numpy types to native Python types for JSON serialization"""

    for card in collection:
        for key, value in card.items():
            try:
                if hasattr(value, "item"):
                    card[key] = value.item()
                elif value is None:
                    card[key] = None
                elif pd.isna(value):
                    card[key] = None
                elif isinstance(value, np.ndarray):
                    card[key] = value.tolist()
                elif isinstance(value, np.generic):
                    card[key] = value.item()
            except (ValueError, TypeError):
                if isinstance(value, tuple):
                    card[key] = list(value)  # type: ignore
                elif isinstance(value, list):
                    card[key] = value
                else:
                    card[key] = f"{value}"
    return collection

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    lambda r, e: JSONResponse(
        status_code=429, content={"error": "Rate limit exceeded"}
    ),
)

# Deck export endpoints (moved after app definition)
class DeckExportRequest(BaseModel):
    deck_data: Dict[str, Any]
    as_file: bool = False


@app.post("/api/export-deck/txt")
async def export_deck_txt(request: DeckExportRequest) -> Any:
    """Export deck to MTGO/Arena TXT format (file or text)."""
    try:
        deck_text, filepath = export_deck_to_txt(request.deck_data)
        if request.as_file:
            return FileResponse(
                filepath, filename=filepath.split(os.sep)[-1], media_type="text/plain"
            )
        return PlainTextResponse(deck_text)
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/export-deck/json")
async def export_deck_json(request: DeckExportRequest) -> Any:
    """Export deck to JSON format (file or text)."""
    try:
        filepath = export_deck_to_json(request.deck_data)
        if request.as_file:
            return FileResponse(
                filepath,
                filename=filepath.split(os.sep)[-1],
                media_type="application/json",
            )
        with open(filepath, "r", encoding="utf-8") as f:
            json_text = f.read()
        return PlainTextResponse(json_text, media_type="application/json")
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/export-deck/moxfield")
async def export_deck_moxfield(request: DeckExportRequest) -> Any:
    """Export deck to MoxField import format (text only)."""
    try:
        moxfield_text = export_deck_to_moxfield(request.deck_data)
        return PlainTextResponse(moxfield_text)
    except Exception as e:
        return {"success": False, "error": str(e)}

class CollectionCard(BaseModel):
    name: str
    set: str = ""
    quantity: int = 1
    foil: bool = False
    condition: str = "Near Mint"


class DeckAnalysisRequest(BaseModel):
    collection: List[Dict[str, Any]]
    commander_id: Optional[str] = None
    bracket: int = 1  # 1-5, default to 1


@app.get("/")
async def root():
    return {"message": "SparkRoot API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SparkRoot API"}

@app.get("/api/auth/check-username")
async def check_username(
    username: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_user_from_token)
) -> dict[str, bool]:
    """Check if username is available (not taken)"""
    jwt_token = current_user["access_token"]
    headers: Dict[str, str] = {
        "apikey": str(SUPABASE_ANON_KEY or ""),
        "Authorization": f"Bearer {str(jwt_token)}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles?username=eq.{username}", headers=headers
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"available": len(data) == 0}
        return {"available": False}


@app.get("/api/auth/check-email")
async def check_email(
    email: str = Query(...),
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Check if email is available (not taken)"""
    jwt_token = current_user["access_token"]
    headers: Dict[str, str] = {
        "apikey": str(SUPABASE_ANON_KEY),
        "Authorization": f"Bearer {str(jwt_token)}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/users?email=eq.{email}", headers=headers
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"available": len(data) == 0}
        return {"available": False}


@app.post("/api/auth/register", response_model=UserResponse)
async def register_user(user_data: Dict[str, Any] = Body(...)):
    """Register a new user"""
    try:
        logger.info(
            "Registering new user",
            email=user_data.get("email"),
            username=user_data.get("username"),
        )
        username = user_data.get("username")
        if (
            username is None
            or not isinstance(username, str)
            or not username.strip()
        ):
            raise HTTPException(
                status_code=400,
                detail="Username is required and must be a non-empty string.",
            )
        user_response: Optional[Dict[str, Any]] = await UserManager.create_user(
            email=str(user_data["email"]), password=str(user_data["password"]), username=str(user_data["username"]), full_name=str(user_data.get("full_name", "")),
        )  
        if user_response:
            return UserResponse(
                id=user_response["id"],
                email=user_response["email"],
                username=str(user_response.get("username", "")),
                full_name=str(user_response.get("full_name", "")),
                created_at=user_response.get("created_at", None),
            )
        else:
            raise HTTPException(status_code=500, detail="User creation failed")
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/login", response_model=None)
async def login_user(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """Authenticate user and return Supabase access token in JSON response (use Authorization header for future requests)"""
    identifier = str(payload.get("identifier") or payload.get("email") or payload.get("username", ""))
    password = str(payload.get("password", ""))
    if not identifier or not password:
        raise HTTPException(status_code=422, detail="Missing identifier or password")
    user: Optional[Dict[str, Any]] = await UserManager.authenticate_user(identifier, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_email: str = str(user.get("email", identifier))
    user_id: str = str(user.get("id", ""))
    username: str = str(user.get("username", ""))
    # Get Supabase access token and token_type from auth_result
    auth_result = user.get("auth_result")
    access_token = None
    token_type = None
    if auth_result:
        access_token = auth_result.get("access_token")
        token_type = auth_result.get("token_type", "bearer")
    if not access_token:
        raise HTTPException(status_code=500, detail="No access token returned from Supabase.")
    return {
        "id": user_id,
        "email": user_email,
        "username": username,
        "full_name": str(user.get("full_name", "")),
        "created_at": user.get("created_at", None),
        "access_token": access_token,
        "token_type": token_type,
    }


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_user_from_token),
) -> Dict[str, Any]:
    """Get current user information"""
    profile_info: Dict[str, Any] = {
        "id": str(current_user["id"]),
        "email": str(current_user["email"]),
        "username": str(current_user.get("username") or ""),
        "full_name": str(current_user.get("full_name") or ""),
        "avatar_url": current_user.get("avatar_url"),
        "created_at": current_user.get("created_at"),
        "updated_at": current_user.get("updated_at"),
        "role": current_user.get("role") or "",
        "app_metadata": current_user.get("app_metadata") or {},
    }
    return profile_info


@app.get("/api/cards")
async def get_cards(game_changer: Optional[bool] = Query(None)) -> Dict[str, Any]:
    """
    Fetch cards from the cards table. Supports filtering by game_changer.
    If game_changer is True, only return the latest printing per oracle_id.
    """
    from backend.supabase_db import db
    if game_changer:
        query = """
            SELECT DISTINCT ON (oracle_id) *
            FROM cards
            WHERE game_changer = TRUE
            ORDER BY oracle_id, released_at DESC
        """
        rows = await db.execute_query(query, (), fetch=True)
    else:
        query = "SELECT * FROM cards"
        rows = await db.execute_query(query, (), fetch=True)
    return {"success": True, "cards": rows}

# Collection management endpoints
@app.get("/api/collections")
async def get_user_collections(request: Request, current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """Get all collections for the current user, including full card details for each collection"""
    try:
        user_id = current_user["id"]
        auth = request.headers.get("authorization")
        jwt_token = ""
        if auth and auth.lower().startswith("bearer "):
            jwt_token = auth.split(" ", 1)[1]
        supabase_api_key = os.getenv("SUPABASE_ANON_KEY")
        if not supabase_api_key:
            raise Exception("Supabase API key not found in environment variables.")
        # Get collections
        collections = await UserManager.get_user_collections(user_id, jwt_token)
        # For each collection, fetch all cards in one request
        async with httpx.AsyncClient() as client:
            for collection in collections:
                collection_id = collection["id"]
                # 1. Get collection_cards for this collection
                resp = await client.get(
                    f"{os.getenv('SUPABASE_URL')}/rest/v1/collection_cards",
                    params={
                        "collection_id": f"eq.{collection_id}",
                        "select": "*,user_cards(*,cards(*))"
                    },
                    headers={
                        "apikey": supabase_api_key,
                        "Authorization": f"Bearer {jwt_token}",
                        "Content-Type": "application/json"
                    }
                )
                collection_cards: List[Dict[str, Any]] = resp.json() if resp.status_code == 200 else []
                cards: List[Dict[str, Any]] = []
                total_quantity = 0
                for cc in collection_cards:
                    user_card = cc.get("user_cards")
                    card = user_card.get("cards") if user_card else None
                    if not user_card or not card:
                        continue
                    quantity = user_card.get("quantity", 1)
                    total_quantity += quantity
                    merged: Dict[str, Any] = {**card, **user_card, "quantity": quantity}
                    cards.append(merged)
                collection["cards"] = cards
                collection["total_cards"] = total_quantity
                collection["unique_cards"] = len(cards)
        return {"success": True, "collections": collections}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/collections/{collection_id}")
async def get_collection(collection_id: str, current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """Get a specific collection for the current user"""
    # user_id = current_user["id"]
    # get_collection_by_id is not defined, so this endpoint is disabled for now
    raise HTTPException(
        status_code=501, detail="get_collection_by_id is not implemented."
    )

# User inventory endpoint: returns all user_cards for the user, joined with card details
@app.get("/api/inventory")
async def get_user_inventory(request: Request, current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """Get the user's full inventory (all user_cards, not just those in collections)"""
    try:
        user_id = current_user["id"]
        auth = request.headers.get("authorization")
        jwt_token = ""
        if auth and auth.lower().startswith("bearer "):
            jwt_token = auth.split(" ", 1)[1]
        supabase_api_key = os.getenv("SUPABASE_ANON_KEY")
        if not supabase_api_key:
            raise Exception("Supabase API key not found in environment variables.")
        # Query all user_cards for this user, join with cards table
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{os.getenv('SUPABASE_URL')}/rest/v1/user_cards",
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "*,cards(*)"
                },
                headers={
                    "apikey": supabase_api_key,
                    "Authorization": f"Bearer {jwt_token}",
                    "Content-Type": "application/json"
                }
            )
            user_cards: List[Dict[str, Any]] = resp.json() if resp.status_code == 200 else []
            cards: List[Dict[str, Any]] = []
            total_quantity = 0
            for uc in user_cards:
                card = uc.get("cards")
                if not card:
                    continue
                quantity = uc.get("quantity", 1)
                total_quantity += quantity
                merged: Dict[str, Any] = {**card, **uc, "quantity": quantity}
                cards.append(merged)
            inventory: Dict[str, Any] = {
                "id": "inventory",
                "user_id": user_id,
                "name": "My Inventory",
                "description": "All cards in your account, across all collections.",
                "cards": cards,
                "created_at": None,
                "updated_at": None,
                "total_cards": total_quantity,
                "unique_cards": len({c.get("id") or c.get("name") for c in cards}),
            }
        return {"success": True, "inventory": inventory}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Settings endpoints
@app.get("/api/settings")
async def get_user_settings(request: Request, current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    user_id = current_user["id"]
    auth = request.headers.get("authorization")
    jwt_token = ""
    if auth and auth.lower().startswith("bearer "):
        jwt_token = auth.split(" ", 1)[1]
    import os
    supabase_api_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_api_key:
        raise Exception("Supabase API key not found in environment variables.")
    # Patch UserManager.get_user_settings to ensure API key is used
    settings = await UserManager.get_user_settings(user_id, jwt_token)
    return {"success": True, "settings": settings}

# Password change endpoint
@app.post("/api/auth/update-password")
@limiter.limit("3/minute")  # type: ignore
@limiter.limit("5/minute")  # type: ignore
async def update_password(
    request: UpdatePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(),
) -> Dict[str, Any]:

    user = await get_current_user(credentials)
    user_id = user["id"]
    jwt_token = user["access_token"]
    current_password = request.current_password
    new_password = request.new_password
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing current or new password")
    logger.info("User requested password change", user_id=user_id)
    headers: Dict[str, str] = {
        "apikey": str(SUPABASE_ANON_KEY),
        "Authorization": f"Bearer {str(jwt_token)}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/auth/v1/users/{user_id}",
            headers=headers,
            json={"password": new_password},
        )
        if resp.status_code == 200:
            return {"success": True, "message": "Password updated"}
        raise HTTPException(status_code=400, detail="Failed to update password")


class PricingRequest(BaseModel):
    collection: List[Dict[str, Any]]
    source: str = "tcgplayer"  # tcgplayer, scryfall


# Pricing enrichment endpoint


# Public collection parsing (no authentication required)
@app.post("/api/parse-collection-public")
async def parse_collection_public(file: UploadFile = File(...)) -> Any:
    try:
        # Read the uploaded file
        contents = await file.read()
        df = None
        try:
            df = pd.read_csv(io.StringIO(contents.decode("utf-8")))  # type: ignore
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(io.StringIO(contents.decode("latin-1")))  # type: ignore
            except UnicodeDecodeError:
                df = pd.read_csv(io.StringIO(contents.decode("cp1252")))  # type: ignore
        except Exception as e:
            return cast(Dict[str, Any], {"success": False, "error": f"Failed to parse CSV: {str(e)}"})
        # DataFrame will never be None here; this check is redundant and removed.
        print(f"Uploaded file: {file.filename}")
        print(f"Detected columns: {list(df.columns)}")
        print(f"Number of rows: {len(df)}")
        # Save the uploaded collection to user-data directory with a generic name
    except Exception as e:
        return cast(Dict[str, Any], {"success": False, "error": str(e)})

@app.post("/api/pricing/enrich-collection")
async def enrich_collection_pricing(
    request: PricingRequest,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
) -> Dict[str, Any]:
    try:
        enriched_collection: List[Dict[str, Any]] = await enrich_collection_with_prices(
            request.collection, request.source
        )  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
        value_stats: Dict[str, Any] = calculate_collection_value(enriched_collection)  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
        return {"success": True, "enriched": enriched_collection, "stats": value_stats}
    except Exception as e:
        error_details = str(e)
        return cast(Dict[str, Any], {"success": False, "error": str(e), "details": error_details})

@app.post("/api/pricing/collection-value")
async def get_collection_value(
    request: PricingRequest,
) -> Any:
    try:
        value_stats: Dict[str, Any] = calculate_collection_value(request.collection)  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
        return {"success": True, "stats": value_stats}
    except Exception as e:
        error_details = str(e)
        return {"success": False, "error": str(e), "details": error_details}

@app.post("/api/pricing/collection-value-public")
async def get_collection_value_public(request: PricingRequest) -> Any:
    try:
        value_stats: Dict[str, Any] = calculate_collection_value(request.collection)  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
        return {"success": True, "stats": value_stats}
    except Exception as e:
        error_details = str(e)
        return {"success": False, "error": str(e), "details": error_details}


# Optional authentication for collection endpoints
@app.post("/api/parse-collection")
async def parse_collection_authenticated(
file: UploadFile = File(...), current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    # Use the same logic as the public endpoint but associate with user
    result: Optional[Dict[str, Any]] = await parse_collection_public(file)

    # If successful and user wants to save it, we can do that here
    if result is not None and result.get("success") and current_user:
        # Optionally auto-save the collection for the user
        try:
            # collection_data = CollectionSave(
            #     name=f"Uploaded Collection - {result['stats']['original_filename']}",
            #     description=f"Automatically saved from upload",
            #     collection_data=result["collection"],
            #     is_public=False,
            # )
            # user_id = current_user["id"]
            # collection_id = UserManager.save_collection(user_id, collection_data)
            # result["auto_saved"] = True
            # result["collection_id"] = collection_id
            pass  # Placeholder for auto-save logic
        except Exception as e:
            result["auto_save_error"] = str(e)

    return result if result is not None else cast(Dict[str, Any], {"success": False, "error": "Parsing failed."})

@app.post("/api/find-commanders")
async def find_commanders(request: DeckAnalysisRequest) -> Dict[str, Any]:
    try:
        collection = request.collection
        commanders = find_valid_commanders(collection)

        return {"success": True, "commanders": commanders, "count": len(commanders)}

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/generate-deck")
async def generate_deck(request: DeckAnalysisRequest, user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    try:
        collection = request.collection
        commander_id = request.commander_id
        bracket = request.bracket or 1
        salt_threshold = getattr(request, "salt_threshold", 0)  # Add to DeckAnalysisRequest if needed

        # Convert to DataFrame and list of dicts
        df = pd.DataFrame(collection)
        card_pool = cast(List[Dict[str, Any]], df.to_dict(orient="records"))  # type: ignore

        # Find the selected commander
        selected_commander = None
        for card in collection:
            if (
                card.get("id") == commander_id
                or card.get("scryfall_id") == commander_id
            ):
                selected_commander = card
                break

        if not selected_commander:
            return {"success": False, "error": "Commander not found"}
        
        # Enrich commander if missing fields
        if selected_commander and "name" not in selected_commander:
            jwt_token = user["access_token"]
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/cards",
                    params={"id": f"eq.{selected_commander.get('id')}", "select": "*"},
                    headers={
                        "apikey": str(SUPABASE_ANON_KEY or ""),
                        "Authorization": f"Bearer {str(jwt_token)}",
                    }
                )
                if resp.status_code == 200 and resp.json():
                    selected_commander = resp.json()[0]

        # Generate deck (deckgen.py handles salt fetching/filtering internally)
        # Use house_rules from request if present, else default to False
        house_rules = getattr(request, "house_rules", False)
        deck_data: Dict[str, Any] = generate_commander_deck(
            selected_commander,
            card_pool,
            bracket=bracket,
            house_rules=house_rules,
            salt_threshold=salt_threshold,
        )
        deck_data["commander"] = selected_commander  # Ensure commander is attached
        # Use your existing analysis logic
        deck_analysis = analyze_deck_quality(deck_data)
        deck_stats = get_deck_statistics(deck_data)

        return {
            "success": True,
            "deck": deck_data,
            "analysis": deck_analysis,
            "stats": deck_stats,
            "bracket": bracket,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/load-sample-collection")
async def load_sample_collection() -> Dict[str, Any]:
    try:

        # Look for any CSV files in user-data directory first, then fall back to sample
        user_data_dir = "data/user-data"
        sample_files: List[str] = []

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

        collection_df: Optional[pd.DataFrame] = None
        used_path: Optional[str] = None

        for path in sample_files:
            try:
                collection_df = pd.read_csv(path)  # type: ignore
                used_path = path
                print(f"Successfully loaded collection from: {path}")
                print(f"Detected columns: {list(collection_df.columns)}")
                break
            except (
                FileNotFoundError,
                pd.errors.EmptyDataError,
                pd.errors.ParserError,
            ) as e:
                print(f"Could not load {path}: {e}")
                continue

        if collection_df is None:
            raise FileNotFoundError("No valid collection file found")

        # Enrichment now handled via Supabase; use collection_df directly or query Supabase as needed
        enriched_df = collection_df

        # Convert to list of dictionaries
        records: List[Dict[str, Any]] = enriched_df.to_dict("records")  # type: ignore
        collection: List[Dict[str, Any]] = [
            {str(k): v for k, v in record.items()} for record in records
        ]  # Explicit type annotation

        # Convert numpy types to native Python types for JSON serialization
        collection = convert_numpy_types(collection)

        # Basic stats
        unique_names = (
            enriched_df["name"].nunique()
            if "name" in enriched_df.columns
            else len(
                enriched_df.drop_duplicates(subset=["Name"])
                if "Name" in enriched_df.columns
                else enriched_df
            )
        )
        total_quantity = (
            enriched_df["Quantity"].sum()
            if "Quantity" in enriched_df.columns
            else len(collection)
        )

        stats: Dict[str, Any] = {
            "total_cards": int(
                len(collection)
            ),  # Individual card instances (should be 635)
            "unique_cards": int(unique_names),  # Unique card names
            "total_quantity": int(total_quantity),  # Should also be 635
            "source": used_path,
        }

        return {"success": True, "collection": collection, "stats": stats}

    except Exception as e:

        error_details = traceback.format_exc()
        return {"success": False, "error": str(e), "details": error_details}


# --- Robust CSV upload, enrichment, and Supabase save for collections ---


@app.post("/api/collections/progress-upload")
async def upload_collection_progress(
    file: UploadFile = File(...),
    name: str = Form("My Collection"),
    description: str = Form(""),
    isPublic: bool = Form(False),
    inventoryPolicy: str = Form("add"),
    collectionAction: str = Form("new"),
    collectionId: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_user_from_token)
) -> EventSourceResponse:

    # Read and decode file outside the generator
    content = await file.read()
    print(f"[progress-upload] Read file content, size: {len(content)}", file=sys.stderr)
    decoded = content.decode(errors="replace")
    print(f"[progress-upload] Decoded file, first 100 chars: {decoded[:100]}", file=sys.stderr)

    async def event_generator(
        decoded: str,
        name: str,
        description: str,
        isPublic: bool,
        inventoryPolicy: str,
        collectionAction: str,
        collectionId: Optional[str],
        current_user: Dict[str, Any]
    ) -> AsyncGenerator[dict[str, Any], None]:
        print("[progress-upload] Starting event_generator", file=sys.stderr)
        try:
            # Parse CSV
            df: pd.DataFrame = pd.read_csv(io.StringIO(decoded))  # type: ignore
            print(f"[progress-upload] Parsed CSV, shape: {df.shape}", file=sys.stderr)
            df = normalize_csv_format(df)
            print(f"[progress-upload] Normalized CSV, shape: {df.shape}", file=sys.stderr)

            # Group by unique card
            group_keys: list[str] = []
            if "Scryfall ID" in df.columns:
                group_keys.append("Scryfall ID")
            elif "Set code" in df.columns and "Collector number" in df.columns:
                group_keys.extend(["Set code", "Collector number"])
            elif "Name" in df.columns and "Set code" in df.columns:
                group_keys.extend(["Name", "Set code"])
            else:
                group_keys = [col for col in ["Scryfall ID", "Set code", "Collector number", "Name"] if col in df.columns]
            if not group_keys:
                print("[progress-upload] No suitable columns to group by.", file=sys.stderr)
                yield {"event": "error", "data": {"error": "No suitable columns to group by."}}
                return

            agg_dict = {"Quantity": "sum"}
            for col in df.columns:
                if col != "Quantity" and col not in group_keys:
                    agg_dict[col] = "first"
            grouped: pd.DataFrame = df.groupby(group_keys, dropna=False, as_index=False).agg(agg_dict)  # type: ignore
            rows: List[Dict[str, Any]] = grouped.to_dict("records")  # type: ignore
            total = len(rows)
            print(f"[progress-upload] Grouped rows (unique cards): {total}", file=sys.stderr)
            if total == 0:
                print("[progress-upload] No rows found in CSV.", file=sys.stderr)
                yield {"event": "error", "data": {"error": "No rows found in CSV."}}
                return

            # Initialize CardLookup
            SUPABASE_URL = os.getenv("SUPABASE_URL")
            SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
            if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
                print("[progress-upload] Supabase credentials missing.", file=sys.stderr)
                yield {"event": "error", "data": {"error": "Supabase credentials missing."}}
                return
            card_lookup = CardLookup(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            print("[progress-upload] Fetching all cards from Supabase for lookup...", file=sys.stderr)
            card_lookup.fetch_all_cards(diagnostics=True)
            print("[progress-upload] Card lookup table ready.", file=sys.stderr)

            user_id = current_user["id"]
            print(f"[progress-upload] User ID: {user_id}", file=sys.stderr)
            if collectionAction == "new":
                print(f"[progress-upload] Creating new collection: {name}", file=sys.stderr)
                collection_id = await create_collection(user_id, name, description, isPublic)
                print(f"[progress-upload] Created collection ID: {collection_id}", file=sys.stderr)
            elif collectionAction == "update" and collectionId:
                print(f"[progress-upload] Updating collection: {collectionId}", file=sys.stderr)
                await update_collection(collectionId, name, description, isPublic)
                collection_id = collectionId
                print(f"[progress-upload] Updated collection ID: {collection_id}", file=sys.stderr)
            else:
                print("[progress-upload] Invalid collection action or missing collectionId.", file=sys.stderr)
                yield {"event": "error", "data": {"error": "Invalid collection action or missing collectionId."}}
                return

            user_card_ids: list[str] = []
            enriched_cards: List[Dict[str, Any]] = []
            for idx, row in enumerate(rows):
                print(f"[progress-upload] Processing row {idx+1}/{total}", file=sys.stderr)
                card_id = None
                scryfall_id = row.get("Scryfall ID")
                set_code = row.get("Set code")
                name_val = row.get("Name")


                # Prefer direct Scryfall ID, else robust lookup by (name + set code + collector number), else name
                if scryfall_id:
                    card_id = scryfall_id
                else:
                    # Try to match by (name + set code + collector number) if available
                    set_code_val = (row.get("Set code") or "").strip().lower()
                    collector_number_val = (row.get("Collector number") or "").strip().lower()
                    matched = None
                    if set_code_val and collector_number_val and hasattr(card_lookup, "card_list") and card_lookup.card_list:
                        for c in card_lookup.card_list:
                            # Defensive: check all fields exist and match
                            c_name = (c.get("name") or "").strip().lower()
                            c_set = (c.get("set") or "").strip().lower()
                            c_collector = (str(c.get("collector_number")) or "").strip().lower()
                            if (
                                c_name == (name_val or "").strip().lower()
                                and c_set == set_code_val
                                and c_collector == collector_number_val
                            ):
                                matched = c.get("id")
                                break
                    if matched:
                        card_id = matched
                    else:
                        # Fallback: lookup by name only
                        ids = card_lookup.lookup(name_val or "")
                        if ids:
                            card_id = ids[0]
                        else:
                            fuzzy = card_lookup.fuzzy_lookup(name_val or "")
                            print(f"[progress-upload] Fuzzy matches for '{name_val}': {fuzzy}", file=sys.stderr)

                if not card_id:
                    print(f"[progress-upload] Card not found for row {idx+1}", file=sys.stderr)
                    preview: Dict[str, Any] = {"name": name_val, "set_code": set_code, "idx": idx, "total": total, "error": "Card not found"}
                    yield {"event": "progress", "data": {"current": idx+1, "total": total, "percent": int(100*(idx+1)/total), "preview": preview}}
                    continue

                quantity = int(row.get("Quantity", 1))
                condition = row.get("Condition", "Near Mint")
                print(f"[progress-upload] Upserting user_card: card_id={card_id}, quantity={quantity}", file=sys.stderr)
                user_card_id = await upsert_user_card(user_id, card_id, quantity, condition, inventoryPolicy)
                print(f"[progress-upload] Upserted user_card_id: {user_card_id}", file=sys.stderr)
                user_card_ids.append(user_card_id)

                print(f"[progress-upload] Linking user_card_id {user_card_id} to collection_id {collection_id}", file=sys.stderr)
                await link_collection_card(collection_id, user_card_id)

                preview = {"name": name_val, "set_code": set_code, "idx": idx, "total": total}
                yield {"event": "progress", "data": {"current": idx+1, "total": total, "percent": int(100*(idx+1)/total), "preview": preview}}
                enriched_cards.append({"user_card_id": user_card_id, "card_id": card_id, "name": name_val, "set_code": set_code, "quantity": quantity})

            print(f"[progress-upload] Done processing all rows. Sending final event.", file=sys.stderr)
            yield {"event": "done", "data": {"collection": enriched_cards, "total": total, "collection_id": collection_id}}
        except Exception as e:
            print(f"[progress-upload] Exception: {e}\n{traceback.format_exc()}", file=sys.stderr)
            yield {"event": "error", "data": {"error": str(e), "details": traceback.format_exc()}}

    return EventSourceResponse(event_generator(
        decoded,
        name,
        description,
        isPublic,
        inventoryPolicy,
        collectionAction,
        collectionId,
        current_user
    ))

# Entry point for running the FastAPI app with Uvicorn
if __name__ == "__main__":
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
