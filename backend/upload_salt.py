import os
import pandas as pd
import json
import re
from typing import List, Dict, Any, Tuple, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# List of years to process
YEARS = [2019, 2020, 2021, 2022, 2023, 2024]
CSV_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'data', 'salt'))  # Path to salt CSVs

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # Use service key for write access

def load_and_tag_csv(year: int) -> pd.DataFrame:
    path = os.path.join(CSV_DIR, f"{year}.csv")
    df = pd.read_csv(path) # type: ignore
    df["years_included"] = [[year]] * len(df)
    return df

def combine_salt_lists(years: List[int]) -> pd.DataFrame:
    all_rows: List[pd.DataFrame] = []
    for year in years:
        df = load_and_tag_csv(year)
        all_rows.append(df)
    combined = pd.concat(all_rows, ignore_index=True)
    # Normalize names for deduplication
    combined["Name_normalized"] = combined["Name"].apply(lambda n: normalize_name(str(n)))  # type: ignore
    # Group by normalized name, combine years_included, keep first row's data
    grouped: pd.DataFrame = (
        combined.groupby("Name_normalized", as_index=False)  # type: ignore
        .agg({
            **{col: "first" for col in combined.columns if col not in ["years_included", "Name_normalized"]},
            "years_included": lambda x: sorted(set(int(y) for years in x for y in years))  # type: ignore
        })
    )
    grouped = grouped.drop(columns=["Name_normalized"])
    return grouped

def normalize_name(name: str) -> str:
    # Lowercase, remove punctuation, strip whitespace
    return re.sub(r'[^a-z0-9 ]', '', name.lower().strip())

def fetch_card_ids(supabase: Client) -> Tuple[Dict[str, List[str]], List[Dict[str, Any]]]:
    # Fetch all card names and ids from public.cards
    cards: List[Dict[str, Any]] = []
    page_size = 100
    last_id = None
    page = 0
    while True:
        query = supabase.table("cards").select("id,name,printed_name,card_faces").order("id")
        if last_id is not None:
            query = query.gte("id", last_id)
        resp = query.limit(page_size + 1).execute()
        data = resp.data
        print(f"Page {page}: fetched {len(data) if data else 0} rows", end="")
        error = getattr(resp, 'error', None)
        if error:
            print(f" | ERROR: {error}")
        else:
            print()
        if not data:
            break
        # If this is not the first page, skip the first row (duplicate of last_id)
        if last_id is not None and len(data) > 0:
            data = data[1:]
        cards.extend(data)
        if len(data) < page_size:
            break
        last_id = data[-1]["id"]
        page += 1
    # Deduplicate by card id
    unique_cards: Dict[Any, Dict[str, Any]] = {}
    for c in cards:
        cid = c.get("id")
        if cid:
            unique_cards[cid] = c
    cards: List[Dict[str, Any]] = list(unique_cards.values())
    print(f"Total cards fetched from Supabase (raw): {len(cards)}")
    print(f"Total unique card IDs after deduplication: {len(unique_cards)}")
    EXPECTED_TOTAL = 108566
    if len(unique_cards) != EXPECTED_TOTAL:
        print(f"WARNING: Expected {EXPECTED_TOTAL} unique card IDs, but got {len(unique_cards)}! Possible pagination/data issue.")
    # Diagnostic: print all cards whose normalized name is 'destructive force'
    destructive_force_cards = [c for c in cards if normalize_name(str(c.get("name", ""))) == "destructive force"]
    print(f"DIAGNOSTIC: Found {len(destructive_force_cards)} cards with normalized name 'destructive force':")
    for c in destructive_force_cards:
        print(f"  {c}")
    while True:
        resp = supabase.table("cards").select("id,name,printed_name,card_faces").range(page * page_size, (page + 1) * page_size - 1).execute()
        data = resp.data
        if not data:
            break
        cards.extend(data)
        if len(data) < page_size:
            break
        page += 1
    print(f"Total cards fetched from Supabase: {len(cards)}")
    # Map: normalized name -> list of ids (to handle reprints/alternates)
    name_to_ids: Dict[str, List[str]] = {}
    # For debugging: collect all normalized names for each card
    # Build a reverse lookup: normalized name -> list of card dicts
    normalized_name_to_cards: Dict[str, List[Dict[str, Any]]] = {}
 
    for c in cards:
        id_ = c.get("id")
        if not id_:
            continue
        names: set[str] = set()
        for key in ["name", "printed_name"]:
            n = c.get(key)
            if n:
                names.add(normalize_name(n))
        # Add card_faces names if present, robustly handle JSON string or list
        faces = c.get("card_faces")
        # If faces is a string, try to parse as JSON
        if faces and isinstance(faces, str):
            try:
                faces = json.loads(faces)
            except Exception:
                faces = None
        if faces and isinstance(faces, list):
            for face in faces: # type: ignore
                if isinstance(face, dict):
                    face_name = face.get("name") # type: ignore
                    if isinstance(face_name, str) and face_name:
                        names.add(normalize_name(face_name))
        for n in names:
            name_to_ids.setdefault(n, []).append(id_)
            normalized_name_to_cards.setdefault(n, []).append(c)
    # Print debug info for all skipped card names
    skipped_debug_names = [
        'destructive force',
        'expropriate',
        'confusion in the ranks',
        'bend or break',
        'worldpurge',
        'epicenter',
        'possessed portal',
        'gilded drake',
        'keldon firebombers'
    ]
    for debug_name in skipped_debug_names:
        if debug_name in normalized_name_to_cards:
            print(f"DEBUG: Cards with normalized name '{debug_name}':")
            for c in normalized_name_to_cards[debug_name]:
                print(f"  {c}")
        else:
            print(f"DEBUG: No cards found with normalized name '{debug_name}'")
    # Debug: print all normalized names in card_id_map
    print(f"Total normalized names in card_id_map: {len(name_to_ids)}")
    print(f"Sample normalized names: {list(name_to_ids.keys())[:20]}")
    if 'apocalypse' in name_to_ids:
        print(f"DEBUG: apocalypse in card_id_map: {name_to_ids['apocalypse']}")
    else:
        print("DEBUG: apocalypse NOT in card_id_map")
    return name_to_ids, cards

