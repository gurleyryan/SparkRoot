# Quick test script to verify the Flask app setup
import sys
import os

# Add the current directory to the path
sys.path.append(os.path.dirname(__file__))

try:
    from utils import load_collection, load_scryfall_cards
    from deckgen import find_valid_commanders
    print("✓ All imports successful")
    
    # Test if data files exist
    collection_path = os.path.join(os.path.dirname(__file__), "..", "collection.csv")
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "scryfall_all_cards.json")
    
    if os.path.exists(collection_path):
        print("✓ Collection file found")
    else:
        print("✗ Collection file not found at:", collection_path)
    
    if os.path.exists(data_path):
        print("✓ Scryfall data file found")
    else:
        print("✗ Scryfall data file not found at:", data_path)
        print("  Run the download_scryfall_bulk() function first")
    
    print("\nFlask app should be ready to run!")
    print("Run: python app.py")
    
except ImportError as e:
    print("✗ Import error:", e)
except Exception as e:
    print("✗ Error:", e)
