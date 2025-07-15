def find_valid_commanders(enriched_df):
    commanders = []
    for _, card in enriched_df.iterrows():
        if (
            card["type_line"] 
            and "Legendary Creature" in card["type_line"]
            and card["legalities"].get("commander") == "legal"
        ):
            # Convert pandas Series to dictionary for template compatibility
            commanders.append(card.to_dict())

    return commanders


def generate_commander_deck(commander, card_pool):
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
    valid_cards = []
    for _, card in card_pool.iterrows():
        # Skip the commander itself
        if card.get("Scryfall ID") == commander.get("Scryfall ID"):
            continue
            
        # Check if card is legal in Commander format
        if card.get("legalities", {}).get("commander") != "legal":
            continue
            
        # Check color identity compatibility
        card_color_identity = set(card.get("color_identity", []))
        if not card_color_identity.issubset(commander_color_identity):
            continue
            
        # Add multiple copies if available (respecting quantity)
        quantity = card.get("Quantity", 1)
        for _ in range(min(quantity, 4)):  # Max 4 copies of any non-basic land
            # Allow unlimited basic lands
            if (card.get("type_line", "") and 
                "Basic Land" in card.get("type_line", "") and 
                quantity > 4):
                # For basic lands, add more copies if needed
                valid_cards.extend([card.to_dict()] * quantity)
                break
            else:
                valid_cards.append(card.to_dict())
    
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


def categorize_cards_by_type(cards):
    """
    Helper function to categorize cards by type for better deck building.
    
    Args:
        cards: List of card dictionaries
        
    Returns:
        dict: Categories of cards (creatures, spells, lands, etc.)
    """
    categories = {
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
