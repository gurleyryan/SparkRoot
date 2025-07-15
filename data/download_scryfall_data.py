
import requests
import json
import os

DATA_DIR = "data"
DATA_FILE = os.path.join(DATA_DIR, "scryfall_all_cards.json")
META_FILE = os.path.join(DATA_DIR, "scryfall_all_cards.meta.json")

def get_local_version():
    if os.path.exists(META_FILE):
        try:
            with open(META_FILE, "r", encoding="utf-8") as f:
                meta = json.load(f)
            return meta.get("updated_at")
        except Exception:
            return None
    return None

def save_local_version(updated_at):
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump({"updated_at": updated_at}, f)

def download_scryfall_data():
    print("Checking Scryfall bulk data version...")
    bulk_url = "https://api.scryfall.com/bulk-data"
    response = requests.get(bulk_url)
    bulk_data = response.json()
    default_cards = next((item for item in bulk_data["data"] if item["type"] == "default_cards"), None)
    if not default_cards:
        print("Could not find default cards data")
        return

    remote_updated_at = default_cards.get("updated_at")
    local_updated_at = get_local_version()

    if local_updated_at == remote_updated_at and os.path.exists(DATA_FILE):
        print(f"Local Scryfall data is up to date (version: {local_updated_at})")
        return

    print(f"Downloading {default_cards['name']} (version: {remote_updated_at})...")
    cards_response = requests.get(default_cards["download_uri"])
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(cards_response.json(), f)
    save_local_version(remote_updated_at)
    print("Download complete!")

if __name__ == "__main__":
    download_scryfall_data()
