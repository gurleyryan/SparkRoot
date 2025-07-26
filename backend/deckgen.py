from typing import Dict, Any, List, Set, Optional
import os

def fetch_salt_list_from_supabase(card_pool: List[Dict[str, Any]]) -> Dict[str, List[int]]:
    """
    Fetches the salt list from Supabase and returns a dict mapping card name to years_included.
    Only includes cards present in the user's card pool for efficiency.
    """
    try:
        from supabase import create_client
    except ImportError:
        print("supabase-py is not installed. Salt filtering will be skipped.")
        return {}
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment to fetch salt list.")
        return {}
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    salt_map: Dict[str, List[int]] = {}
    page = 0
    page_size = 1000
    # Build set of card ids in pool for efficient mapping
    pool_ids: Set[str] = set()
    name_by_id: Dict[str, str] = {}
    for card in card_pool:
        cid = str(card.get("id"))
        pool_ids.add(cid)
        name_by_id[cid] = card.get("name", "")
    while True:
        resp = supabase.table("salt").select("card_id,years_included").range(page * page_size, (page + 1) * page_size - 1).execute()
        data = resp.data
        if not data:
            break
        for row in data:
            cid = str(row["card_id"])
            if cid in pool_ids:
                name: str = name_by_id.get(cid, "")
                if name:
                    salt_map[name] = row.get("years_included", [])
        if len(data) < page_size:
            break
        page += 1
    return salt_map

