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

    os.makedirs("data", exist_ok=True)
    print("Downloading Scryfall card database...")
    response = requests.get(download_url)
    with open("data/scryfall_all_cards.json", "wb") as f:
        f.write(response.content)

    print("Saved full card database to data/")

def load_scryfall_cards():
    with open("data/scryfall_all_cards.json", "r", encoding="utf-8") as f:
        return json.load(f)

def load_collection(filepath):
    df = pd.read_csv(filepath)

    # Normalize and deduplicate if needed
    df = df[df["Quantity"] > 0].copy()
    df["Scryfall ID"] = df["Scryfall ID"].str.strip()

    return df

def enrich_collection_with_scryfall(collection_df, scryfall_data):
    # Build a lookup from Scryfall ID to card data
    scryfall_lookup = {card["id"]: card for card in scryfall_data}

    enriched = []

    for _, row in collection_df.iterrows():
        card_id = row["Scryfall ID"]
        if card_id in scryfall_lookup:
            card_data = scryfall_lookup[card_id]
            enriched_card = row.to_dict()
            enriched_card.update({
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
            })
            enriched.append(enriched_card)
        else:
            print(f"Card not found in Scryfall: {row['Name']}")

    return pd.DataFrame(enriched)
