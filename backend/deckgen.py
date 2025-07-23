import pandas as pd
from typing import Dict, Any, List

# List of Game Changer cards (should match frontend)
GAME_CHANGERS = set([
    # White
    "Drannith Magistrate", "Enlightened Tutor", "Humility", "Serra's Sanctum", "Smothering Tithe", "Teferi's Protection",
    # Blue
    "Consecrated Sphinx", "Cyclonic Rift", "Expropriate", "Force of Will", "Fierce Guardianship", "Gifts Ungiven", "Intuition", "Jin-Gitaxias, Core Augur", "Mystical Tutor", "Narset, Parter of Veils", "Rhystic Study", "Sway of the Stars", "Thassa's Oracle", "Urza, Lord High Artificer",
    # Black
    "Ad Nauseam", "Bolas's Citadel", "Braids, Cabal Minion", "Demonic Tutor", "Imperial Seal", "Necropotence", "Opposition Agent", "Orcish Bowmasters", "Tergrid, God of Fright", "Vampiric Tutor",
    # Red
    "Deflecting Swat", "Gamble", "Jeska's Will", "Underworld Breach",
    # Multicolor
    "Aura Shards", "Coalition Victory", "Grand Arbiter Augustin IV", "Kinnan, Bonder Prodigy", "Yuriko, the Tiger's Shadow", "Notion Thief", "Winota, Joiner of Forces",
    # Colorless
    "Ancient Tomb", "Chrome Mox", "Field of the Dead", "Glacial Chasm", "Grim Monolith", "Lion's Eye Diamond", "Mana Vault", "Mishra's Workshop", "Mox Diamond", "Panoptic Mirror", "The One Ring", "The Tabernacle at Pendrell Vale"
])

def enforce_bracket_rules(deck_data: Dict[str, Any], bracket: int) -> Dict[str, Any]:
    """
    Enforce bracket rules on the generated deck.
    - Bracket 1 & 2: No Game Changers
    - Bracket 3: Up to 3 Game Changers
    - Bracket 4 & 5: Unlimited
    """
    deck = deck_data["deck"]
    # Remove or limit Game Changers
    if bracket in [1, 2]:
        deck = [card for card in deck if card.get("name") not in GAME_CHANGERS]
    elif bracket == 3:
        count = 0
        from typing import List
        new_deck: List[Dict[str, Any]] = []
        for card in deck:
            if card.get("name") in GAME_CHANGERS:
                if count < 3:
                    new_deck.append(card)
                    count += 1
                # else: skip
            else:
                new_deck.append(card)
        deck = new_deck
    # Bracket 4 & 5: no restriction
    deck_data["deck"] = deck
    deck_data["deck_size"] = len(deck)
    deck_data["total_cards"] = len(deck) + 1  # +1 for commander
    deck_data["bracket"] = bracket
    return deck_data



def find_valid_commanders(enriched_df: pd.DataFrame) -> List[Dict[str, Any]]:
    commanders: List[Dict[str, Any]] = []
    for _, card in enriched_df.iterrows():  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
        # card is a pandas Series, dynamic type
        if (
            card.get("type_line", "")  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
            and "Legendary Creature" in card.get("type_line", "")  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
            and card.get("legalities", {}).get("commander") == "legal"  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
        ):
            commanders.append(dict(card.to_dict()))  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]

    return commanders


def generate_commander_deck(commander: Dict[str, Any], card_pool: pd.DataFrame) -> Dict[str, Any]:
    """
    Generate a Commander deck: 1 commander + 99 cards matching color identity from collection.
    
    Args:
        commander: A card dictionary representing the chosen commander
        card_pool: DataFrame of enriched cards from the collection
        
    Returns:
        dict: Contains 'commander' and 'deck' (list of 99 cards)
    """
    commander_color_identity = set(commander.get("color_identity", []))
    
    # Filter cards that match the commander's color identity and are legal in Commander
    valid_cards: List[Dict[str, Any]] = []
    for _, card in card_pool.iterrows():  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
        # card is a pandas Series, dynamic type
        if card.get("Scryfall ID") == commander.get("Scryfall ID"):  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
            continue
        if card.get("legalities", {}).get("commander") != "legal":  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
            continue
        card_color_identity = set(card.get("color_identity", []))  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
        if not card_color_identity.issubset(commander_color_identity):  # type: ignore
            continue
        quantity = card.get("Quantity", 1)  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
        # Ensure quantity is an int for Pyright and runtime safety
        if not isinstance(quantity, int):
            try:
                quantity = int(quantity)  # type: ignore[reportUnknownArgumentType]
            except Exception:
                quantity = 1
        for _ in range(min(quantity, 4)):
            if (
                card.get("type_line", "")  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
                and "Basic Land" in card.get("type_line", "")  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
                and quantity > 4
            ):
                valid_cards.extend([dict(card.to_dict())] * quantity)  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
                break
            else:
                valid_cards.append(dict(card.to_dict()))  # type: ignore[reportUnknownMemberType,reportUnknownVariableType]
    
    # If we have fewer than 99 cards, use what we have
    deck_size = min(99, len(valid_cards))
    
    # Simple selection - take first 99 valid cards
    # In a more sophisticated version, this could include deck building logic
    # like mana curve optimization, card type distribution, etc.
    selected_cards = valid_cards[:deck_size]
    
    return {
        "commander": commander,
        "deck": selected_cards,
        "deck_size": len(selected_cards),
        "total_cards": len(selected_cards) + 1  # +1 for commander
    }


def categorize_cards_by_type(cards: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Helper function to categorize cards by type for better deck building.
    
    Args:
        cards: List of card dictionaries
        
    Returns:
        dict: Categories of cards (creatures, spells, lands, etc.)
    """
    categories: Dict[str, List[Dict[str, Any]]] = {
        "creatures": [],
        "planeswalkers": [],
        "instants": [],
        "sorceries": [],
        "enchantments": [],
        "artifacts": [],
        "lands": []
    }
    
    for card in cards:
        type_line = card.get("type_line", "").lower()
        
        if "creature" in type_line:
            categories["creatures"].append(card)
        elif "planeswalker" in type_line:
            categories["planeswalkers"].append(card)
        elif "instant" in type_line:
            categories["instants"].append(card)
        elif "sorcery" in type_line:
            categories["sorceries"].append(card)
        elif "enchantment" in type_line:
            categories["enchantments"].append(card)
        elif "artifact" in type_line:
            categories["artifacts"].append(card)
        elif "land" in type_line:
            categories["lands"].append(card)
    
    return categories
