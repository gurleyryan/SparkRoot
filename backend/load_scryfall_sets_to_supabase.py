from dotenv import load_dotenv
load_dotenv("backend/.env")

import json
import asyncio
from datetime import datetime
from backend.supabase_db import db
def parse_date(val):
    if val is None:
        return None
    try:
        return datetime.strptime(val, "%Y-%m-%d").date()
    except Exception:
        return None

SETS_JSON = "data/data/scryfall_sets.json"

async def main():
    await db.init_pool()
    with open(SETS_JSON, "r", encoding="utf-8") as f:
        sets = json.load(f)
    # If the file is a dict with "data" key, use that
    if isinstance(sets, dict) and "data" in sets:
        sets = sets["data"]

    print(f"Loaded {len(sets)} sets from {SETS_JSON}")

    insert_query = """
    INSERT INTO sets (
        id, object, code, mtgo_code, arena_code, tcgplayer_id, name, set_type, released_at, block_code, block,
        parent_set_code, card_count, printed_size, digital, foil_only, nonfoil_only, scryfall_uri, uri, icon_svg_uri, search_uri
    ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
    )
    ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, code=EXCLUDED.code, set_type=EXCLUDED.set_type, released_at=EXCLUDED.released_at
    """

    for s in sets:
        values = [
            s.get("id"),
            s.get("object"),
            s.get("code"),
            s.get("mtgo_code"),
            s.get("arena_code"),
            s.get("tcgplayer_id"),
            s.get("name"),
            s.get("set_type"),
            parse_date(s.get("released_at")),
            s.get("block_code"),
            s.get("block"),
            s.get("parent_set_code"),
            s.get("card_count"),
            s.get("printed_size"),
            s.get("digital"),
            s.get("foil_only"),
            s.get("nonfoil_only"),
            s.get("scryfall_uri"),
            s.get("uri"),
            s.get("icon_svg_uri"),
            s.get("search_uri")
        ]
        await db.execute_query(insert_query, tuple(values))
    await db.close_pool()
    print("All sets loaded.")

if __name__ == "__main__":
    asyncio.run(main())