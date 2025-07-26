from typing import Dict, Any, List, Set, Optional, cast
from collections import Counter
import os

def fetch_salt_list_from_supabase(card_pool: List[Dict[str, Any]]) -> Dict[str, List[int]]:
    print(f"[DEBUG] fetch_salt_list_from_supabase called with card_pool size: {len(card_pool)}")
    """
    Fetches the salt list from Supabase and returns a dict mapping card name to years_included.
    Only includes cards present in the user's card pool for efficiency.
    """
    try:
        from supabase import create_client
    except ImportError:
        print("[DEBUG] supabase-py is not installed. Salt filtering will be skipped.")
        return {}
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("[DEBUG] Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment to fetch salt list.")
        return {}
    print("[DEBUG] Connecting to Supabase for salt list fetch...")
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
    print(f"[DEBUG] Pool ids for salt mapping: {len(pool_ids)}")
    while True:
        print(f"[DEBUG] Fetching salt page {page}...")
        resp = supabase.table("salt").select("card_id,years_included").range(page * page_size, (page + 1) * page_size - 1).execute()
        data = resp.data
        if not data:
            print(f"[DEBUG] No more salt data at page {page}.")
            break
        for row in data:
            cid = str(row["card_id"])
            if cid in pool_ids:
                name: str = name_by_id.get(cid, "")
                if name:
                    salt_map[name] = row.get("years_included", [])
                    print(f"[DEBUG]   Mapped salt for {name} (id={cid}): {row.get('years_included', [])}")
        if len(data) < page_size:
            print(f"[DEBUG] Last salt page fetched: {page}")
            break
        page += 1
    print(f"[DEBUG] Finished salt mapping. Total mapped: {len(salt_map)}")
    return salt_map

