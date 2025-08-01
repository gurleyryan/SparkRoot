import json
import os
import uuid
from supabase import create_client
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from cursor import CardLookup  # Import CardLookup for batch lookup

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise EnvironmentError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def save_deck_to_supabase(
    user_id: str,
    name: str,
    commander_name: str,
    deck_data: Dict[str, Any],
    deck_analysis: Any,
    collection_id: Optional[str] = None,
    bracket: int = 1,
    is_public: bool = False,
    theme: Optional[str] = None,
    color_identity: Optional[list[str]] = None,
    tags: Optional[list[str]] = None
):
    deck_id = str(uuid.uuid4())
    insert_data: dict[str, Any] = {
        "id": deck_id,
        "user_id": user_id,
        "name": name,
        "commander_name": commander_name,
        "deck_data": deck_data,
        "deck_analysis": deck_analysis,
        "is_public": is_public,
        "collection_id": collection_id,
        "bracket": bracket,
        "theme": theme,
        "color_identity": color_identity,
        "tags": tags
    }
    supabase.table("saved_decks").insert(insert_data).execute()  # type: ignore

    # 2. Batch lookup user_cards for all card_ids in the deck
    card_ids = {card["id"] for card in deck_data["cards"]}
    # Use CardLookup for batch fetch
    # Type-safe: SUPABASE_URL and SUPABASE_SERVICE_KEY are checked above, but add assert for type checkers
    assert SUPABASE_URL is not None and SUPABASE_SERVICE_KEY is not None
    lookup = CardLookup(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    user_card_rows = lookup.fetch_rows_by_field_values(
        table="user_cards",
        field="card_id",
        values=card_ids,
        select="id,card_id",
        page_size=100,
        order_field="id",
        diagnostics=False
    )
    # Build a mapping: card_id -> user_card_id (for this user only)
    user_card_map = {row["card_id"]: row["id"] for row in user_card_rows if row.get("card_id") and row.get("id")}

    # 3. Insert into deck_cards using the mapping
    for card in deck_data["cards"]:
        card_id = card["id"]
        quantity = card.get("quantity", 1)
        user_card_id = user_card_map.get(card_id)
        if user_card_id:
            deck_card_data: Dict[str, Any] = {
                "deck_id": deck_id,
                "user_card_id": user_card_id,
                "quantity": quantity
            }
            supabase.table("deck_cards").insert(deck_card_data).execute()  # type: ignore
        # else: optionally handle missing user_card (e.g., skip or error)
    return deck_id

def update_deck_details_in_supabase(
    deck_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    theme: Optional[str] = None,
    tags: Optional[list[str]] = None
):
    """
    Update deck details (name, description, theme, tags) in saved_decks table.
    Only fields provided (not None) will be updated.
    """
    update_data: dict[str, Any] = {}
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if theme is not None:
        update_data["theme"] = theme
    if tags is not None:
        update_data["tags"] = tags
    if not update_data:
        raise ValueError("No fields to update.")
    result = supabase.table("saved_decks").update(update_data).eq("id", deck_id).execute()  # type: ignore
    return result

def export_deck_to_txt(deck_data: Dict[str, Any], filename: Optional[str] = None) -> Tuple[str, str]:
    """
    Export deck to MTGO/Arena compatible text format
    
    Args:
        deck_data: Dictionary from generate_commander_deck()
        filename: Optional filename, auto-generated if None
        
    Returns:
        str: Formatted deck text
    """
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        commander_name = deck_data["commander"]["name"].replace(" ", "_")
        filename = f"{commander_name}_{timestamp}.txt"
    
    # Build the deck text
    lines: list[str] = []
    lines.append("// SparkRoot - Generated Commander Deck")
    lines.append(f"// Commander: {deck_data['commander']['name']}")
    lines.append(f"// Color Identity: {', '.join(deck_data['commander'].get('color_identity', ['Colorless']))}")
    lines.append(f"// Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"// Total Cards: {deck_data['total_cards']}")
    lines.append("")
    
    # Commander section
    lines.append("// Commander")
    lines.append(f"1 {deck_data['commander']['name']}")
    lines.append("")
    
    # Main deck
    lines.append("// Main Deck")
    for card in deck_data["cards"]:
        card_name = card.get("name", card.get("Name", "Unknown Card"))
        lines.append(f"1 {card_name}")
    
    deck_text = "\n".join(lines)
    
    # Save to file
    decks_dir = os.path.join(os.path.dirname(__file__), "..", "decks")
    os.makedirs(decks_dir, exist_ok=True)
    
    filepath = os.path.join(decks_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(deck_text)
    
    return deck_text, filepath


def export_deck_to_json(deck_data: Dict[str, Any], filename: Optional[str] = None) -> str:
    """
    Export deck to JSON format for programmatic use
    
    Args:
        deck_data: Dictionary from generate_commander_deck()
        filename: Optional filename, auto-generated if None
        
    Returns:
        str: File path where JSON was saved
    """
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        commander_name = deck_data["commander"]["name"].replace(" ", "_")
        filename = f"{commander_name}_{timestamp}.json"
    
    # Prepare data for JSON export
    export_data: Dict[str, Any] = {
        "format": "Commander/EDH",
        "generated_at": datetime.now().isoformat(),
        "commander": deck_data["commander"],
        "cards": deck_data["cards"],
        "deck_size": deck_data["deck_size"],
        "total_cards": deck_data["total_cards"],
        "metadata": {
            "tool": "SparkRoot",
            "version": "1.0"
        }
    }
    
    # Save to file
    decks_dir = os.path.join(os.path.dirname(__file__), "..", "decks")
    os.makedirs(decks_dir, exist_ok=True)
    
    filepath = os.path.join(decks_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)
    
    return filepath


def export_deck_to_moxfield(deck_data: Dict[str, Any]) -> str:
    """
    Generate MoxField-compatible import text
    
    Args:
        deck_data: Dictionary from generate_commander_deck()
        
    Returns:
        str: MoxField import format text
    """
    lines: list[str] = []
    
    # Commander
    lines.append(f"1 {deck_data['commander']['name']} *CMDR*")
    
    # Main deck cards
    for card in deck_data["cards"]:
        card_name = card.get("name", card.get("Name", "Unknown Card"))
        lines.append(f"1 {card_name}")
    
    return "\n".join(lines)
