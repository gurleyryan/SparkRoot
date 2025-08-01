import pandas as pd
from supabase_db import db
from typing import Any, List, Dict, Union, cast

def normalize_csv_format(df: pd.DataFrame) -> pd.DataFrame:
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
    columns_mapped: List[str] = []
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
    missing_columns: List[str] = []

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


def expand_collection_by_quantity(df: pd.DataFrame) -> pd.DataFrame:
    """Expand collection dataframe to include one row per individual card (accounting for quantities)"""
    expanded_rows: List[Dict[str, Any]] = []

    
    for _, row in df.iterrows():  # type: ignore
        quantity_val = cast(int, row.get("Quantity", 1))  # type: ignore
        try:
            quantity = int(quantity_val)
        except Exception:
            quantity = 1
        for i in range(quantity):
            card_row = cast(Dict[str, Any], row.to_dict())  # type: ignore
            card_row["card_instance"] = i + 1
            expanded_rows.append(card_row)

    return pd.DataFrame(expanded_rows)

def load_collection(filepath: str) -> pd.DataFrame:
    df: pd.DataFrame = pd.read_csv(filepath)  # type: ignore[no-untyped-call]
    # Normalize format
    df = normalize_csv_format(df)
    return df

async def upsert_user_card(
    user_id: Union[int, str],
    card_id: Union[int, str],
    quantity: int,
    condition: Any,
    policy: str = "add"
) -> Any:
    """
    Upsert a card into user_cards with the given policy ('add' or 'replace').
    Returns the user_card_id.
    """
    if policy == "add":
        query = """
        INSERT INTO user_cards (user_id, card_id, quantity, condition)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, card_id, condition)
        DO UPDATE SET quantity = user_cards.quantity + EXCLUDED.quantity
        RETURNING id, quantity
        """
    elif policy == "replace":
        query = """
        INSERT INTO user_cards (user_id, card_id, quantity, condition)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, card_id, condition)
        DO UPDATE SET quantity = EXCLUDED.quantity
        RETURNING id, quantity
        """
    else:
        raise ValueError("Unknown policy: must be 'add' or 'replace'")
    row: Dict[str, Any] | None = await db.execute_query_one(query, (user_id, card_id, quantity, condition))  # type: ignore
    if row is None:
        raise RuntimeError("Database returned None for upsert_user_card query.")
    return row['id']

async def create_collection(
    user_id: Union[int, str],
    name: str,
    description: Union[str, None],
    is_public: bool = False
) -> Any:
    query = """
    INSERT INTO collections (user_id, name, description, is_public)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    """
    row: Dict[str, Any] | None = await db.execute_query_one(query, (user_id, name, description, is_public))  # type: ignore
    if row is None:
        raise RuntimeError("Database returned None for create_collection query.")
    return row['id']

async def update_collection(
    collection_id: Union[int, str],
    name: Union[str, None] = None,
    description: Union[str, None] = None,
    is_public: Union[bool, None] = None
) -> None:
    # Only update provided fields
    fields: List[str] = []
    params: List[Union[str, bool, None]] = []
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
    await db.execute_query(query, tuple([collection_id] + params))  # type: ignore

async def link_collection_card(
    collection_id: Union[int, str],
    user_card_id: Union[int, str]
) -> None:
    query = """
    INSERT INTO collection_cards (collection_id, user_card_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    """
    await db.execute_query(query, (collection_id, user_card_id))  # type: ignore

