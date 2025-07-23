import json
import asyncio
from datetime import datetime
from backend.supabase_db import db
from typing import Any, List, Dict, Optional, cast
from dotenv import load_dotenv
load_dotenv("backend/.env")

def parse_date(val: Optional[str]):
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
        raw_sets = json.load(f)
    # If the file is a dict with "data" key, use that
    if isinstance(raw_sets, dict) and "data" in raw_sets:
        sets = cast(List[Any], raw_sets["data"])
    else:
        sets = cast(List[Any], raw_sets)
    # Ensure sets is a list of dicts
    # Type is already Dict[str, Any], no need to cast
    # sets = [cast(Dict[str, Any], s) for s in sets]
    sets: List[Dict[str, Any]] = sets

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
        s: Dict[str, Any] = dict(s)
        values: List[Any] = [
            cast(Optional[str], s.get("id")) or "",
            cast(Optional[str], s.get("object")) or "",
            cast(Optional[str], s.get("code")) or "",
            cast(Optional[str], s.get("mtgo_code")),
            cast(Optional[str], s.get("arena_code")),
            cast(Optional[int], s.get("tcgplayer_id")),
            cast(Optional[str], s.get("name")) or "",
            cast(Optional[str], s.get("set_type")) or "",
            parse_date(cast(Optional[str], s.get("released_at"))),
            cast(Optional[str], s.get("block_code")),
            cast(Optional[str], s.get("block")),
            cast(Optional[str], s.get("parent_set_code")),
            cast(Optional[int], s.get("card_count")) or 0,
            cast(Optional[int], s.get("printed_size")),
            bool(s.get("digital")),
            bool(s.get("foil_only")),
            bool(s.get("nonfoil_only")),
            cast(Optional[str], s.get("scryfall_uri")) or "",
            cast(Optional[str], s.get("uri")) or "",
            cast(Optional[str], s.get("icon_svg_uri")) or "",
            cast(Optional[str], s.get("search_uri")) or ""
        ]
        await db.execute_query(insert_query, tuple(values))
    await db.close_pool()
    print("All sets loaded.")

if __name__ == "__main__":
    asyncio.run(main())