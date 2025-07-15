#!/usr/bin/env python3
"""
Download Scryfall data for Railway deployment
This script downloads the large JSON file that's excluded from git
"""

import requests
import json
import os
from pathlib import Path

def download_scryfall_data():
    """Download the latest Scryfall bulk data"""
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)
    
    target_file = data_dir / "scryfall_all_cards.json"
    
    # Skip if file already exists
    if target_file.exists():
        print(f"✅ {target_file.name} already exists, skipping download")
        return
    
    print("📥 Downloading Scryfall bulk data...")
    
    try:
        # Get bulk data info
        bulk_url = "https://api.scryfall.com/bulk-data"
        response = requests.get(bulk_url, timeout=30)
        response.raise_for_status()
        bulk_data = response.json()
        
        # Find the default cards download
        default_cards = None
        for item in bulk_data["data"]:
            if item["type"] == "default_cards":
                default_cards = item
                break
        
        if not default_cards:
            print("❌ Could not find default cards data")
            return
        
        # Download the file
        print(f"📥 Downloading {default_cards['name']} ({default_cards['size']} bytes)...")
        cards_response = requests.get(default_cards["download_uri"], timeout=300)
        cards_response.raise_for_status()
        
        # Save to data directory
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(cards_response.json(), f)
        
        print(f"✅ Download complete: {target_file}")
        
    except requests.RequestException as e:
        print(f"❌ Download failed: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    download_scryfall_data()
