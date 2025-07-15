import pandas as pd
import os
import sys
from flask import Flask, request, render_template, redirect, url_for, jsonify, send_file

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(__file__))

from utils import (
    load_collection,
    download_scryfall_bulk,
    load_scryfall_cards,
    enrich_collection_with_scryfall
)
from deckgen import find_valid_commanders, generate_commander_deck
from deck_export import export_deck_to_txt, export_deck_to_json, export_deck_to_moxfield, get_deck_statistics

app = Flask(__name__)

# Global variables to store data (in production, consider using a database)
enriched_df = None
commanders = None

def initialize_data():
    """Initialize the card data and commanders"""
    global enriched_df, commanders
    
    # Load collection and Scryfall data (adjust path to go up one directory)
    collection_path = os.path.join(os.path.dirname(__file__), "..", "collection.csv")
    collection_df = load_collection(collection_path)
    scryfall_data = load_scryfall_cards()
    enriched_df = enrich_collection_with_scryfall(collection_df, scryfall_data)
    
    # Find available commanders
    commanders = find_valid_commanders(enriched_df)
    print(f"Loaded {len(commanders)} potential commanders.")

@app.route("/", methods=["GET", "POST"])
def home():
    """
    On GET: show commander choices
    On POST: generate deck for selected commander and display it
    """
    global enriched_df, commanders
    
    # Initialize data if not already loaded
    if enriched_df is None or commanders is None:
        initialize_data()
    
    if request.method == "GET":
        # Show commander selection page
        return render_template("index.html", commanders=commanders)
    
    elif request.method == "POST":
        # Get selected commander ID from form
        selected_commander_id = request.form.get("commander_id")
        
        if not selected_commander_id:
            return redirect(url_for("home"))
        
        # Find the selected commander
        selected_commander = None
        for commander in commanders:
            if commander.get("Scryfall ID") == selected_commander_id:
                selected_commander = commander
                break
        
        if not selected_commander:
            return redirect(url_for("home"))
        
        # Generate the deck
        deck_data = generate_commander_deck(selected_commander, enriched_df)
        
        # Get deck statistics
        deck_stats = get_deck_statistics(deck_data)
        
        return render_template("deck.html", 
                             commander=deck_data["commander"],
                             deck=deck_data["deck"],
                             deck_size=deck_data["deck_size"],
                             total_cards=deck_data["total_cards"],
                             deck_stats=deck_stats,
                             deck_data=deck_data)  # Pass full deck_data for export

@app.route("/download-data")
def download_data():
    """Route to download Scryfall data"""
    try:
        download_scryfall_bulk()
        return "Scryfall data downloaded successfully!"
    except Exception as e:
        return f"Error downloading data: {str(e)}"


@app.route("/export-deck", methods=["POST"])
def export_deck():
    """Route to export deck in various formats"""
    try:
        # Get deck data from form (passed as JSON)
        deck_data = request.get_json()
        export_format = request.form.get("format", "txt")
        
        if export_format == "txt":
            deck_text, filepath = export_deck_to_txt(deck_data)
            return send_file(filepath, as_attachment=True)
        
        elif export_format == "json":
            filepath = export_deck_to_json(deck_data)
            return send_file(filepath, as_attachment=True)
        
        elif export_format == "moxfield":
            moxfield_text = export_deck_to_moxfield(deck_data)
            return jsonify({"success": True, "text": moxfield_text})
        
        else:
            return jsonify({"error": "Invalid export format"}), 400
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Uncomment to download data on first run
    # download_scryfall_bulk()
    
    app.run(debug=True)
