from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
import pandas as pd
import io
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import timedelta
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Import your existing modules
from backend.utils import enrich_collection_with_scryfall, load_scryfall_cards
from backend.deckgen import find_valid_commanders, generate_commander_deck
from backend.deck_analysis import analyze_deck_quality
from backend.deck_export import export_deck_to_txt, export_deck_to_json, export_deck_to_moxfield, get_deck_statistics

# Import authentication modules (Supabase REST API version)
from backend.auth_supabase_rest import (
    UserCreate, UserResponse, UserLogin, Token, CollectionSave, UserSettings,
    UserManager, get_current_user, get_user_from_token, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
)

# Import pricing modules
from backend.pricing import PriceManager, enrich_collection_with_prices, calculate_collection_value

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

app = FastAPI(title="MTG Deck Optimizer API", version="1.0.0")

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
    allow_origins=["*"],  # Allow all origins for development
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

@app.get("/")
async def root():
    return {"message": "MTG Deck Optimizer API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "MTG Deck Optimizer API"}

# Authentication endpoints
@app.post("/api/auth/register", response_model=UserResponse)
async def register_user(user_data: UserCreate):
    """Register a new user"""
    try:
        user_response = await UserManager.create_user(
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name
        )
        if user_response:
            return UserResponse(
                id=user_response["id"],
                email=user_response["email"],
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

@app.post("/api/auth/login", response_model=Token)
async def login_user(user_credentials: UserLogin):
    """Authenticate user and return access token"""
    user = await UserManager.authenticate_user(user_credentials.email, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract email from the user dict structure
    user_email = user.get("email") or user_credentials.email
    user_id = user.get("id")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user_email,
            "user_id": user_id
        },
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_user_from_token)):
    """Get current user information"""
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
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

@app.post("/api/collections")
async def save_collection(
    collection_data: CollectionSave,
    current_user = Depends(get_user_from_token)
):
    """Save a collection for the current user"""
    user_id = current_user["id"]
    collection_id = UserManager.save_collection(user_id, collection_data)
    return {"success": True, "collection_id": collection_id}

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
    return {"success": True, "message": "Settings updated successfully"}

# Pricing endpoints
class PricingRequest(BaseModel):
    collection: List[Dict[str, Any]]
    source: str = "tcgplayer"  # tcgplayer, scryfall

@app.post("/api/pricing/enrich-collection")
async def enrich_collection_pricing(
    request: PricingRequest,
    current_user = Depends(get_user_from_token)
):
    """Add pricing data to collection cards"""
    try:
        enriched_collection = await enrich_collection_with_prices(
            request.collection, 
            request.source
        )
        
        # Calculate collection value
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

@app.post("/api/pricing/collection-value")
async def get_collection_value(
    request: PricingRequest,
    current_user = Depends(get_user_from_token)
):
    """Get just the value statistics for a collection"""
    try:
        # Check if collection already has pricing data
        has_pricing = any(card.get('price_data') for card in request.collection)
        
        if not has_pricing:
            # Enrich with pricing data first
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

# Public pricing endpoints (no authentication required)
@app.post("/api/pricing/collection-value-public")
async def get_collection_value_public(request: PricingRequest):
    """Get collection value without authentication"""
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
        scryfall_data = get_scryfall_data()
        
        # Enrich with Scryfall data using your existing logic
        enriched_df = enrich_collection_with_scryfall(df, scryfall_data)
        
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
    """Generate optimized deck from collection using your existing algorithms"""
    try:
        collection = request.collection
        commander_id = request.commander_id
        
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
        
        # Use your existing deck generation logic
        deck_data = generate_commander_deck(selected_commander, df)
        
        # Use your existing analysis logic
        deck_analysis = analyze_deck_quality(deck_data)
        
        # Use your existing statistics logic
        deck_stats = get_deck_statistics(deck_data)
        
        return {
            "success": True,
            "deck": deck_data,
            "analysis": deck_analysis,
            "stats": deck_stats
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
