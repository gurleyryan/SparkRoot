"""
Demo script to showcase MTG Deck Optimizer features
Run this to see the complete functionality in action
"""
import sys
import os

# Add the current directory to the path
sys.path.append(os.path.dirname(__file__))

from utils import load_collection, load_scryfall_cards, enrich_collection_with_scryfall
from deckgen import find_valid_commanders, generate_commander_deck
from deck_export import export_deck_to_txt, export_deck_to_json, export_deck_to_moxfield, get_deck_statistics


def main():
    print("🎴 MTG Deck Optimizer - Feature Demo")
    print("=" * 50)
    
    try:
        # Load data
        print("📊 Loading collection and card data...")
        collection_path = os.path.join(os.path.dirname(__file__), "..", "collection.csv")
        collection_df = load_collection(collection_path)
        print(f"   ✓ Loaded {len(collection_df)} cards from collection")
        
        scryfall_data = load_scryfall_cards()
        print(f"   ✓ Loaded {len(scryfall_data)} cards from Scryfall database")
        
        enriched_df = enrich_collection_with_scryfall(collection_df, scryfall_data)
        print(f"   ✓ Enriched collection with complete card data")
        
        # Find commanders
        print("\n🏛️ Finding available commanders...")
        commanders = find_valid_commanders(enriched_df)
        print(f"   ✓ Found {len(commanders)} legal commanders in your collection")
        
        if not commanders:
            print("   ❌ No commanders found. Add some legendary creatures to your collection!")
            return
        
        # Show first few commanders
        print("\n📋 Available Commanders (showing first 3):")
        for i, commander in enumerate(commanders[:3]):
            colors = commander.get('color_identity', ['Colorless'])
            if isinstance(colors, list):
                colors = ', '.join(colors) if colors else 'Colorless'
            print(f"   {i+1}. {commander['name']} ({colors})")
        
        # Generate deck for first commander
        print(f"\n⚔️ Generating deck for: {commanders[0]['name']}")
        deck_data = generate_commander_deck(commanders[0], enriched_df)
        
        print(f"   ✓ Generated deck with {deck_data['total_cards']} total cards")
        print(f"   ✓ Commander: {deck_data['commander']['name']}")
        print(f"   ✓ Deck size: {deck_data['deck_size']}/99 cards")
        
        # Get deck statistics
        print("\n📊 Analyzing deck composition...")
        stats = get_deck_statistics(deck_data)
        
        print("   Card Type Distribution:")
        for card_type, count in stats['type_distribution'].items():
            if count > 0:
                print(f"     • {card_type.title()}: {count}")
        
        print(f"   Average CMC: {stats['average_cmc']}")
        
        # Export demonstrations
        print("\n💾 Testing export functionality...")
        
        # Export to .txt
        txt_content, txt_path = export_deck_to_txt(deck_data)
        print(f"   ✓ Exported to TXT: {txt_path}")
        
        # Export to .json
        json_path = export_deck_to_json(deck_data)
        print(f"   ✓ Exported to JSON: {json_path}")
        
        # Generate MoxField format
        moxfield_text = export_deck_to_moxfield(deck_data)
        print(f"   ✓ Generated MoxField format ({len(moxfield_text.split())} lines)")
        
        print("\n🎉 Demo completed successfully!")
        print("\nNext steps:")
        print("1. Run 'python app.py' to start the web interface")
        print("2. Open http://127.0.0.1:5000 in your browser")
        print("3. Select a commander and generate your deck!")
        print("4. Use the export buttons to save your deck")
        
    except FileNotFoundError as e:
        print(f"❌ File not found: {e}")
        print("Make sure you have:")
        print("  • collection.csv in the root directory")
        print("  • data/scryfall_all_cards.json (run download first)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Check your data files and try again")


if __name__ == "__main__":
    main()
