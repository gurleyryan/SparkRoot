"""
Deck export utilities for MTG Deck Optimizer
Handles exporting generated decks to various formats
"""
import json
import os
from datetime import datetime


def export_deck_to_txt(deck_data, filename=None):
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
    lines = []
    lines.append("// MTG Deck Optimizer - Generated Commander Deck")
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
    for card in deck_data["deck"]:
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


def export_deck_to_json(deck_data, filename=None):
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
    export_data = {
        "format": "Commander/EDH",
        "generated_at": datetime.now().isoformat(),
        "commander": deck_data["commander"],
        "deck": deck_data["deck"],
        "deck_size": deck_data["deck_size"],
        "total_cards": deck_data["total_cards"],
        "metadata": {
            "tool": "MTG Deck Optimizer",
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


def export_deck_to_moxfield(deck_data):
    """
    Generate MoxField-compatible import text
    
    Args:
        deck_data: Dictionary from generate_commander_deck()
        
    Returns:
        str: MoxField import format text
    """
    lines = []
    
    # Commander
    lines.append(f"1 {deck_data['commander']['name']} *CMDR*")
    
    # Main deck cards
    for card in deck_data["deck"]:
        card_name = card.get("name", card.get("Name", "Unknown Card"))
        lines.append(f"1 {card_name}")
    
    return "\n".join(lines)


def get_deck_statistics(deck_data):
    """
    Calculate basic deck statistics
    
    Args:
        deck_data: Dictionary from generate_commander_deck()
        
    Returns:
        dict: Statistics about the deck
    """
    deck = deck_data["deck"]
    commander = deck_data["commander"]
    
    # Count card types
    type_counts = {
        "creatures": 0,
        "instants": 0,
        "sorceries": 0,
        "enchantments": 0,
        "artifacts": 0,
        "planeswalkers": 0,
        "lands": 0,
        "other": 0
    }
    
    # Count CMC distribution
    cmc_counts = {}
    total_cmc = 0
    
    for card in deck:
        # Count types
        type_line = card.get("type_line", "").lower()
        if "creature" in type_line:
            type_counts["creatures"] += 1
        elif "instant" in type_line:
            type_counts["instants"] += 1
        elif "sorcery" in type_line:
            type_counts["sorceries"] += 1
        elif "enchantment" in type_line:
            type_counts["enchantments"] += 1
        elif "artifact" in type_line:
            type_counts["artifacts"] += 1
        elif "planeswalker" in type_line:
            type_counts["planeswalkers"] += 1
        elif "land" in type_line:
            type_counts["lands"] += 1
        else:
            type_counts["other"] += 1
        
        # Count CMC
        cmc = card.get("cmc", 0)
        if cmc is not None:
            cmc_counts[cmc] = cmc_counts.get(cmc, 0) + 1
            total_cmc += cmc
    
    avg_cmc = total_cmc / len(deck) if deck else 0
    
    return {
        "commander_name": commander["name"],
        "commander_colors": commander.get("color_identity", []),
        "total_cards": deck_data["total_cards"],
        "deck_size": deck_data["deck_size"],
        "type_distribution": type_counts,
        "cmc_distribution": cmc_counts,
        "average_cmc": round(avg_cmc, 2)
    }
