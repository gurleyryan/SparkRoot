import io
import pandas as pd
import csv
import os
import httpx
import structlog
import numpy as np
import traceback
import pandas as pd
import glob
import uvicorn
from datetime import timedelta
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query, Body, status
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from pydantic import BaseModel
from backend.utils import normalize_csv_format, expand_collection_by_quantity, enrich_single_row_with_scryfall
from backend.auth_supabase_rest import UserManager, get_user_from_token, get_current_user, create_access_token
from backend.deck_export import export_deck_to_txt, export_deck_to_json, export_deck_to_moxfield, get_deck_statistics
from backend.deckgen import find_valid_commanders, generate_commander_deck, enforce_bracket_rules
from backend.deck_analysis import analyze_deck_quality
from backend.pricing import enrich_collection_with_prices, calculate_collection_value
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sse_starlette.sse import EventSourceResponse
from typing import AsyncGenerator, Dict, Any, List, Optional, Callable, cast

logger = structlog.get_logger()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

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
    username: str
    full_name: str
    created_at: Any = None

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
async def check_username(username: str = Query(...)) -> dict[str, bool]:
    """Check if username is available (not taken)"""
    headers: Dict[str, str] = {
        "apikey": str(SUPABASE_SERVICE_KEY or ""),
        "Authorization": f"Bearer {str(SUPABASE_SERVICE_KEY or '')}",
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
async def check_email(email: str = Query(...)):
    """Check if email is available (not taken)"""

    headers: Dict[str, str] = {
        "apikey": str(SUPABASE_SERVICE_KEY),
        "Authorization": f"Bearer {str(SUPABASE_SERVICE_KEY)}",
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
    """Authenticate user and return access token in JSON response (use Authorization header for future requests)"""
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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # Set your desired token expiration time in minutes
    access_token_expires: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token: str = create_access_token(
        data={"sub": user_email, "user_id": user_id}, expires_delta=access_token_expires
    )
    return {
        "id": user_id,
        "email": user_email,
        "username": username,
        "full_name": str(user.get("full_name", "")),
        "created_at": user.get("created_at", None),  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
        "access_token": access_token,
        "token_type": "bearer",
    }


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """Get current user information"""
    # Compose profile info for frontend, including email and updated_at
    profile_info: Dict[str, Any] = {
        "id": str(current_user["id"]),
        "email": str(current_user["email"]),
        "username": str(current_user.get("username") or ""),
        "full_name": str(current_user.get("full_name") or ""),
        "avatar_url": current_user.get("avatar_url"),
        "created_at": current_user.get("created_at"),
        "updated_at": current_user.get("updated_at"),
    }
    return profile_info


# Collection management endpoints

# Explicit type annotation for get_user_collections_async
get_user_collections_async: Callable[[str], List[Dict[str, Any]]]

@app.get("/api/collections")
async def get_user_collections(current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """Get all collections for the current user"""
    user_id = current_user["id"]
    collections: List[Dict[str, Any]] = get_user_collections_async(user_id)
    return {"success": True, "collections": collections}


@app.get("/api/collections/{collection_id}")
async def get_collection(collection_id: str, current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    """Get a specific collection for the current user"""
    # user_id = current_user["id"]
    # get_collection_by_id is not defined, so this endpoint is disabled for now
    raise HTTPException(
        status_code=501, detail="get_collection_by_id is not implemented."
    )

# Settings endpoints
@app.get("/api/settings")
async def get_user_settings(current_user: Dict[str, Any] = Depends(get_user_from_token)) -> Dict[str, Any]:
    user_id = current_user["id"]
    settings = await UserManager.get_user_settings(user_id)  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
    return {"success": True, "settings": settings}

@app.put("/api/settings")
async def update_user_settings(
    settings: UserSettings = Body(...), 
    current_user: Dict[str, Any] = Depends(get_user_from_token)
) -> Dict[str, Any]:
    user_id = current_user["id"]
    await UserManager.update_user_settings(user_id, settings.settings)  # type: ignore
    return {"success": True, "message": "Settings updated successfully"}

@app.post("/api/auth/update-email")
@limiter.limit("3/minute")  # type: ignore
async def update_email(
    request: UpdateEmailRequest, credentials: HTTPAuthorizationCredentials = Depends()
) -> Dict[str, Any]:
    user: Dict[str, Any] = await get_current_user(credentials)
    user_id = user["id"]
    headers: Dict[str, str] = {
        "apikey": str(SUPABASE_SERVICE_KEY),
        "Authorization": f"Bearer {str(SUPABASE_SERVICE_KEY)}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{SUPABASE_URL}/auth/v1/users/{user_id}",
            headers=headers,
            json={"email": request.new_email},
        )
        if resp.status_code == 200:
            return {"success": True, "message": "Email updated"}
        raise HTTPException(status_code=400, detail="Failed to update email")


# Pricing endpoints


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
    current_password = request.current_password
    new_password = request.new_password
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing current or new password")
    logger.info("User requested password change", user_id=user_id)
    headers: Dict[str, str] = {
        "apikey": str(SUPABASE_SERVICE_KEY),
        "Authorization": f"Bearer {str(SUPABASE_SERVICE_KEY)}",
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
        df = pd.DataFrame(collection)  # type: ignore

        # Use your existing commander detection logic
        commanders = find_valid_commanders(df)

        return {"success": True, "commanders": commanders, "count": len(commanders)}

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/generate-deck")
async def generate_deck(request: DeckAnalysisRequest) -> Dict[str, Any]:
    try:
        collection = request.collection
        commander_id = request.commander_id
        bracket = request.bracket or 1

        # Convert to DataFrame
        df = pd.DataFrame(collection)

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

        # Enforce bracket rules in deck generation
       

        deck_data: Dict[str, Any] = generate_commander_deck(selected_commander, df)  # type: Dict[str, Any]
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
async def upload_collection_progress(file: UploadFile = File(...)) -> EventSourceResponse:

    

    async def event_generator() -> AsyncGenerator[dict[str, Any], None]:
        try:
            # Read file content
            content = await file.read()
            decoded = content.decode(errors="replace")
            # Use csv.reader to get rows
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
            total = len(rows)
            if total == 0:
                yield {"event": "error", "data": {"error": "No rows found in CSV."}}
                return
            enriched_cards: List[Dict[str, Any]] = []
            for idx, row in enumerate(rows):
                # Convert single row to DataFrame for enrichment
                df = pd.DataFrame([row])
                # Enrichment now handled via Supabase; use df directly or query Supabase as needed
                enriched_df = df
                # Get the enriched card dict (first row)
                card_dict: Dict[str, Any] = {}
                if not enriched_df.empty:
                    card_dict = enriched_df.iloc[0].to_dict()  # type: ignore
                    card_dict: Dict[str, Any] = dict(card_dict)  # Explicit type annotation
                    enriched_cards.append(card_dict)
                percent = int(100 * (idx + 1) / total)
                # Only send essential preview fields for frontend
                preview: Dict[str, Any] = {
                    "name": card_dict.get("name") if card_dict else row.get("Name"),
                    "set_code": (
                        card_dict.get("set_code") if card_dict else row.get("Set code")
                    ),
                    "image_uris": card_dict.get("image_uris") if card_dict else None,
                    "card_instance": (
                        card_dict.get("card_instance") if card_dict else None
                    ),
                    "idx": idx,
                    "total": total,
                }
                yield {
                    "event": "progress",
                    "data": {
                        "current": idx + 1,
                        "total": total,
                        "percent": percent,
                        "preview": preview,
                    },
                }
            # After all cards, send the full enriched collection as a final event
            yield {
                "event": "done",
                "data": {"collection": enriched_cards, "total": total},
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": {"error": str(e), "details": traceback.format_exc()},
            }

    return EventSourceResponse(event_generator())

# Entry point for running the FastAPI app with Uvicorn
if __name__ == "__main__":
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)