def find_valid_commanders(card_pool: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Returns a list of cards from the card pool that are legal commanders:
    - Legendary creatures
    - Or planeswalkers with 'can be your commander' in oracle text
    """
    valid_commanders: List[Dict[str, Any]] = []
    for card in card_pool:
        type_line = str(card.get("type_line", "")).lower()
        oracle = str(card.get("oracle_text", "")).lower()
        if "legendary creature" in type_line:
            valid_commanders.append(card)
        elif "planeswalker" in type_line and "can be your commander" in oracle:
            valid_commanders.append(card)
    return valid_commanders

# CATEGORY_TARGETS defines the minimum and maximum number of cards for each functional category in a Commander deck.
# These targets are based on best practices and the deck-building guide, and are used to enforce deck balance.
CATEGORY_TARGETS = {
    "lands": (33, 38),        # Land count range
    "ramp": (5, 10),         # Mana acceleration
    "draw": (5, 9),          # Card draw/advantage
    "removal": (6, 9),       # Targeted removal
    "sweeper": (2, 4),       # Board wipes
    "graveyard_hate": (1, 3),# Graveyard interaction
    "recursion": (1, 3),     # Card recursion
    "pillowfort": (1, 3),    # Defensive/protection
    "wincon": (1, 3),        # Win conditions
    "tutor": (0, 2),         # Tutors/search
    "creature": (20, 40),    # Creature count
    "main_theme": (0, 99),   # Main deck theme (tribal, etc.)
}

# LAND_TYPE_PRIORITY defines the preferred order for selecting lands to ensure color fixing and deck consistency.
LAND_TYPE_PRIORITY = [
    "command_tower", "rainbow", "dual", "fetch", "triland", "utility", "basic"
]

def detect_theme(commander: Dict[str, Any], card_pool: List[Dict[str, Any]]) -> str:
    """
    Detects the main deck theme based on the commander's type line and keywords.
    - If the commander is tribal or a creature, tries to infer the most common creature type in the pool.
    - Otherwise, uses the first keyword or ability word as the theme.
    - Returns 'generic' if no theme is detected.
    """
    type_line = commander.get("type_line", "").lower()
    if "tribal" in type_line or "creature" in type_line:
        # Find most common creature type in the card pool
        from collections import Counter
        types: List[str] = []
        for card in card_pool:
            if "creature" in (card.get("type_line", "").lower()):
                for t in (card.get("type_line", "").replace("Legendary Creature", "").replace("Creature", "").split("—")[-1].split()):
                    types.append(t.strip())
        if types:
            most_common = Counter(types).most_common(1)[0][0]
            return most_common
    # Otherwise, use first keyword or ability word
    keywords = commander.get("keywords", [])
    if keywords:
        return str(keywords[0]).lower()
    return "generic"

def commander_functions(commander: Dict[str, Any]) -> Set[str]:
    """
    Detects which deck functions the commander provides (e.g., draw, removal, ramp, wincon).
    This is used to avoid overfilling categories already covered by the commander.
    """
    provided: Set[str] = set()
    keywords = [str(k).lower() for k in list(commander.get("keywords") or [])]
    type_line = str(commander.get("type_line") or "").lower()
    oracle = str(commander.get("oracle_text") or "").lower()
    # Check for each function in keywords, type_line, or oracle text
    if any(k in keywords+ [type_line, oracle] for k in ["draw", "card draw", "loot"]):
        provided.add("draw")
    if any(k in keywords+ [type_line, oracle] for k in ["destroy", "exile", "removal", "kill"]):
        provided.add("removal")
    if any(k in keywords+ [type_line, oracle] for k in ["ramp", "mana", "land"]):
        provided.add("ramp")
    if any(k in keywords+ [type_line, oracle] for k in ["wincon", "win", "combo"]):
        provided.add("wincon")
    if any(k in keywords+ [type_line, oracle] for k in ["recursion", "return", "graveyard"]):
        provided.add("recursion")
    if any(k in keywords+ [type_line, oracle] for k in ["sweeper", "boardwipe"]):
        provided.add("sweeper")
    if any(k in keywords+ [type_line, oracle] for k in ["pillowfort", "protection", "hexproof"]):
        provided.add("pillowfort")
    return provided

def analyze_mana_curve(deck: List[Dict[str, Any]]) -> Dict[int, int]:
    """
    Analyzes the mana curve of the deck.
    Returns a dictionary mapping converted mana cost (cmc) to the count of cards at that cost.
    """
    from collections import Counter
    cmcs = [int(card.get("cmc", 0)) for card in deck if "cmc" in card]
    return dict(Counter(cmcs))

def select_lands(commander: Dict[str, Any], pool: List[Dict[str, Any]], num_lands: int) -> List[Dict[str, Any]]:
    """
    Selects the optimal mix of lands for the deck based on the commander's color identity and the deck-building guide.
    Prioritizes color fixing and utility lands, and ensures the correct number of lands are chosen.
    """
    colors = set(commander.get("color_identity", []))
    color_count = len(colors)
    # Always include Command Tower for 2+ color
    lands: List[Dict[str, Any]] = []
    def is_type(card: Dict[str, Any], t: str) -> bool:
        return t in str(card.get("type_line", "").lower())
    # Utility lands
    utility = [c for c in pool if is_type(c, "utility") or "utility" in c.get("keywords", [])]
    basics = [c for c in pool if is_type(c, "basic land")]
    duals = [c for c in pool if "dual" in c.get("keywords", []) or ("land" in c.get("type_line", "") and len(set(c.get("color_identity", []))) == 2)]
    fetches = [c for c in pool if "fetch" in c.get("keywords", [])]
    rainbow = [c for c in pool if "rainbow" in c.get("keywords", []) or ("land" in c.get("type_line", "") and len(set(c.get("color_identity", []))) > 2)]
    command_tower = [c for c in pool if c.get("name", "").lower() == "command tower"]
    trilands = [c for c in pool if "triland" in c.get("keywords", []) or ("land" in c.get("type_line", "") and len(set(c.get("color_identity", []))) == 3)]
    # Land mix by color count
    if color_count == 1:
        lands += utility[:10]
        lands += basics[:num_lands - len(lands)]
    elif color_count == 2:
        lands += command_tower[:1]
        lands += utility[:5]
        lands += duals[:5]
        lands += fetches[:5]
        lands += basics[:num_lands - len(lands)]
    elif color_count == 3:
        lands += command_tower[:1]
        lands += utility[:2]
        lands += duals[:5]
        lands += fetches[:5]
        lands += trilands[:5]
        lands += rainbow[:5]
        lands += basics[:num_lands - len(lands)]
    elif color_count == 4:
        lands += command_tower[:1]
        lands += utility[:1]
        lands += fetches[:10]
        lands += rainbow[:10]
        lands += basics[:num_lands - len(lands)]
    elif color_count == 5:
        lands += command_tower[:1]
        lands += utility[:1]
        lands += fetches[:10]
        lands += rainbow[:10]
        lands += basics[:num_lands - len(lands)]
    # Remove duplicates, keep order
    seen: Set[str] = set()
    final_lands: List[Dict[str, Any]] = []
    for c in lands:
        n = c.get("name", "")
        if n not in seen and len(final_lands) < num_lands:
            final_lands.append(c)
            seen.add(n)
    return final_lands[:num_lands]


def filter_card_pool(
    cards: List[Dict[str, Any]],
    commander: Dict[str, Any],
    bracket: int,
    house_rules: bool,
    salt_list: Dict[str, Any],
    salt_weight_threshold: float = 0.0,
) -> List[Dict[str, Any]]:
    """
    Filters the card pool to only include cards that:
    - Match the commander's color identity
    - Are legal in Commander and the selected bracket
    - Pass house rules and salt filtering
    Returns a list of eligible cards for deck construction.
    """
    commander_colors = set(commander.get("color_identity", []))
    filtered: List[Dict[str, Any]] = []
    for card in cards:
        # Color identity: skip cards with colors outside the commander's identity
        if not set(card.get("color_identity", [])).issubset(commander_colors):
            continue
        # Legalities: skip cards not legal in Commander
        if card.get("legalities", {}).get("commander") != "legal":
            continue
        # Bracket/game changer: enforce bracket rules for Game Changers
        if bracket in [1, 2] and card.get("game_changer", False):
            continue
        if bracket == 3 and card.get("game_changer", False):
            # We'll enforce max 3 later in deck filling
            pass
        # House rules: ban certain cards or types
        if house_rules:
            name = card.get("name", "").lower()
            if name == "sol ring":
                continue
            # Example: ban nonland tutors (very basic, can be improved)
            if "tutor" in name and "land" not in name:
                continue
            # Example: ban "unfun" cards (define your own list)
            if name in {"armageddon", "winter orb", "stasis"}:
                continue
        # Salt filtering: skip cards with too high salt weight
        from typing import cast, Dict
        salt_info = cast(Dict[str, float], salt_list.get(card.get("name", ""), {}))
        # salt_info should be a dict: {year: salt_score, ...}
        salt_weight = 0.0
        # Recency weights: latest year = 1.0, previous = 0.9, etc. (0.1 per year, min 0.1)
        years: list[str] = sorted([str(y) for y in salt_info.keys()], reverse=True)
        if years:
            latest_year = max(int(y) for y in years if y.isdigit())
            for y in years:
                try:
                    year = int(y)
                    salt_score = float(salt_info[y])
                    recency_weight = max(0.1, 1.0 - 0.1 * (latest_year - year))
                    salt_weight += salt_score * recency_weight
                except Exception:
                    continue
        card["salt_weight"] = salt_weight
        if salt_weight_threshold > 0 and salt_weight > salt_weight_threshold:
            continue
        filtered.append(card)
    return filtered


def categorize_card(card: Dict[str, Any]) -> Set[str]:
    """
    Categorizes a card into one or more functional deck categories (e.g., ramp, draw, removal).
    Uses keywords and type line to determine the card's role(s) in the deck.
    Returns a set of category strings.
    """
    categories: Set[str] = set()
    keywords: List[str] = [str(k).lower() for k in list(card.get("keywords") or [])]
    type_line: str = str(card.get("type_line") or "").lower()
    # Ramp: mana acceleration or ramp keywords
    if "ramp" in keywords or "mana" in keywords or "mana" in type_line:
        categories.add("ramp")
    # Draw: card draw/advantage
    if "draw" in keywords:
        categories.add("draw")
    # Removal: destroy, exile, bounce, counter
    if any(k in keywords for k in ["destroy", "exile", "bounce", "counter"]):
        categories.add("removal")
    # Boardwipe: mass removal
    if "boardwipe" in keywords or "sweeper" in keywords:
        categories.add("boardwipe")
    # Graveyard hate
    if "graveyard" in keywords:
        categories.add("graveyard_hate")
    # Recursion
    if "recursion" in keywords:
        categories.add("recursion")
    # Pillowfort: protection/hexproof
    if any(k in keywords for k in ["hexproof", "shroud", "protection"]):
        categories.add("pillowfort")
    # Wincon: win condition
    if "wincon" in keywords:
        categories.add("wincon")
    # Lands
    if "land" in type_line:
        categories.add("lands")
    # Creature
    if "creature" in type_line:
        categories.add("creature")
    return categories


def generate_commander_deck(
    commander: Dict[str, Any],
    card_pool: List[Dict[str, Any]],
    bracket: int = 2,
    house_rules: bool = False,
    salt_list: Optional[Dict[str, List[int]]] = None,
    salt_threshold: int = 0,
) -> Dict[str, Any]:
    """
    Main function to generate a Commander deck from a user's collection and chosen commander.
    Steps:
    1. Filter the card pool for color identity, legality, bracket, house rules, and salt.
    2. Detect the deck's main theme based on the commander and pool.
    3. Categorize all eligible cards by function (ramp, draw, removal, etc).
    4. Start the deck with the chosen commander.
    5. Use commander_functions to avoid overfilling categories already covered by the commander.
    6. Fill each category to its min/max, prioritizing synergy and EDHREC rank.
    7. Fill the main theme if not already filled.
    8. Add lands using advanced land selection logic.
    9. Fill to 100 cards, preferring cards that balance the mana curve.
    Returns a dictionary with the commander, deck, deck size, and bracket info.
    """
    # 1. Filter pool for color identity, legalities, and salt
    if salt_list is None:
        salt_list = fetch_salt_list_from_supabase(card_pool)
    filtered_pool = filter_card_pool(
        card_pool, commander, bracket, house_rules, salt_list, salt_threshold
    )

    # 2. Detect theme
    theme = detect_theme(commander, filtered_pool)

    # 3. Categorize pool
    categorized: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in CATEGORY_TARGETS}
    for card in filtered_pool:
        cats = categorize_card(card)
        for cat in cats:
            if cat in categorized:
                categorized[cat].append(card)

    # 4. Start with commander(s)
    deck = [commander]
    used_names = set([commander["name"]])

    # 5. Commander functions (synergy)
    commander_synergy = commander_functions(commander)

    # 6. Add cards by category min/max, prioritizing by edhrec_rank and synergy
    for cat, (min_count, max_count) in CATEGORY_TARGETS.items():
        if cat == "lands":
            continue  # Add lands last
        pool = sorted(categorized.get(cat, []), key=lambda c: (
            0 if cat in commander_synergy else 1,  # Prefer synergy
            c.get("edhrec_rank", 999999)
        ))
        count = 0
        for card in pool:
            if card["name"] not in used_names and count < max_count:
                deck.append(card)
                used_names.add(card["name"])
                count += 1
            if count >= min_count:
                break

    # 7. Fill main theme (if not already filled)
    if "main_theme" in CATEGORY_TARGETS:
        theme_pool = [c for c in filtered_pool if theme in (c.get("type_line", "").lower() + " " + " ".join([str(k).lower() for k in c.get("keywords", [])]))]
        theme_pool = sorted(theme_pool, key=lambda c: c.get("edhrec_rank", 999999))
        for card in theme_pool:
            if card["name"] not in used_names and len(deck) < 100:
                deck.append(card)
                used_names.add(card["name"])

    # 8. Add lands using advanced land logic
    num_lands = max(min(38, 100 - len(deck)), 33)
    land_pool = categorized.get("lands", [])
    lands = select_lands(commander, land_pool, num_lands)
    for land in lands:
        if land["name"] not in used_names and len(deck) < 100:
            deck.append(land)
            used_names.add(land["name"])

    # 9. Fill to 100 with best remaining cards (by edhrec_rank, prefer curve balance)
    while len(deck) < 100:
        remaining = [c for c in filtered_pool if c["name"] not in used_names]
        if not remaining:
            break
        # Prefer cards that help mana curve (2-3 cmc)
        next_card = sorted(remaining, key=lambda c: (abs(int(c.get("cmc", 3)) - 3), c.get("edhrec_rank", 999999)))[0]
        deck.append(next_card)
        used_names.add(next_card["name"])

    return {
        "commander": commander,
        "deck": deck[:99],
        "deck_size": len(deck[:99]),
        "total_cards": len(deck[:99]) + 1,
        "bracket": bracket,
    }
    """
    Fetches the salt list from Supabase and returns a dict mapping card_id to salt info.
    """
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment to fetch salt list.")
        return {}
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    salt_map = {}
    page = 0
    page_size = 1000
    while True:
        resp = supabase.table("salt").select("card_id,Salt,years_included").range(page * page_size, (page + 1) * page_size - 1).execute()
        data = resp.data
        if not data:
            break
        for row in data:
            salt_map[row["card_id"]] = {
                "Salt": row.get("Salt"),
                "years_included": row.get("years_included", [])
            }
        if len(data) < page_size:
            break
        page += 1
    return salt_map