def find_valid_commanders(card_pool: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    print(f"[DEBUG] find_valid_commanders called with card_pool size: {len(card_pool)}")
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
            print(f"[DEBUG]   Found valid legendary creature commander: {card.get('name')}")
        elif "planeswalker" in type_line and "can be your commander" in oracle:
            valid_commanders.append(card)
            print(f"[DEBUG]   Found valid planeswalker commander: {card.get('name')}")
    print(f"[DEBUG] Total valid commanders found: {len(valid_commanders)}")
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

# CARD_TYPE_TARGETS defines the ideal number of each card type in a 100-card deck (percentages rounded to nearest card)
CARD_TYPE_TARGETS = {
    "land": 36,         # 36%
    "creature": 29,     # 29%
    "instant": 10,      # 10%
    "sorcery": 8,       # 8%
    "enchantment": 6,   # 6%
    "artifact": 6,      # 6%
    "planeswalker": 4,  # 4%
}

# LAND_TYPE_PRIORITY defines the preferred order for selecting lands to ensure color fixing and deck consistency.
LAND_TYPE_PRIORITY = [
    "command_tower", "rainbow", "dual", "fetch", "triland", "utility", "basic"
]

def detect_theme(commander: Dict[str, Any], card_pool: List[Dict[str, Any]]) -> str:
    print(f"[DEBUG] detect_theme called for commander: {commander.get('name')} | pool size: {len(card_pool)}")
    """
    Detects the main deck theme based on the commander's type line and keywords.
    - If the commander is tribal or a creature, tries to infer the most common creature type in the pool.
    - Otherwise, uses the first keyword or ability word as the theme.
    - Returns 'generic' if no theme is detected.
    """
    type_line = commander.get("type_line", "").lower()
    print(f"[DEBUG] detect_theme: commander type_line='{type_line}', keywords={commander.get('keywords', [])}")


    # Dynamically extract all unique keywords from commander's keywords and oracle_text
    commander_keywords = set(str(k).lower() for k in commander.get("keywords", []))
    oracle = str(commander.get("oracle_text", "")).lower()
    # Extract single-word and two-word phrases from oracle text for possible theme candidates
    import re
    oracle_words: Set[str] = set(re.findall(r"\b[a-zA-Z][a-zA-Z\-']*\b", oracle))
    oracle_phrases: Set[str] = set()
    oracle_tokens = oracle.split()
    for i in range(len(oracle_tokens) - 1):
        phrase = f"{oracle_tokens[i]} {oracle_tokens[i+1]}".lower()
        oracle_phrases.add(phrase)
    # Combine all possible theme candidates, ensure all are str
    theme_candidates: Set[str] = set()
    theme_candidates.update(str(k) for k in commander_keywords)
    theme_candidates.update(str(w) for w in oracle_words)
    theme_candidates.update(str(p) for p in oracle_phrases)

    # 1. Try to match the commander's main type (e.g., Sphinx, Human, etc.)
    main_type = None
    if "creature" in type_line:
        # Extract the main creature type (last word after em dash)
        parts = type_line.split("—")
        if len(parts) > 1:
            type_words = parts[-1].strip().split()
            if type_words:
                main_type = type_words[0]
                print(f"[DEBUG] detect_theme: main_type from type_line is '{main_type}'")
    # 2. If main_type found, check if it's common in the pool
    if main_type:
        count = sum(1 for card in card_pool if main_type in card.get("type_line", "").lower())
        if count > 2:
            print(f"[DEBUG] detect_theme: using main_type '{main_type}' as theme (count in pool: {count})")
            return main_type

    # 3. Check for any theme candidate in commander's keywords or oracle text
    for candidate in theme_candidates:
        if not candidate or len(candidate) < 3:
            continue
        # Check if candidate is present in any card's type_line or keywords
        for card in card_pool:
            if candidate in card.get("type_line", "").lower() or candidate in " ".join([str(k).lower() for k in card.get("keywords", [])]):
                print(f"[DEBUG] detect_theme: using commander keyword/oracle '{candidate}' as theme")
                return candidate

    # 4. Otherwise, use most common creature type or keyword in pool
    types: List[str] = []
    pool_keywords: List[str] = []
    for card in card_pool:
        if "creature" in (card.get("type_line", "").lower()):
            for t in (card.get("type_line", "").replace("Legendary Creature", "").replace("Creature", "").split("—")[-1].split()):
                types.append(t.strip())
        # Collect all keywords from pool
        pool_keywords.extend([str(k).lower() for k in card.get("keywords", [])])
    if types:
        most_common = Counter(types).most_common(1)[0][0]
        print(f"[DEBUG] detect_theme: most common creature type is '{most_common}'")
        return most_common
    if pool_keywords:
        most_common_kw = Counter(pool_keywords).most_common(1)[0][0]
        print(f"[DEBUG] detect_theme: most common keyword in pool is '{most_common_kw}'")
        return most_common_kw

    print("[DEBUG] detect_theme: no theme detected, using 'generic'")
    return "generic"

def commander_functions(commander: Dict[str, Any]) -> Set[str]:
    print(f"[DEBUG] commander_functions called for commander: {commander.get('name')}")
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
        print("[DEBUG] commander_functions: provides 'draw'")
    if any(k in keywords+ [type_line, oracle] for k in ["destroy", "exile", "removal", "kill"]):
        provided.add("removal")
        print("[DEBUG] commander_functions: provides 'removal'")
    if any(k in keywords+ [type_line, oracle] for k in ["ramp", "mana", "land"]):
        provided.add("ramp")
        print("[DEBUG] commander_functions: provides 'ramp'")
    if any(k in keywords+ [type_line, oracle] for k in ["wincon", "win", "combo"]):
        provided.add("wincon")
        print("[DEBUG] commander_functions: provides 'wincon'")
    if any(k in keywords+ [type_line, oracle] for k in ["recursion", "return", "graveyard"]):
        provided.add("recursion")
        print("[DEBUG] commander_functions: provides 'recursion'")
    if any(k in keywords+ [type_line, oracle] for k in ["sweeper", "boardwipe"]):
        provided.add("sweeper")
        print("[DEBUG] commander_functions: provides 'sweeper'")
    if any(k in keywords+ [type_line, oracle] for k in ["pillowfort", "protection", "hexproof"]):
        provided.add("pillowfort")
        print("[DEBUG] commander_functions: provides 'pillowfort'")
    print(f"[DEBUG] commander_functions: provided set = {provided}")
    return provided

def analyze_mana_curve(deck: List[Dict[str, Any]]) -> Dict[int, int]:
    """
    Analyzes the mana curve of the deck.
    Returns a dictionary mapping converted mana cost (cmc) to the count of cards at that cost.
    """
    cmcs = [int(card.get("cmc", 0)) for card in deck if "cmc" in card]
    return dict(Counter(cmcs))

def select_lands(commander: Dict[str, Any], pool: List[Dict[str, Any]], num_lands: int) -> List[Dict[str, Any]]:
    print(f"[DEBUG] select_lands called for commander: {commander.get('name')} | colors: {commander.get('color_identity', [])} | num_lands: {num_lands}")
    """
    Selects the optimal mix of lands for the deck based on the commander's color identity and the deck-building guide.
    Prioritizes color fixing and utility lands, and ensures the correct number of lands are chosen.
    """
    colors = set(commander.get("color_identity", []))
    color_count = len(colors)
    lands: List[Dict[str, Any]] = []
    def is_type(card: Dict[str, Any], t: str) -> bool:
        return t in str(card.get("type_line", "").lower())
    # Use categories assigned by categorize_card

    def has_cat(card: Dict[str, Any], cat: str) -> bool:
        # Helper to check if a card has a category in its 'categories' set
        return cat in card.get('categories', set())

    # Assign categories to all cards in pool if not already present
    for c in pool:
        if 'categories' not in c:
            c['categories'] = categorize_card(c)

    utility = [c for c in pool if has_cat(c, "utility")]
    basics = [c for c in pool if is_type(c, "basic land")]
    duals = [c for c in pool if has_cat(c, "dual")]
    fetches = [c for c in pool if has_cat(c, "fetch")]
    rainbow = [c for c in pool if has_cat(c, "rainbow")]
    command_tower = [c for c in pool if has_cat(c, "command_tower")]
    trilands = [c for c in pool if has_cat(c, "triland")]
    print(f"[DEBUG] select_lands: utility={len(utility)}, basics={len(basics)}, duals={len(duals)}, fetches={len(fetches)}, rainbow={len(rainbow)}, command_tower={len(command_tower)}, trilands={len(trilands)}")

    # Add non-basic lands first, no duplicates
    if color_count == 1:
        lands += utility[:10]
        print(f"[DEBUG] select_lands: color_count=1, added {len(utility[:10])} utility lands")
    elif color_count == 2:
        lands += command_tower[:1]
        lands += utility[:5]
        lands += duals[:5]
        lands += fetches[:5]
        print(f"[DEBUG] select_lands: color_count=2, added command_tower, utility, duals, fetches")
    elif color_count == 3:
        lands += command_tower[:1]
        lands += utility[:2]
        lands += duals[:5]
        lands += fetches[:5]
        lands += trilands[:5]
        lands += rainbow[:5]
        print(f"[DEBUG] select_lands: color_count=3, added command_tower, utility, duals, fetches, trilands, rainbow")
    elif color_count == 4:
        lands += command_tower[:1]
        lands += utility[:1]
        lands += fetches[:10]
        lands += rainbow[:10]
        print(f"[DEBUG] select_lands: color_count=4, added command_tower, utility, fetches, rainbow")
    elif color_count == 5:
        lands += command_tower[:1]
        lands += utility[:1]
        lands += fetches[:10]
        lands += rainbow[:10]
        print(f"[DEBUG] select_lands: color_count=5, added command_tower, utility, fetches, rainbow")

    # Remove duplicates by unique id, keep order
    seen_ids: Set[str] = set()
    final_lands: List[Dict[str, Any]] = []
    for c in lands:
        cid = str(c.get("id"))
        if cid not in seen_ids and len(final_lands) < num_lands:
            final_lands.append(c)
            seen_ids.add(cid)
            print(f"[DEBUG] select_lands: added nonbasic land {c.get('name')} (id={cid})")

    # Fill remaining slots with basic lands, respecting all unique printings and their quantities
    print(f"[DEBUG] select_lands: filling with basics, need {num_lands - len(final_lands)} more lands")
    basics_by_color: Dict[str, List[Dict[str, Any]]] = {"W": [], "U": [], "B": [], "R": [], "G": []}
    basics_quantities: Dict[str, int] = {}
    basics_by_id: Dict[str, Dict[str, Any]] = {}
    for c in basics:
        name = c.get("name", "").lower()
        cid = str(c.get("id"))
        qty = int(c.get("quantity", 1))
        basics_quantities[cid] = qty
        basics_by_id[cid] = c
        if "plains" in name:
            basics_by_color["W"].append(c)
        elif "island" in name:
            basics_by_color["U"].append(c)
        elif "swamp" in name:
            basics_by_color["B"].append(c)
        elif "mountain" in name:
            basics_by_color["R"].append(c)
        elif "forest" in name:
            basics_by_color["G"].append(c)
        print(f"[DEBUG] select_lands: found basic {name} (id={cid}, qty={qty})")

    num_needed = num_lands - len(final_lands)
    basics_used: Dict[str, int] = {cid: 0 for cid in basics_quantities}
    if num_needed > 0:
        color_list = list(colors) if colors else ["C"]
        added = 0
        color_idx = 0
        while added < num_needed:
            color = color_list[color_idx % len(color_list)]
            color_idx += 1
            # Try to add a basic of this color with available quantity, all printings
            found = False
            for c in basics_by_color.get(color, []):
                cid = str(c.get("id"))
                if basics_used[cid] < basics_quantities[cid]:
                    final_lands.append(dict(c))
                    basics_used[cid] += 1
                    added += 1
                    found = True
                    print(f"[DEBUG] select_lands: added {c.get('name')} (id={cid}) for color {color} ({basics_used[cid]}/{basics_quantities[cid]})")
                    break
            if not found:
                # Try any basic with available quantity, all printings
                for cid, c in basics_by_id.items():
                    if basics_used[cid] < basics_quantities[cid]:
                        final_lands.append(dict(c))
                        basics_used[cid] += 1
                        added += 1
                        found = True
                        print(f"[DEBUG] select_lands: added fallback {c.get('name')} (id={cid}) ({basics_used[cid]}/{basics_quantities[cid]})")
                        break
            if not found:
                print(f"[DEBUG] select_lands: no more basics available to fill lands (added {added} of {num_needed})")
                break
    # Truncate if over
    print(f"[DEBUG] select_lands: returning {len(final_lands[:num_lands])} lands (final)")
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
    print(f"[DEBUG] filter_card_pool called for commander: {commander.get('name')} | bracket: {bracket} | house_rules: {house_rules} | input pool size: {len(cards)}")
    commander_colors = set(commander.get("color_identity", []))
    filtered: List[Dict[str, Any]] = []
    for card in cards:
        # Color identity: skip cards with colors outside the commander's identity
        if not set(card.get("color_identity", [])).issubset(commander_colors):
            print(f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (color identity mismatch)")
            continue
        # Legalities: skip cards not legal in Commander
        if card.get("legalities", {}).get("commander") != "legal":
            print(f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (not legal in Commander)")
            continue
        # Bracket/game changer: enforce bracket rules for Game Changers
        if bracket in [1, 2] and card.get("game_changer", False):
            print(f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (game changer, bracket {bracket})")
            continue
        if bracket == 3 and card.get("game_changer", False):
            # We'll enforce max 3 later in deck filling
            pass
        # House rules: ban certain cards or types
        if house_rules:
            name = card.get("name", "").lower()
            if name == "sol ring":
                print(f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (house rules ban: sol ring)")
                continue
            # Example: ban nonland tutors (very basic, can be improved)
            if "tutor" in name and "land" not in name:
                print(f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (house rules ban: nonland tutor)")
                continue
            # Example: ban "unfun" cards (define your own list)
            if name in {"armageddon", "winter orb", "stasis"}:
                print(f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (house rules ban: unfun card)")
                continue
        # Salt filtering: skip cards with too high salt weight
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
            print(f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (salt_weight {salt_weight} > threshold {salt_weight_threshold})")
            continue
        filtered.append(card)
    print(f"[DEBUG] filter_card_pool: Final filtered pool size: {len(filtered)}")
    return filtered


def categorize_card(card: Dict[str, Any]) -> Set[str]:
    print(f"[DEBUG] categorize_card called for card: {card.get('name')} | type_line: {card.get('type_line')}")
    """
    Categorizes a card into one or more functional deck categories (e.g., ramp, draw, removal).
    Uses keywords and type line to determine the card's role(s) in the deck.
    Returns a set of category strings.
    """
    categories: Set[str] = set()
    keywords: List[str] = [str(k).lower() for k in list(card.get("keywords") or [])]
    type_line: str = str(card.get("type_line") or "").lower()
    name: str = str(card.get("name") or "").lower()
    # Ramp: mana acceleration or ramp keywords
    if "ramp" in keywords or "mana" in keywords or "mana" in type_line:
        categories.add("ramp")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'ramp'")
    # Draw: card draw/advantage
    if "draw" in keywords:
        categories.add("draw")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'draw'")
    # Removal: destroy, exile, bounce, counter
    if any(k in keywords for k in ["destroy", "exile", "bounce", "counter"]):
        categories.add("removal")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'removal'")
    # Boardwipe: mass removal
    if "boardwipe" in keywords or "sweeper" in keywords:
        categories.add("boardwipe")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'boardwipe'")
    # Graveyard hate
    if "graveyard" in keywords:
        categories.add("graveyard_hate")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'graveyard_hate'")
    # Recursion
    if "recursion" in keywords:
        categories.add("recursion")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'recursion'")
    # Pillowfort: protection/hexproof
    if any(k in keywords for k in ["hexproof", "shroud", "protection"]):
        categories.add("pillowfort")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'pillowfort'")
    # Wincon: win condition
    if "wincon" in keywords:
        categories.add("wincon")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'wincon'")
    # Land subtypes for advanced land selection
    if "land" in type_line:
        categories.add("lands")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'lands'")
        # Command Tower
        if name == "command tower":
            categories.add("command_tower")
            print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'command_tower'")
        # Rainbow lands: 3+ color identity or known rainbow names
        if len(set(card.get("color_identity", []))) > 2 or "rainbow" in keywords or name in {"cascading cataracts", "the world tree", "chromatic lantern"}:
            categories.add("rainbow")
            print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'rainbow'")
        # Dual lands: 2 color identity, not basic
        if len(set(card.get("color_identity", []))) == 2 and "basic land" not in type_line:
            categories.add("dual")
            print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'dual'")
        # Triland: 3 color identity, not basic
        if len(set(card.get("color_identity", []))) == 3 and "basic land" not in type_line:
            categories.add("triland")
            print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'triland'")
        # Fetch lands: common fetch names or "fetch" in keywords
        fetch_names = ["flooded strand", "polluted delta", "windswept heath", "wooded foothills", "bloodstained mire", "marsh flats", "scalding tarn", "verdant catacombs", "arid mesa", "misty rainforest", "prismatic vista", "evolving wilds", "terramorphic expanse"]
        if name in fetch_names or "fetch" in keywords:
            categories.add("fetch")
            print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'fetch'")
        # Utility lands: not basic, not dual, not triland, not rainbow, not fetch, not command tower
        if (
            "basic land" not in type_line
            and "dual" not in categories
            and "triland" not in categories
            and "rainbow" not in categories
            and "fetch" not in categories
            and "command_tower" not in categories
        ):
            categories.add("utility")
            print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'utility'")
    # Creature
    if "creature" in type_line:
        categories.add("creature")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'creature'")
    print(f"[DEBUG] categorize_card: {card.get('name')} categories = {categories}")
    return categories
    if "land" in type_line:
        categories.add("lands")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'lands'")
    # Creature
    if "creature" in type_line:
        categories.add("creature")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'creature'")
    print(f"[DEBUG] categorize_card: {card.get('name')} categories = {categories}")
    return categories


def generate_commander_deck(
    commander: Dict[str, Any],
    card_pool: List[Dict[str, Any]],
    bracket: int = 2,
    house_rules: bool = False,
    salt_list: Optional[Dict[str, List[int]]] = None,
    salt_threshold: int = 0,
    generation_settings: Optional[Dict[str, Any]] = None,  # Placeholder for user settings
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
    print(f"[DEBUG] generate_commander_deck: Commander submitted: {commander.get('name')} (id={commander.get('id')}) | Bracket: {bracket} | House rules: {house_rules}")
    # 1. Filter pool for color identity, legalities, and salt
    if salt_list is None:
        salt_list = fetch_salt_list_from_supabase(card_pool)
    filtered_pool = filter_card_pool(
        card_pool, commander, bracket, house_rules, salt_list, salt_threshold
    )
    print(f"[DEBUG] Filtered pool size: {len(filtered_pool)} | Sample: {[c.get('name') for c in filtered_pool[:5]]}")

    # 2. Detect theme
    theme = detect_theme(commander, filtered_pool)
    print(f"[DEBUG] Detected deck theme: {theme}")

    # 3. Categorize pool
    categorized: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in CATEGORY_TARGETS}
    for card in filtered_pool:
        if 'categories' not in card:
            card['categories'] = categorize_card(card)
        for cat in card['categories']:
            if cat in categorized:
                categorized[cat].append(card)
    print("[DEBUG] Category counts:")
    for cat, cards in categorized.items():
        print(f"  [DEBUG]   {cat}: {len(cards)} cards")

    # 4. Start with commander(s)
    deck = [commander]
    used_names = set([commander["name"]])
    used_ids = set([commander.get("id")])  # Track unique card ids for basics
    print(f"[DEBUG] Starting deck with commander: {commander.get('name')} (id={commander.get('id')})")
    print(f"[DEBUG] used_names initialized: {used_names}")
    print(f"[DEBUG] used_ids initialized: {used_ids}")

    # 5. Commander functions (synergy)
    commander_synergy = commander_functions(commander)
    print(f"[DEBUG] Commander provides these deck functions: {commander_synergy}")


    # 6. SELECT LANDS FIRST, then fill other categories
    # Determine number of lands to add (use max allowed, or enough to leave room for other categories)
    min_lands, max_lands = CATEGORY_TARGETS["lands"]
    # For now, use max_lands, but ensure we don't exceed 100 cards
    num_lands = min(max_lands, 100 - len(deck))
    land_pool = categorized.get("lands", [])
    print(f"[DEBUG] Selecting lands FIRST: need {num_lands}, pool size: {len(land_pool)}")
    lands = select_lands(commander, land_pool, num_lands)
    print(f"[DEBUG] Selected {len(lands)} lands: {[l.get('name') for l in lands[:5]]}{'...' if len(lands) > 5 else ''}")
    for land in lands:
        land_id = land.get("id")
        is_basic = "basic land" in (land.get("type_line", "").lower())
        if is_basic:
            # Allow multiple basics of the same name and id, up to owned quantity and deck size
            count_in_deck = sum(1 for c in deck if c.get("id") == land_id)
            owned_qty = int(land.get("quantity", 1))
            if count_in_deck < owned_qty and len(deck) < 100:
                deck.append(land)
                print(f"[DEBUG]   Added basic land: {land.get('name')} (id={land_id}) [{count_in_deck+1}/{owned_qty}]")
        else:
            # Only add nonbasics if not already present by name or id
            if land["name"] not in used_names and land_id not in used_ids and len(deck) < 100:
                deck.append(land)
                used_names.add(land["name"])
                used_ids.add(land_id)
                print(f"[DEBUG]   Added nonbasic land: {land.get('name')} (id={land_id})")

    print(f"[DEBUG] Deck size after lands: {len(deck)}")
    print(f"[DEBUG] Land count in deck: {sum(1 for c in deck if 'land' in (c.get('type_line','').lower()))}")

    # 7. STRICT CATEGORY FILL with THEME/SYNERGY PRIORITY: For each category, prioritize theme+category, then synergy+category, then best by rank
    # Prepare theme candidates for matching
    commander_keywords = set(str(k).lower() for k in commander.get("keywords", []))
    oracle = str(commander.get("oracle_text", "")).lower()
    import re
    oracle_words: Set[str] = set(re.findall(r"\b[a-zA-Z][a-zA-Z\-']*\b", oracle))
    oracle_phrases: Set[str] = set()
    oracle_tokens = oracle.split()
    for i in range(len(oracle_tokens) - 1):
        phrase = f"{oracle_tokens[i]} {oracle_tokens[i+1]}".lower()
        oracle_phrases.add(phrase)
    theme_candidates: Set[str] = set()
    theme_candidates.update(str(k) for k in commander_keywords)
    theme_candidates.update(str(w) for w in oracle_words)
    theme_candidates.update(str(p) for p in oracle_phrases)
    main_type = None
    type_line = commander.get("type_line", "").lower()
    if "creature" in type_line:
        parts = type_line.split("—")
        if len(parts) > 1:
            type_words = parts[-1].strip().split()
            if type_words:
                main_type = type_words[0]
    if main_type:
        theme_candidates.add(main_type)
    theme_candidates.add(str(theme))

    def card_matches_theme(card: Dict[str, Any], candidates: Set[str]) -> bool:
        card_text = card.get("type_line", "").lower() + " " + " ".join([str(k).lower() for k in card.get("keywords", [])])
        return any(tc for tc in candidates if tc and len(tc) > 2 and tc in card_text)

    # --- CARD TYPE TARGET ENFORCEMENT LOGIC ---

    def get_type(card: Dict[str, Any]) -> str:
        type_line = str(card.get("type_line", "")).lower()
        for t in ["creature", "sorcery", "instant", "enchantment", "artifact", "planeswalker", "land"]:
            if t in type_line:
                return t
        return "other"

    def type_counts(deck: List[Dict[str, Any]]) -> Dict[str, int]:
        counts = {t: 0 for t in CARD_TYPE_TARGETS}
        for c in deck:
            t = get_type(c)
            if t in counts:
                counts[t] += 1
        return counts

    # --- Strictly fill all card type targets before allowing overflow ---
    type_targets_met = lambda deck: all(type_counts(deck)[t] >= CARD_TYPE_TARGETS[t] for t in CARD_TYPE_TARGETS)  # type: ignore
    for cat, (min_count, max_count) in CATEGORY_TARGETS.items():
        if cat == "lands":
            continue  # Lands already added
        print(f"[DEBUG] Strictly filling category '{cat}' (min={min_count}, max={max_count}) with theme/synergy priority and type targets (strict)")
        pool = categorized.get(cat, [])
        theme_cat = [c for c in pool if card_matches_theme(c, theme_candidates)]
        synergy_cat = [c for c in pool if cat in commander_synergy and c not in theme_cat]
        rest_cat = [c for c in pool if c not in theme_cat and c not in synergy_cat]
        rest_cat = sorted(rest_cat, key=lambda c: c.get("edhrec_rank", 999999))
        prioritized = theme_cat + synergy_cat + rest_cat
        count = 0
        # --- Strict pass: only add cards whose type is under its target ---
        while count < max_count and len(deck) < 100 and not type_targets_met(deck):
            type_count = type_counts(deck)
            under_types = {t for t, v in type_count.items() if v < CARD_TYPE_TARGETS[t]}
            found = False
            for card in prioritized:
                card_id = card.get("id")
                if card["name"] in used_names or card_id in used_ids:
                    continue
                t = get_type(card)
                if t in CARD_TYPE_TARGETS and t not in under_types:
                    continue  # skip, type already at or above target
                # Add this card
                deck.append(card)
                used_names.add(card["name"])
                used_ids.add(card_id)
                count += 1
                print(f"[DEBUG]   (type-priority) Added to '{cat}' (type {t}): {card.get('name')} (id={card_id})")
                found = True
                break
            if not found:
                break  # No more under-target type cards available
        # --- Overflow pass: only allow overflow if ALL type targets are met ---
        while count < max_count and len(deck) < 100 and type_targets_met(deck):
            found = False
            for card in prioritized:
                card_id = card.get("id")
                if card["name"] in used_names or card_id in used_ids:
                    continue
                t = get_type(card)
                deck.append(card)
                used_names.add(card["name"])
                used_ids.add(card_id)
                count += 1
                print(f"[DEBUG]   (overflow) Added to '{cat}' (type {t}): {card.get('name')} (id={card_id})")
                found = True
                break
            if not found:
                break
        # --- Ensure min_count is met ---
        while count < min_count and len(deck) < 100:
            for card in prioritized:
                card_id = card.get("id")
                if card["name"] in used_names or card_id in used_ids:
                    continue
                deck.append(card)
                used_names.add(card["name"])
                used_ids.add(card_id)
                count += 1
                t = get_type(card)
                print(f"[DEBUG]   (min fill) Added to '{cat}' (type {t}): {card.get('name')} (id={card_id})")
                break
            else:
                break
    # --- FINAL TYPE ENFORCEMENT: If any CARD_TYPE_TARGETS are not met, fill them from the remaining pool, even if it exceeds category maxes ---
    type_count = type_counts(deck)
    for t, target in CARD_TYPE_TARGETS.items():
        while type_count[t] < target and len(deck) < 99:
            candidates = [c for c in filtered_pool if c["name"] not in used_names and c.get("id") not in used_ids and get_type(c) == t]
            if not candidates:
                break
            best = sorted(candidates, key=lambda c: c.get("edhrec_rank", 999999))[0]
            deck.append(best)
            used_names.add(best["name"])
            used_ids.add(best.get("id"))
            type_count[t] += 1
            print(f"[DEBUG]   (final type fill) Added {best.get('name')} to meet type target {t} ({type_count[t]}/{target})")

    # 8. Fill main theme (if not already filled), but ONLY if deck is not full and category maxes are not exceeded
    if "main_theme" in CATEGORY_TARGETS:
        # Recompute theme candidates as in detect_theme
        commander_keywords = set(str(k).lower() for k in commander.get("keywords", []))
        oracle = str(commander.get("oracle_text", "")).lower()
        import re
        oracle_words: Set[str] = set(re.findall(r"\b[a-zA-Z][a-zA-Z\-']*\b", oracle))
        oracle_phrases: Set[str] = set()
        oracle_tokens = oracle.split()
        for i in range(len(oracle_tokens) - 1):
            phrase = f"{oracle_tokens[i]} {oracle_tokens[i+1]}".lower()
            oracle_phrases.add(phrase)
        theme_candidates: Set[str] = set()
        theme_candidates.update(str(k) for k in commander_keywords)
        theme_candidates.update(str(w) for w in oracle_words)
        theme_candidates.update(str(p) for p in oracle_phrases)
        # Always include the main_type and theme string
        main_type = None
        type_line = commander.get("type_line", "").lower()
        if "creature" in type_line:
            parts = type_line.split("—")
            if len(parts) > 1:
                type_words = parts[-1].strip().split()
                if type_words:
                    main_type = type_words[0]
        if main_type:
            theme_candidates.add(main_type)
        theme_candidates.add(str(theme))

        def card_matches_theme(card: Dict[str, Any], candidates: Set[str]) -> bool:
            card_text = card.get("type_line", "").lower() + " " + " ".join([str(k).lower() for k in card.get("keywords", [])])
            return any(tc for tc in candidates if tc and len(tc) > 2 and tc in card_text)

        theme_pool = [c for c in filtered_pool if card_matches_theme(c, theme_candidates)]
        theme_pool = sorted(theme_pool, key=lambda c: c.get("edhrec_rank", 999999))
        theme_added = 0
        for card in theme_pool:
            # Only add if deck is not full and adding this card does not exceed any category max
            if card["name"] in used_names or len(deck) >= 100:
                continue
            # Check all categories for this card
            cats = categorize_card(card)
            can_add = True
            for cat in cats:
                if cat in CATEGORY_TARGETS:
                    _, max_count = CATEGORY_TARGETS[cat]
                    cat_count = sum(1 for c in deck if cat in categorize_card(c))
                    if cat_count >= max_count:
                        can_add = False
                        break
            if can_add:
                deck.append(card)
                used_names.add(card["name"])
                theme_added += 1
        print(f"[DEBUG] Added {theme_added} theme/synergy cards (without exceeding category maxes)")

    # 9. FINAL ENFORCEMENT: Ensure all CATEGORY_TARGETS are respected
    def trim_category(deck: List[Dict[str, Any]], cat: str, max_count: int):
        trimmed = False
        while True:
            cat_cards = [c for c in deck if 'categories' in c and cat in c['categories']]
            if len(cat_cards) <= max_count:
                break
            to_remove = sorted(cat_cards, key=lambda c: c.get("edhrec_rank", 999999), reverse=True)[0]
            deck.remove(to_remove)
            trimmed = True
            print(f"[DEBUG]   Trimmed {cat}: {to_remove.get('name')}")
        return trimmed

    def fill_category(deck: List[Dict[str, Any]], cat: str, min_count: int, pool: List[Dict[str, Any]], used_names: Set[str], used_ids: Set[Any]):
        added = False
        while True:
            cat_cards = [c for c in deck if 'categories' in c and cat in c['categories']]
            if len(cat_cards) >= min_count:
                break
            candidates = [c for c in pool if 'categories' in c and cat in c['categories'] and c["name"] not in used_names and c.get("id") not in used_ids]
            if not candidates:
                break
            best = sorted(candidates, key=lambda c: c.get("edhrec_rank", 999999))[0]
            deck.append(best)
            used_names.add(best["name"])
            used_ids.add(best.get("id"))
            added = True
            print(f"[DEBUG]   Filled {cat}: {best.get('name')}")
        return added

    for cat, (min_count, max_count) in CATEGORY_TARGETS.items():
        if cat == "lands":
            continue
        trim_category(deck, cat, max_count)
    for cat, (min_count, max_count) in CATEGORY_TARGETS.items():
        if cat == "lands":
            continue
        fill_category(deck, cat, min_count, filtered_pool, used_names, used_ids)

    # Enforce land count strictly
    land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
    min_lands, max_lands = CATEGORY_TARGETS["lands"]
    while len(land_cards) > max_lands:
        to_remove = sorted(land_cards, key=lambda c: c.get("edhrec_rank", 999999), reverse=True)[0]
        deck.remove(to_remove)
        print(f"[DEBUG]   Trimmed land: {to_remove.get('name')}")
        land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
    land_pool = [c for c in filtered_pool if "land" in str(c.get("type_line", "")).lower() and c["name"] not in used_names and c.get("id") not in used_ids]
    while len(land_cards) < min_lands and land_pool:
        best = sorted(land_pool, key=lambda c: c.get("edhrec_rank", 999999))[0]
        deck.append(best)
        used_names.add(best["name"])
        used_ids.add(best.get("id"))
        print(f"[DEBUG]   Filled land: {best.get('name')}")
        land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
        land_pool = [c for c in filtered_pool if "land" in str(c.get("type_line", "")).lower() and c["name"] not in used_names and c.get("id") not in used_ids]

    # FINAL FILL: Fill to 99 cards (excluding commander) with best available cards, strictly prioritizing underrepresented types
    while len(deck) < 99:
        candidates: List[Dict[str, Any]] = [c for c in filtered_pool if c["name"] not in used_names and c.get("id") not in used_ids]
        # Filter out cards that would exceed any category max
        valid_candidates: List[Dict[str, Any]] = []
        type_count = type_counts(deck)
        under_types = {t for t, v in type_count.items() if v < CARD_TYPE_TARGETS[t]}
        for c in candidates:
            if 'categories' not in c:
                c['categories'] = categorize_card(c)
            cats = c['categories']
            can_add = True
            for cat in cats:
                if cat in CATEGORY_TARGETS:
                    _, max_count = CATEGORY_TARGETS[cat]
                    cat_count = sum(1 for d in deck if 'categories' in d and cat in d['categories'])
                    if cat_count >= max_count:
                        can_add = False
                        break
            if not can_add:
                continue
            t = get_type(c)
            # Only allow overflow if no underrepresented types left in pool
            if under_types and t not in under_types:
                continue
            valid_candidates.append(c)
        if not valid_candidates:
            print(f"[DEBUG]   No valid candidates left to fill deck to 99. Deck size: {len(deck)}")
            break
        best: Dict[str, Any] = sorted(valid_candidates, key=lambda c: c.get("edhrec_rank", 999999))[0]
        deck.append(best)
        used_names.add(best["name"])
        used_ids.add(best.get("id"))
        t = get_type(best)
        print(f"[DEBUG]   Final fill: {best.get('name')} (type {t})")

    # Final trim if deck is over 99 (excluding commander)
    while len(deck) > 99:
        non_essential = [c for c in deck if "land" not in str(c.get("type_line", "")).lower() and "creature" not in str(c.get("type_line", "")).lower()]
        if non_essential:
            to_remove = sorted(non_essential, key=lambda c: c.get("edhrec_rank", 999999), reverse=True)[0]
            deck.remove(to_remove)
            print(f"[DEBUG]   Final trim: {to_remove.get('name')}")
        else:
            deck.pop()
            print(f"[DEBUG]   Final trim: removed last card")

    print(f"[DEBUG] Final deck size: {len(deck)} (should be 99 + commander)")
    print(f"[DEBUG] Final land count: {sum(1 for c in deck if 'land' in (c.get('type_line','').lower()))}")
    return {
        "commander": commander,
        "deck": deck,
        "deck_size": len(deck),
        "total_cards": len(deck) + 1,
        "bracket": bracket,
    }