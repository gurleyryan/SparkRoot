import asyncio
import sys
import json
from datetime import datetime, date
from supabase_db import db
from dotenv import load_dotenv
from typing import Optional

load_dotenv("backend/.env")



def parse_date(val: Optional[str]) -> Optional[date]:
    if val is None:
        return None
    try:
        return datetime.strptime(val, "%Y-%m-%d").date()
    except Exception:
        return None

CARDS_JSON = "data/data/scryfall_all_cards.json"


async def main():
    await db.init_pool()
    from typing import List, Dict, Any

    from typing import cast
    with open(CARDS_JSON, "r", encoding="utf-8") as f:
        cards_data = json.load(f)
        if isinstance(cards_data, dict) and "data" in cards_data:
            cards = cast(List[Any], cards_data["data"])
        else:
            cards = cast(List[Any], cards_data)
        cards: List[Dict[str, Any]] = cards

    print(f"Loaded {len(cards)} cards from {CARDS_JSON}")

    # Fetch all existing card ids
    print("Fetching existing card ids from database...")
    existing_ids: set[str] = set()
    rows = await db.execute_query("SELECT id FROM cards", fetch=True)
    for row in rows:
        # Normalize to lowercase, strip whitespace
        existing_ids.add(str(row["id"]).strip().lower())
    print(f"Found {len(existing_ids)} existing cards in database.")
    # Print a few sample DB IDs
    print("Sample DB IDs:", list(existing_ids)[:5])

    insert_query = """
    INSERT INTO cards (
        id, arena_id, lang, mtgo_id, mtgo_foil_id, multiverse_ids, tcgplayer_id, tcgplayer_etched_id, cardmarket_id,
        object, layout, oracle_id, prints_search_uri, rulings_uri, scryfall_uri, uri, all_parts, card_faces, cmc,
        color_identity, color_indicator, colors, defense, edhrec_rank, game_changer, hand_modifier, keywords, legalities,
        life_modifier, loyalty, mana_cost, name, oracle_text, penny_rank, power, produced_mana, reserved, toughness,
        type_line, artist, artist_ids, attraction_lights, booster, border_color, card_back_id, collector_number,
        content_warning, digital, finishes, flavor_name, flavor_text, frame_effects, frame, full_art, games, highres_image,
        illustration_id, image_status, image_uris, oversized, prices, printed_name, printed_text, printed_type_line, promo,
        promo_types, purchase_uris, rarity, related_uris, released_at, reprint, scryfall_set_uri, set_name, set_search_uri,
        set_type, set_uri, "set", set_id, story_spotlight, textless, variation, variation_of, security_stamp, watermark, preview
    ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,
        $32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,
        $60,$61,$62,$63,$64,$65,$66,$67,$68,$69,$70,$71,$72,$73,$74,$75,$76,$77,$78,$79,$80,$81,$82,$83,$84,$85
    )
    ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, lang=EXCLUDED.lang, "set"=EXCLUDED."set", collector_number=EXCLUDED.collector_number, released_at=EXCLUDED.released_at
    """

    def to_str_list(val: Optional[Any]) -> Optional[list[str]]:
        if val is None:
            return None
        return [str(x) for x in val]

    # Print a few sample Scryfall IDs
    print("Sample Scryfall IDs:", [str(card.get("id")).strip().lower() for card in cards[:5]])
    # Prepare new cards to insert (normalize Scryfall IDs for comparison)
    new_cards = [card for card in cards if str(card.get("id")).strip().lower() not in existing_ids]

    print(f"{len(new_cards)} new cards to insert.")
    # Prompt user to continue

    try:
        # Use input() in a thread to avoid blocking the event loop
        proceed = await asyncio.get_event_loop().run_in_executor(None, lambda: input("Continue with loading? (y/n): "))
        if proceed.strip().lower() not in ("y", "yes"):
            print("Aborted by user.")
            await db.close_pool()
            sys.exit(0)
    except (KeyboardInterrupt, EOFError):
        print("Aborted by user.")
        await db.close_pool()
        sys.exit(0)

    BATCH_SIZE = 200
    total = len(new_cards)
    for i in range(0, total, BATCH_SIZE):
        batch = new_cards[i:i+BATCH_SIZE]
        values_list: list[list[Any]] = []
        for card in batch:
            values: list[Any] = [
                card.get("id"),
                card.get("arena_id"),
                card.get("lang"),
                card.get("mtgo_id"),
                card.get("mtgo_foil_id"),
                card.get("multiverse_ids"),
                card.get("tcgplayer_id"),
                card.get("tcgplayer_etched_id"),
                card.get("cardmarket_id"),
                card.get("object"),
                card.get("layout"),
                card.get("oracle_id"),
                card.get("prints_search_uri"),
                card.get("rulings_uri"),
                card.get("scryfall_uri"),
                card.get("uri"),
                json.dumps(card.get("all_parts")) if card.get("all_parts") else None,
                json.dumps(card.get("card_faces")) if card.get("card_faces") else None,
                card.get("cmc"),
                to_str_list(card.get("color_identity")),
                to_str_list(card.get("color_indicator")),
                to_str_list(card.get("colors")),
                card.get("defense"),
                card.get("edhrec_rank"),
                card.get("game_changer"),
                card.get("hand_modifier"),
                to_str_list(card.get("keywords")),
                json.dumps(card.get("legalities")) if card.get("legalities") else None,
                card.get("life_modifier"),
                card.get("loyalty"),
                card.get("mana_cost"),
                card.get("name"),
                card.get("oracle_text"),
                card.get("penny_rank"),
                card.get("power"),
                to_str_list(card.get("produced_mana")),
                card.get("reserved"),
                card.get("toughness"),
                card.get("type_line"),
                card.get("artist"),
                card.get("artist_ids"),
                to_str_list(card.get("attraction_lights")),
                card.get("booster"),
                card.get("border_color"),
                card.get("card_back_id"),
                card.get("collector_number"),
                card.get("content_warning"),
                card.get("digital"),
                to_str_list(card.get("finishes")),
                card.get("flavor_name"),
                card.get("flavor_text"),
                to_str_list(card.get("frame_effects")),
                card.get("frame"),
                card.get("full_art"),
                to_str_list(card.get("games")),
                card.get("highres_image"),
                card.get("illustration_id"),
                card.get("image_status"),
                json.dumps(card.get("image_uris")) if card.get("image_uris") else None,
                card.get("oversized"),
                json.dumps(card.get("prices")) if card.get("prices") else None,
                card.get("printed_name"),
                card.get("printed_text"),
                card.get("printed_type_line"),
                card.get("promo"),
                to_str_list(card.get("promo_types")),
                json.dumps(card.get("purchase_uris")) if card.get("purchase_uris") else None,
                card.get("rarity"),
                json.dumps(card.get("related_uris")) if card.get("related_uris") else None,
                parse_date(card.get("released_at")),
                card.get("reprint"),
                card.get("scryfall_set_uri"),
                card.get("set_name"),
                card.get("set_search_uri"),
                card.get("set_type"),
                card.get("set_uri"),
                card.get("set"),
                card.get("set_id"),
                card.get("story_spotlight"),
                card.get("textless"),
                card.get("variation"),
                card.get("variation_of"),
                card.get("security_stamp"),
                card.get("watermark"),
                json.dumps(card.get("preview")) if card.get("preview") else None
            ]
            values_list.append(values)
        # Insert batch
        for values in values_list:
            try:
                await db.execute_query(insert_query, tuple(values))
            except Exception as e:
                print(f"Error inserting card {values[0]}: {e}")
        print(f"Inserted {min(i+BATCH_SIZE, total)}/{total} cards...")
        await asyncio.sleep(0.5)  # Small delay to avoid overwhelming the DB
    await db.close_pool()
    print("All new cards loaded.")

if __name__ == "__main__":
    asyncio.run(main())