async def upload_collection_from_csv(
    user_id: Union[int, str],
    collection_df: pd.DataFrame,
    collection_name: str,
    description: Union[str, None] = None,
    is_public: bool = False,
    inventory_policy: str = "add",
    collection_action: str = "new",
    collection_id: Union[int, str, None] = None
) -> Union[int, str]:
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
        await db.execute_query("DELETE FROM collection_cards WHERE collection_id = $1", (collection_id,))  # type: ignore
    else:
        raise ValueError("collection_action must be 'new' or 'update'")

    for _, row in collection_df.iterrows():  # type: ignore
        scryfall_id = cast(str, row.get("Scryfall ID", ""))  # type: ignore
        set_code = cast(str, row.get("Set code", ""))  # type: ignore
        collector_number = cast(str, row.get("Collector number", ""))  # type: ignore
        card_row = await db.execute_query_one( # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
            "SELECT id FROM cards WHERE id = $1 OR (set = $2 AND collector_number = $3)",
            (scryfall_id, set_code, collector_number)
        )  
        if card_row is None or "id" not in card_row:
            continue
        card_id = card_row["id"]  # type: ignore
        quantity_val = cast(int, row.get("Quantity", 1))  # type: ignore
        try:
            quantity = int(quantity_val)
        except Exception:
            quantity = 1
        condition = cast(str, row.get("Condition", ""))  # type: ignore
        user_card_id = await upsert_user_card(
            user_id,
            cast(Union[int, str], card_id),  # type: ignore
            quantity,
            condition,
            policy=inventory_policy
        )  # type: ignore
        await link_collection_card(collection_id, user_card_id)  # type: ignore
    # Ensure collection_id is not None before returning
    if collection_id is None:
        raise RuntimeError("collection_id is None at end of upload_collection_from_csv")
    return collection_id




async def enrich_single_row_with_scryfall(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a single collection row (dict) with card and set data from Supabase.
    Returns: enriched card dict
    """
    # Query card by Scryfall ID or (set, collector_number)
    scryfall_id = row.get("Scryfall ID", "")
    set_code = row.get("Set code", "")
    collector_number = row.get("Collector number", "")
    card_query = """
        SELECT * FROM cards WHERE id = $1 OR (set = $2 AND collector_number = $3)
    """
    card_row: Dict[str, Any] | None = await db.execute_query_one(card_query, (scryfall_id, set_code, collector_number))  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
    set_row: Dict[str, Any] | None = None
    set_icon_svg_uri: str | None = None
    if card_row and cast(Dict[str, Any], card_row).get("set"):  # type: ignore[reportUnknownMemberType]
        set_query = "SELECT * FROM sets WHERE code = $1"
        set_row = await db.execute_query_one(set_query, (card_row["set"],))  # type: ignore[reportUnknownVariableType,reportUnknownMemberType]
        if set_row:
            set_icon_svg_uri = set_row.get("icon_svg_uri")  # type: ignore[reportUnknownMemberType]

    enriched_card: Dict[str, Any] = {
        "original_name": row.get("Name"),
        "set_code": row.get("Set code"),
        "set_name": set_row.get("name") if set_row else row.get("Set name"),  # type: ignore[reportUnknownMemberType]
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
        "name": card_row.get("name") if card_row else row.get("Name"),  # type: ignore[reportUnknownMemberType]
        "oracle_text": card_row.get("oracle_text") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "type_line": card_row.get("type_line") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "mana_cost": card_row.get("mana_cost") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "cmc": card_row.get("cmc") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "colors": card_row.get("colors") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "color_identity": card_row.get("color_identity") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "legalities": card_row.get("legalities") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "layout": card_row.get("layout") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "power": card_row.get("power") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "toughness": card_row.get("toughness") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "keywords": card_row.get("keywords") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "image_uris": card_row.get("image_uris") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "card_faces": card_row.get("card_faces") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "set": card_row.get("set") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "scryfall_set_name": set_row.get("name") if set_row else None,  # type: ignore[reportUnknownMemberType]
        "rarity": card_row.get("rarity") if card_row else None,  # type: ignore[reportUnknownMemberType]
        "scryfall_id": card_row.get("id") if card_row else row.get("Scryfall ID"),  # type: ignore[reportUnknownMemberType]
        "set_icon_svg_uri": set_icon_svg_uri,
    }
    return enriched_card
