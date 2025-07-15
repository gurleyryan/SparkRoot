# Data Files for Deployment

## Large Files Not in Git

The following large files are excluded from git but needed for the application:

### `scryfall_all_cards.json` (505MB)
- **Source**: Download from [Scryfall API](https://scryfall.com/docs/api/bulk-data)
- **Purpose**: Complete MTG card database for deck optimization
- **Railway Deployment**: Upload directly to Railway or use download script
- **Local Development**: Download manually or use setup script

## Download Script
```python
import requests
import json

def download_scryfall_data():
    print("Downloading Scryfall bulk data...")
    
    # Get bulk data info
    bulk_url = "https://api.scryfall.com/bulk-data"
    response = requests.get(bulk_url)
    bulk_data = response.json()
    
    # Find the default cards download
    default_cards = None
    for item in bulk_data["data"]:
        if item["type"] == "default_cards":
            default_cards = item
            break
    
    if default_cards:
        # Download the file
        print(f"Downloading {default_cards['name']}...")
        cards_response = requests.get(default_cards["download_uri"])
        
        # Save to data directory
        with open("data/scryfall_all_cards.json", "w", encoding="utf-8") as f:
            json.dump(cards_response.json(), f)
        
        print("Download complete!")
    else:
        print("Could not find default cards data")

if __name__ == "__main__":
    download_scryfall_data()
```

## For Railway Deployment
Add this script to your Railway deployment or download the file manually.
