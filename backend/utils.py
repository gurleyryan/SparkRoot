import requests
import os
import json
import pandas as pd
from backend.supabase_db import db

def download_scryfall_bulk():
    url = "https://api.scryfall.com/bulk-data"
    r = requests.get(url)
    bulk_data = r.json()

    for item in bulk_data["data"]:
        if item["type"] == "default_cards":
            download_url = item["download_uri"]
            break

    os.makedirs("../data", exist_ok=True)
    print("Downloading Scryfall card database...")
    response = requests.get(download_url)
    with open("../data/data/scryfall_all_cards.json", "wb") as f:
        f.write(response.content)

    print("Saved full card database to data/")


def load_scryfall_cards():
    import os, psutil

    scryfall_path = "data/data/scryfall_all_cards.json"
    if not os.path.exists(scryfall_path):
        raise FileNotFoundError(f"Scryfall file not found: {scryfall_path}")
    file_size = os.path.getsize(scryfall_path)
    print(f"[Scryfall] File size: {file_size/1024/1024:.2f} MB")
    process = psutil.Process(os.getpid())
    mem_before = process.memory_info().rss / 1024 / 1024
    print(f"[Scryfall] Memory usage before loading: {mem_before:.2f} MB")
    with open(scryfall_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    mem_after = process.memory_info().rss / 1024 / 1024
    print(
        f"[Scryfall] Memory usage after loading: {mem_after:.2f} MB (delta: {mem_after-mem_before:.2f} MB)"
    )
    # Check for Scryfall List object
    if isinstance(data, dict) and "data" in data:
        cards = data["data"]
        print(f"[Scryfall] Loaded {len(cards)} cards from data['data'].")
        return cards
    elif isinstance(data, list):
        print(f"[Scryfall] Loaded {len(data)} cards (list at top level).")
        return data
    else:
        print(
            "[Scryfall] WARNING: Unexpected Scryfall JSON structure! Returning raw data."
        )
        return data


def normalize_csv_format(df):
    """Normalize different CSV formats (ManaBox, Moxfield, etc.) to a standard format"""
    # Create a copy to avoid modifying the original
    normalized_df = df.copy()

    print(f"Input columns: {list(df.columns)}")

    # Enhanced column mapping with flexible alternatives
    column_mapping = {
        # Quantity/Count columns (multiple possible names)
        "Count": "Quantity",
        "Qty": "Quantity",
        "Amount": "Quantity",
        "Number": "Quantity",
        "Total": "Quantity",
        # Card name columns
        "Card Name": "Name",
        "Card": "Name",
        "Title": "Name",
        # Set/Edition columns
        "Edition": "Set code",
        "Set": "Set code",
        "Set Code": "Set code",
        "Expansion": "Set code",
        "Release": "Set code",
        # Collector number columns
        "Collector Number": "Collector number",
        "Card Number": "Collector number",
        "Number": "Collector number",
        "#": "Collector number",
        # Moxfield specific mappings
        "Tradelist Count": "Tradelist count",
        "Tags": "Tags",
        "Last Modified": "Last modified",
        "Alter": "Altered",
        "Proxy": "Proxy",
        "Purchase Price": "Purchase price",
        # ManaBox specific mappings
        "Set name": "Set name",
        "Scryfall ID": "Scryfall ID",
        "ManaBox ID": "ManaBox ID",
        "Purchase price": "Purchase price",
        "Purchase price currency": "Purchase price currency",
        "Misprint": "Misprint",
        "Altered": "Altered",
        # Common columns that might appear in various formats
        "Condition": "Condition",
        "Language": "Language",
        "Foil": "Foil",
        "Rarity": "Rarity",
    }

    # Apply column mapping
    columns_mapped = []
    for old_name, new_name in column_mapping.items():
        if old_name in normalized_df.columns:
            normalized_df = normalized_df.rename(columns={old_name: new_name})
            columns_mapped.append(f"{old_name} → {new_name}")

    if columns_mapped:
        print(f"Mapped columns: {columns_mapped}")

    # Auto-detect format based on available columns
    detected_format = "Unknown"
    if "Count" in df.columns and "Edition" in df.columns:
        detected_format = "Moxfield"
    elif "Quantity" in df.columns and "Set code" in df.columns:
        detected_format = "ManaBox"
    elif "Quantity" in normalized_df.columns and "Name" in normalized_df.columns:
        detected_format = "Generic MTG Collection"

    print(f"Detected format: {detected_format}")

    # Ensure we have required columns
    required_columns = ["Name", "Quantity"]
    missing_columns = []

    # Try to find Name column with flexible matching
    if "Name" not in normalized_df.columns:
        name_candidates = [
            col
            for col in normalized_df.columns
            if "name" in col.lower() or "card" in col.lower()
        ]
        if name_candidates:
            normalized_df = normalized_df.rename(columns={name_candidates[0]: "Name"})
            print(f"Auto-mapped name column: {name_candidates[0]} → Name")

    # Try to find Set code column with flexible matching
    if "Set code" not in normalized_df.columns:
        set_candidates = [
            col
            for col in normalized_df.columns
            if any(term in col.lower() for term in ["set", "edition", "expansion"])
        ]
        if set_candidates:
            normalized_df = normalized_df.rename(
                columns={set_candidates[0]: "Set code"}
            )
            print(f"Auto-mapped set column: {set_candidates[0]} → Set code")
        else:
            # If no set column found, create a placeholder
            normalized_df["Set code"] = "unknown"
            print("No set column found, created placeholder")

    # Check for required columns
    for col in required_columns:
        if col not in normalized_df.columns:
            missing_columns.append(col)

    if missing_columns:
        print(f"Warning: Missing required columns: {missing_columns}")
        # Create default values for missing required columns
        if "Quantity" not in normalized_df.columns:
            normalized_df["Quantity"] = 1
            print("Created default Quantity column with value 1")

    print(f"Final columns: {list(normalized_df.columns)}")
    return normalized_df

    # Convert quantity to int and filter out zero quantities
    if "Quantity" in normalized_df.columns:
        normalized_df["Quantity"] = (
            pd.to_numeric(normalized_df["Quantity"], errors="coerce")
            .fillna(0)
            .astype(int)
        )
        normalized_df = normalized_df[normalized_df["Quantity"] > 0].copy()

    return normalized_df


def expand_collection_by_quantity(df):
    """Expand collection dataframe to include one row per individual card (accounting for quantities)"""
    expanded_rows = []

    for _, row in df.iterrows():
        quantity = int(row.get("Quantity", 1))
        for i in range(quantity):
            # Create a copy of the row for each card
            card_row = row.to_dict()
            card_row["card_instance"] = i + 1  # Track which instance this is
            expanded_rows.append(card_row)

    return pd.DataFrame(expanded_rows)

def load_collection(filepath):
    df = pd.read_csv(filepath)

    # Normalize format
    df = normalize_csv_format(df)

    return df

async def upsert_user_card(user_id, card_id, quantity, condition, foil, language, policy="add"):
    """
    Upsert a card into user_cards with the given policy ('add' or 'replace').
    Returns the user_card_id.
    """
    if policy == "add":
        query = """
        INSERT INTO user_cards (user_id, card_id, quantity, condition, foil, language)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, card_id, condition, foil, language)
        DO UPDATE SET quantity = user_cards.quantity + EXCLUDED.quantity
        RETURNING id, quantity
        """
    elif policy == "replace":
        query = """
        INSERT INTO user_cards (user_id, card_id, quantity, condition, foil, language)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, card_id, condition, foil, language)
        DO UPDATE SET quantity = EXCLUDED.quantity
        RETURNING id, quantity
        """
    else:
        raise ValueError("Unknown policy: must be 'add' or 'replace'")
    row = await db.execute_query_one(query, (user_id, card_id, quantity, condition, foil, language))
    return row['id']

async def create_collection(user_id, name, description, is_public=False):
    query = """
    INSERT INTO collections (user_id, name, description, is_public)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    """
    row = await db.execute_query_one(query, (user_id, name, description, is_public))
    return row['id']

async def update_collection(collection_id, name=None, description=None, is_public=None):
    # Only update provided fields
    fields = []
    params = []
    if name is not None:
        fields.append("name = $%d" % (len(params)+2))
        params.append(name)
    if description is not None:
        fields.append("description = $%d" % (len(params)+2))
        params.append(description)
    if is_public is not None:
        fields.append("is_public = $%d" % (len(params)+2))
        params.append(is_public)
    if not fields:
        return
    query = f"UPDATE collections SET {', '.join(fields)} WHERE id = $1"
    await db.execute_query(query, tuple([collection_id] + params))

async def link_collection_card(collection_id, user_card_id):
    query = """
    INSERT INTO collection_cards (collection_id, user_card_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    """
    await db.execute_query(query, (collection_id, user_card_id))

async def upload_collection_from_csv(
    user_id,
    collection_df,
    collection_name,
    description=None,
    is_public=False,
    inventory_policy="add",
    collection_action="new",
    collection_id=None
):
    """
    Upload a collection from a CSV DataFrame.
    - inventory_policy: 'add' (default, non-destructive) or 'replace' (overwrite quantities)
    - collection_action: 'new' (default, create new collection) or 'update' (replace cards in existing collection)
    - collection_id: required if collection_action is 'update'
    """
    await db.init_pool()
    if collection_action == "new":
        collection_id = await create_collection(user_id, collection_name, description, is_public)
    elif collection_action == "update":
        if not collection_id:
            raise ValueError("collection_id must be provided for update action")
        await update_collection(collection_id, name=collection_name, description=description, is_public=is_public)
        # Remove all old collection_cards for this collection
        await db.execute_query("DELETE FROM collection_cards WHERE collection_id = $1", (collection_id,))
    else:
        raise ValueError("collection_action must be 'new' or 'update'")

    for _, row in collection_df.iterrows():
        # Lookup card in Supabase by Scryfall ID, set code, collector number
        scryfall_id = row.get("Scryfall ID")
        set_code = row.get("Set code")
        collector_number = row.get("Collector number")
        card_row = await db.execute_query_one(
            "SELECT id FROM cards WHERE id = $1 OR (set = $2 AND collector_number = $3)",
            (scryfall_id, set_code, collector_number)
        )
        if not card_row:
            continue  # Skip if card not found
        card_id = card_row['id']
        # Upsert into user_cards with chosen policy
        user_card_id = await upsert_user_card(
            user_id,
            card_id,
            int(row.get("Quantity", 1)),
            row.get("Condition"),
            row.get("Foil"),
            row.get("Language"),
            policy=inventory_policy
        )
        # Link to collection
        await link_collection_card(collection_id, user_card_id)
    await db.close_pool()
    return collection_id


def enrich_single_row_with_scryfall(row, scryfall_data, set_icon_lookup=None):
    """
    Enrich a single collection row (dict) with Scryfall data. Used for streaming progress.
    set_icon_lookup: optional, pass if already built for efficiency.
    Returns: enriched card dict
    """
    import pandas as pd

    # Build lookups (reuse if possible)
    scryfall_lookup = {card["id"]: card for card in scryfall_data}
    name_set_lookup = {}
    for card in scryfall_data:
        name = card.get("name", "").lower()
        set_code = card.get("set", "").lower()
        key = f"{name}|{set_code}"
        if key not in name_set_lookup:
            name_set_lookup[key] = card
    # Set icon lookup (reuse if possible)
    if set_icon_lookup is None:
        set_icon_lookup = {}
        # Try to load from Scryfall sets cache if available
        SETS_CACHE_PATH = "data/data/scryfall_sets.json"
        import os, json

        if os.path.exists(SETS_CACHE_PATH):
            with open(SETS_CACHE_PATH, "r", encoding="utf-8") as f:
                sets_json = json.load(f)
            if isinstance(sets_json, dict) and "data" in sets_json:
                scryfall_sets = sets_json["data"]
            else:
                scryfall_sets = sets_json
            set_icon_lookup = {
                s["code"].lower(): s.get("icon_svg_uri") for s in scryfall_sets
            }
    # Try Scryfall ID lookup first
    card_data = None
    if "Scryfall ID" in row and pd.notna(row["Scryfall ID"]):
        card_id = str(row["Scryfall ID"]).strip()
        card_data = scryfall_lookup.get(card_id)
    # Fall back to name + set lookup
    if not card_data and "Name" in row and "Set code" in row:
        name = str(row["Name"]).lower().strip()
        set_code = str(row["Set code"]).lower().strip()
        lookup_key = f"{name}|{set_code}"
        card_data = name_set_lookup.get(lookup_key)
    # Get set icon SVG URI if possible
    set_code = card_data.get("set") if card_data else row.get("Set code")
    set_icon_svg_uri = (
        set_icon_lookup.get(str(set_code).lower())
        if set_code and set_icon_lookup
        else None
    )
    if card_data:
        enriched_card = {
            "original_name": row.get("Name"),
            "set_code": row.get("Set code"),
            "set_name": row.get("Set name"),
            "collector_number": row.get("Collector number"),
            "quantity": row.get("Quantity", 1),
            "card_instance": row.get("card_instance", 1),
            "condition": row.get("Condition"),
            "language": row.get("Language"),
            "foil": row.get("Foil"),
            "altered": row.get("Altered"),
            "proxy": row.get("Proxy"),
            "misprint": row.get("Misprint"),
            "manabox_id": row.get("ManaBox ID"),
            "tradelist_count": row.get("Tradelist count"),
            "tags": row.get("Tags"),
            "last_modified": row.get("Last modified"),
            "purchase_price": row.get("Purchase price"),
            "purchase_price_currency": row.get("Purchase price currency"),
            "rarity_csv": row.get("Rarity"),
            "name": card_data.get("name"),
            "oracle_text": card_data.get("oracle_text"),
            "type_line": card_data.get("type_line"),
            "mana_cost": card_data.get("mana_cost"),
            "cmc": card_data.get("cmc"),
            "colors": card_data.get("colors"),
            "color_identity": card_data.get("color_identity"),
            "legalities": card_data.get("legalities"),
            "layout": card_data.get("layout"),
            "power": card_data.get("power"),
            "toughness": card_data.get("toughness"),
            "keywords": card_data.get("keywords"),
            "image_uris": card_data.get("image_uris"),
            "card_faces": card_data.get("card_faces"),
            "set": card_data.get("set"),
            "scryfall_set_name": card_data.get("set_name"),
            "rarity": card_data.get("rarity"),
            "scryfall_id": card_data.get("id"),
            "set_icon_svg_uri": set_icon_svg_uri,
        }
        return enriched_card
    else:
        enriched_card = {
            "original_name": row.get("Name"),
            "name": row.get("Name"),
            "set_code": row.get("Set code"),
            "set_name": row.get("Set name"),
            "collector_number": row.get("Collector number"),
            "quantity": row.get("Quantity", 1),
            "card_instance": row.get("card_instance", 1),
            "condition": row.get("Condition"),
            "language": row.get("Language"),
            "foil": row.get("Foil"),
            "altered": row.get("Altered"),
            "proxy": row.get("Proxy"),
            "misprint": row.get("Misprint"),
            "manabox_id": row.get("ManaBox ID"),
            "tradelist_count": row.get("Tradelist count"),
            "tags": row.get("Tags"),
            "last_modified": row.get("Last modified"),
            "purchase_price": row.get("Purchase price"),
            "purchase_price_currency": row.get("Purchase price currency"),
            "rarity": row.get("Rarity"),
            "scryfall_id": row.get("Scryfall ID"),
            "set_icon_svg_uri": set_icon_svg_uri,
        }
        return enriched_card
