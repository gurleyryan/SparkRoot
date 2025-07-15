import requests
import os
import json
import pandas as pd

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
    with open("../data/scryfall_all_cards.json", "wb") as f:
        f.write(response.content)

    print("Saved full card database to data/")

def load_scryfall_cards():
    with open("../data/scryfall_all_cards.json", "r", encoding="utf-8") as f:
        return json.load(f)

def normalize_csv_format(df):
    """Normalize different CSV formats (ManaBox, Moxfield, etc.) to a standard format"""
    # Create a copy to avoid modifying the original
    normalized_df = df.copy()
    
    print(f"Input columns: {list(df.columns)}")
    
    # Enhanced column mapping with flexible alternatives
    column_mapping = {
        # Quantity/Count columns (multiple possible names)
        'Count': 'Quantity',
        'Qty': 'Quantity', 
        'Amount': 'Quantity',
        'Number': 'Quantity',
        'Total': 'Quantity',
        
        # Card name columns
        'Card Name': 'Name',
        'Card': 'Name',
        'Title': 'Name',
        
        # Set/Edition columns
        'Edition': 'Set code',
        'Set': 'Set code',
        'Set Code': 'Set code',
        'Expansion': 'Set code',
        'Release': 'Set code',
        
        # Collector number columns
        'Collector Number': 'Collector number',
        'Card Number': 'Collector number',
        'Number': 'Collector number',
        '#': 'Collector number',
        
        # Moxfield specific mappings
        'Tradelist Count': 'Tradelist count',
        'Tags': 'Tags',
        'Last Modified': 'Last modified',
        'Alter': 'Altered',
        'Proxy': 'Proxy',
        'Purchase Price': 'Purchase price',
        
        # ManaBox specific mappings
        'Set name': 'Set name',
        'Scryfall ID': 'Scryfall ID',
        'ManaBox ID': 'ManaBox ID',
        'Purchase price': 'Purchase price',
        'Purchase price currency': 'Purchase price currency',
        'Misprint': 'Misprint',
        'Altered': 'Altered',
        
        # Common columns that might appear in various formats
        'Condition': 'Condition',
        'Language': 'Language',
        'Foil': 'Foil',
        'Rarity': 'Rarity'
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
    if 'Count' in df.columns and 'Edition' in df.columns:
        detected_format = "Moxfield"
    elif 'Quantity' in df.columns and 'Set code' in df.columns:
        detected_format = "ManaBox"
    elif 'Quantity' in normalized_df.columns and 'Name' in normalized_df.columns:
        detected_format = "Generic MTG Collection"
    
    print(f"Detected format: {detected_format}")
    
    # Ensure we have required columns
    required_columns = ['Name', 'Quantity']
    missing_columns = []
    
    # Try to find Name column with flexible matching
    if 'Name' not in normalized_df.columns:
        name_candidates = [col for col in normalized_df.columns if 'name' in col.lower() or 'card' in col.lower()]
        if name_candidates:
            normalized_df = normalized_df.rename(columns={name_candidates[0]: 'Name'})
            print(f"Auto-mapped name column: {name_candidates[0]} → Name")
    
    # Try to find Set code column with flexible matching  
    if 'Set code' not in normalized_df.columns:
        set_candidates = [col for col in normalized_df.columns if any(term in col.lower() for term in ['set', 'edition', 'expansion'])]
        if set_candidates:
            normalized_df = normalized_df.rename(columns={set_candidates[0]: 'Set code'})
            print(f"Auto-mapped set column: {set_candidates[0]} → Set code")
        else:
            # If no set column found, create a placeholder
            normalized_df['Set code'] = 'unknown'
            print("No set column found, created placeholder")
    
    # Check for required columns
    for col in required_columns:
        if col not in normalized_df.columns:
            missing_columns.append(col)
    
    if missing_columns:
        print(f"Warning: Missing required columns: {missing_columns}")
        # Create default values for missing required columns
        if 'Quantity' not in normalized_df.columns:
            normalized_df['Quantity'] = 1
            print("Created default Quantity column with value 1")
    
    print(f"Final columns: {list(normalized_df.columns)}")
    return normalized_df
    
    # Convert quantity to int and filter out zero quantities
    if 'Quantity' in normalized_df.columns:
        normalized_df['Quantity'] = pd.to_numeric(normalized_df['Quantity'], errors='coerce').fillna(0).astype(int)
        normalized_df = normalized_df[normalized_df['Quantity'] > 0].copy()
    
    return normalized_df

def expand_collection_by_quantity(df):
    """Expand collection dataframe to include one row per individual card (accounting for quantities)"""
    expanded_rows = []
    
    for _, row in df.iterrows():
        quantity = int(row.get('Quantity', 1))
        for i in range(quantity):
            # Create a copy of the row for each card
            card_row = row.to_dict()
            card_row['card_instance'] = i + 1  # Track which instance this is
            expanded_rows.append(card_row)
    
    return pd.DataFrame(expanded_rows)

def load_collection(filepath):
    df = pd.read_csv(filepath)
    
    # Normalize format
    df = normalize_csv_format(df)
    
    return df

def enrich_collection_with_scryfall(collection_df, scryfall_data):
    # Normalize the collection format first
    normalized_df = normalize_csv_format(collection_df)
    
    # Expand by quantity to get individual card instances
    expanded_df = expand_collection_by_quantity(normalized_df)
    
    # Build lookups from Scryfall data
    scryfall_lookup = {card["id"]: card for card in scryfall_data}
    
    # Build name + set lookup for when Scryfall ID isn't available
    name_set_lookup = {}
    for card in scryfall_data:
        name = card.get("name", "").lower()
        set_code = card.get("set", "").lower()
        key = f"{name}|{set_code}"
        if key not in name_set_lookup:  # Prefer first match
            name_set_lookup[key] = card

    enriched = []

    for _, row in expanded_df.iterrows():
        card_data = None
        
        # Try Scryfall ID lookup first
        if "Scryfall ID" in row and pd.notna(row["Scryfall ID"]):
            card_id = str(row["Scryfall ID"]).strip()
            card_data = scryfall_lookup.get(card_id)
        
        # Fall back to name + set lookup
        if not card_data and "Name" in row and "Set code" in row:
            name = str(row["Name"]).lower().strip()
            set_code = str(row["Set code"]).lower().strip()
            lookup_key = f"{name}|{set_code}"
            card_data = name_set_lookup.get(lookup_key)
        
        if card_data:
            # Create enriched card entry - start with essential CSV data
            enriched_card = {
                # Core card identification
                "original_name": row.get("Name"),
                "set_code": row.get("Set code"),
                "set_name": row.get("Set name"),
                "collector_number": row.get("Collector number"),
                "quantity": row.get("Quantity", 1),
                "card_instance": row.get("card_instance", 1),
                
                # Card condition and physical properties
                "condition": row.get("Condition"),
                "language": row.get("Language"),
                "foil": row.get("Foil"),
                "altered": row.get("Altered"),
                "proxy": row.get("Proxy"),
                "misprint": row.get("Misprint"),
                
                # Platform-specific data
                "manabox_id": row.get("ManaBox ID"),
                "tradelist_count": row.get("Tradelist count"),
                "tags": row.get("Tags"),
                "last_modified": row.get("Last modified"),
                
                # Financial data
                "purchase_price": row.get("Purchase price"),
                "purchase_price_currency": row.get("Purchase price currency"),
                
                # Original CSV rarity (to avoid conflict with Scryfall)
                "rarity_csv": row.get("Rarity"),
                
                # Scryfall enriched data
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
                "scryfall_id": card_data.get("id")
            }
            enriched.append(enriched_card)
        else:
            # Keep original data even if not found in Scryfall
            enriched_card = {
                "original_name": row.get("Name"),
                "name": row.get("Name"),  # Fallback to original name
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
                "scryfall_id": row.get("Scryfall ID")
            }
            enriched_card["name"] = row.get("Name", "Unknown")
            enriched.append(enriched_card)
            print(f"Card not found in Scryfall: {row.get('Name', 'Unknown')} ({row.get('Set code', 'Unknown set')})")

    enriched_df = pd.DataFrame(enriched)
    
    # Expand by quantity to get individual card instances
    if 'Quantity' in enriched_df.columns:
        expanded_df = expand_collection_by_quantity(enriched_df)
        return expanded_df
    
    return enriched_df