def fetch_existing_salt_card_ids(supabase: Client) -> set[str]:
    existing_ids: set[str] = set()
    page = 0
    page_size = 1000
    while True:
        resp = supabase.table("salt").select("card_id").range(page * page_size, (page + 1) * page_size - 1).execute()
        data = resp.data
        if not data:
            break
        existing_ids.update(row["card_id"] for row in data if "card_id" in row)
        if len(data) < page_size:
            break
        page += 1
    return existing_ids

def upload_to_supabase(supabase: Client, salt_df: pd.DataFrame, card_id_map: Dict[str, List[str]], card_list: Optional[List[Dict[str, Any]]] = None):
    rows_to_insert: List[Dict[str, Any]] = []
    total_rows = len(salt_df)
    processed_rows = 0
    # Fetch existing salt card_ids to avoid unique constraint errors
    existing_salt_ids = fetch_existing_salt_card_ids(supabase)
    skipped_already_in_salt = 0
    skipped_no_card_id = 0
    skipped_names: List[str] = []
    for _, row in salt_df.iterrows():
        name = normalize_name(str(row["Name"]))
        card_ids = card_id_map.get(name, [])
        if not card_ids:
            skipped_no_card_id += 1
            skipped_names.append(row["Name"])
            # Debug: print close matches for only the first 10 skipped cards
            if skipped_no_card_id <= 10:
                print(f"Skipping: {row['Name']} (normalized: '{name}') (no card_id found)")
                import difflib
                close = difflib.get_close_matches(name, list(card_id_map.keys()), n=3, cutoff=0.7)
                if close:
                    print(f"  Close matches: {close}")
                print("  Raw possible matches from fetched cards:")
                for k in list(card_id_map.keys()):
                    if name in k or k in name:
                        print(f"    {k}")
                for k in list(card_id_map.keys()):
                    if name.replace(' ', '') in k.replace(' ', '') or k.replace(' ', '') in name.replace(' ', ''):
                        print(f"    (substring match) {k}")
                if card_list is not None:
                    print("  Raw Supabase card records with name or printed_name containing skipped name:")
                    skipped_name = row['Name'].lower().replace("'", "")
                    count = 0
                    for c in card_list:
                        n = (c.get("name") or "").lower().replace("'", "")
                        pn = (c.get("printed_name") or "").lower().replace("'", "")
                        if skipped_name in n or skipped_name in pn:
                            print(f"    {c}")
                            count += 1
                            if count >= 3:
                                break
                        if c.get("name") and normalize_name(str(c.get("name"))) == name:
                            print(f"DEBUG: Card with matching normalized name: {c}")
                        if c.get("printed_name") and normalize_name(str(c.get("printed_name"))) == name:
                            print(f"DEBUG: Card with matching normalized printed_name: {c}")
        else:
            for card_id in card_ids:
                if card_id in existing_salt_ids:
                    skipped_already_in_salt += 1
                    continue
                entry: Dict[str, Any] = {
                    "card_id": card_id,
                    "Card Kingdom": row.get("Card Kingdom"),
                    "TCGPlayer": row.get("TCGPlayer"),
                    "Face to Face": row.get("Face to Face"),
                    "Cardmarket": row.get("Cardmarket"),
                    "Cardhoarder": row.get("Cardhoarder"),
                    "Salt": row.get("Salt"),
                    "Decks": row.get("Decks"),
                    "years_included": row.get("years_included"),
                }
                entry = clean_row(entry)
                rows_to_insert.append(entry)
        processed_rows += 1
        if processed_rows % 100 == 0 or processed_rows == total_rows:
            print(f"Processed {processed_rows}/{total_rows} salt rows...")
    # Deduplicate rows_to_insert by card_id (robustly)
    unique_rows = {}
    for entry in rows_to_insert:
        card_id = entry.get("card_id")
        if card_id:
            unique_rows[card_id] = entry  # always keep the last occurrence
    deduped_rows: List[Dict[str, Any]] = list(unique_rows.values())  # type: ignore

    print(f"\nSummary: Skipped {skipped_no_card_id} cards not found in card_id_map.")
    print(f"Summary: Skipped {skipped_already_in_salt} cards already present in salt table.")
    print(f"Summary: {len(deduped_rows)} unique rows to upsert.")
    if skipped_names:
        print("\nFull list of skipped card names (not found in card_id_map):")
        for n in skipped_names:  # type: ignore
            print(f"  - {n}")

    # Insert in batches
    batch_size = 500
    total_batches = (len(deduped_rows) + batch_size - 1) // batch_size
    for i in range(0, len(deduped_rows), batch_size):
        batch: List[Dict[str, Any]] = deduped_rows[i:i+batch_size]
        _ = supabase.table("salt").upsert(batch).execute()  # type: ignore
        # Update existing_salt_ids with card_ids from this batch
        for entry in batch:
            card_id = entry.get("card_id")
            if card_id:
                existing_salt_ids.add(card_id)
        print(f"Inserted batch {i//batch_size+1}/{total_batches}: {len(batch)} rows")

def clean_row(row: Dict[str, Any]) -> Dict[str, Any]:
    for k, v in row.items():
        if isinstance(v, str) and v.strip().lower() in {"undefined", "nan", ""}:
            row[k] = None
    return row

def main():
    combined_df = combine_salt_lists(YEARS)
    combined_df.to_csv("salt_list_combined.csv", index=False)
    print("Combined salt list saved as salt_list_combined.csv")
    # --- Upload to Supabase ---
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment to upload.")
        return
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    card_id_map, card_list = fetch_card_ids(supabase)
    upload_to_supabase(supabase, combined_df, card_id_map, card_list)
    print("Upload to Supabase complete.")

if __name__ == "__main__":
    main()