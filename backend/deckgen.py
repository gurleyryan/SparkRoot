import os
import json
import traceback
import structlog
from typing import Dict, Any, List, Set, Optional, Union, Generator
from collections import Counter
from cursor import normalize_name, CardLookup

logger = structlog.get_logger()


# Mana curve targets from TCGPlayer article (Feb 2025)
MANA_CURVE_TARGETS: dict[int, dict[int | str, int]] = {
    2: {1: 9, 2: 0, 3: 20, 4: 14, 5: 9, 6: 4, "mana_rocks": 1, "lands": 42},
    3: {1: 8, 2: 19, 3: 0, 4: 16, 5: 10, 6: 3, "mana_rocks": 1, "lands": 42},
    4: {1: 6, 2: 12, 3: 13, 4: 0, 5: 13, 6: 8, "mana_rocks": 7, "lands": 39},
    5: {1: 6, 2: 12, 3: 10, 4: 13, 5: 0, 6: 10, "mana_rocks": 8, "lands": 39},
    6: {1: 6, 2: 12, 3: 10, 4: 14, 5: 9, 6: 0, "mana_rocks": 9, "lands": 38},
}


def get_mana_curve_targets(commander_cmc: int) -> Dict[Union[int, str], int]:
    """
    Returns the mana curve targets for a given commander CMC.
    Defaults to 4-mana curve if not found.
    """
    return MANA_CURVE_TARGETS.get(commander_cmc, MANA_CURVE_TARGETS[4])


# Helper: filter out cards with CMC equal to commander CMC, unless highly synergistic
def filter_ndrop_cards(
    card_pool: List[Dict[str, Any]],
    commander_cmc: int,
    theme: Optional[str] = None,
    synergy_keywords: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Filters out cards with CMC equal to the commander's CMC, unless they are highly synergistic (match theme or synergy keywords).
    Recommended usage: pass the theme detected by detect_theme(commander, card_pool) as the 'theme' argument.
    This allows theme-relevant N-drops to be retained, improving deck synergy.
    """
    if synergy_keywords is None:
        synergy_keywords = []
    filtered: List[Dict[str, Any]] = []
    for card in card_pool:
        cmc = int(card.get("cmc", 0))
        if cmc == commander_cmc:
            # Check for synergy: theme in type_line, or any synergy keyword in oracle_text
            type_line = str(card.get("type_line", "")).lower()
            oracle = str(card.get("oracle_text", "")).lower()
            if theme and theme in type_line:
                filtered.append(card)
                continue
            if any(kw in oracle for kw in synergy_keywords):
                filtered.append(card)
                continue
            # Otherwise, skip this card
            continue
        filtered.append(card)
    return filtered


# Helper: select cards for a given CMC slot, prioritizing theme/synergy and allowing small deviations
def select_cards_for_curve_slot(
    card_pool: List[Dict[str, Any]],
    cmc: int,
    commander: Dict[str, Any],
    commander_cmc: int,
    curve_targets: Dict[Union[int, str], int],
    deviation: int = 1,
    theme: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Selects cards for a given CMC slot, up to curve_targets[cmc] (+/- deviation).
    Uses theme detection and N-drop filtering for synergy.
    Prioritizes cards matching the deck's theme in type_line or keywords.
    """
    if theme is None:
        theme = detect_theme(commander, card_pool)
    filtered_pool = filter_ndrop_cards(card_pool, commander_cmc, theme)
    # Only nonland cards for curve slots
    slot_cards = [
        card
        for card in filtered_pool
        if int(card.get("cmc", 0)) == cmc
        and "land" not in str(card.get("type_line", "")).lower()
    ]
    # Prioritize theme/synergy
    theme_cards = [
        card
        for card in slot_cards
        if theme and theme in str(card.get("type_line", "")).lower()
    ]
    non_theme_cards = [card for card in slot_cards if card not in theme_cards]
    # Allow small deviation from target
    target = curve_targets.get(cmc, 0)
    max_target = target + deviation
    selected = (
        theme_cards[:max_target]
        + non_theme_cards[: max(0, max_target - len(theme_cards))]
    )
    # Truncate to max_target
    return selected[:max_target]


def analyze_mana_curve(deck: List[Dict[str, Any]]) -> Dict[int, int]:
    """
    Analyzes the mana curve of the deck.
    Returns a dictionary mapping converted mana cost (cmc) to the count of cards at that cost.
    """
    # Exclude lands from mana curve calculation
    nonland_cards = [
        card for card in deck if "land" not in str(card.get("type_line", "")).lower()
    ]
    cmcs = [int(card.get("cmc", 0)) for card in nonland_cards if "cmc" in card]
    return dict(Counter(cmcs))


def fetch_salt_list_from_supabase(card_pool: List[Dict[str, Any]]) -> Dict[str, float]:
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
    pool_ids: Set[str] = set()
    name_by_id: Dict[str, str] = {}
    for card in card_pool:
        cid = str(card.get("id"))
        pool_ids.add(cid)
        name_by_id[cid] = card.get("name", "")
    if not pool_ids:
        return {}
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    # Query only for relevant card_ids
    resp = (
        supabase.table("salt")
        .select("card_id,Salt,years_included")
        .in_("card_id", list(pool_ids))
        .execute()
    )
    data = resp.data or []
    salt_map: Dict[str, float] = {}
    for row in data:
        cid = str(row["card_id"])
        name: str = name_by_id.get(cid, "")
        salt_score = float(row.get("Salt", 0.0))
        years = row.get("years_included", [])
        weighted_sum = 0.0
        if years:
            try:
                years_int = [int(y) for y in years]
                newest_year = max(years_int)
                for y in years_int:
                    n = newest_year - y
                    weight = max(0.0, 1.0 - 0.1 * n)
                    weighted_sum += weight
            except Exception:
                weighted_sum = len(years)
        else:
            weighted_sum = 1.0
        weighted_salt = salt_score * weighted_sum
        if name:
            salt_map[name] = weighted_salt
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
            print(
                f"[DEBUG]   Found valid legendary creature commander: {card.get('name')}"
            )
        elif "planeswalker" in type_line and "can be your commander" in oracle:
            valid_commanders.append(card)
            print(f"[DEBUG]   Found valid planeswalker commander: {card.get('name')}")
    print(f"[DEBUG] Total valid commanders found: {len(valid_commanders)}")
    return valid_commanders


# CATEGORY_TARGETS defines the minimum and maximum number of cards for each functional category in a Commander deck.
# These targets are based on best practices and the deck-building guide, and are used to enforce deck balance.
CATEGORY_TARGETS = {
    "lands": (33, 38),  # Land count range
    "ramp": (5, 10),  # Mana acceleration
    "draw": (5, 9),  # Card draw/advantage
    "removal": (6, 9),  # Targeted removal
    "sweeper": (2, 4),  # Board wipes
    "graveyard_hate": (1, 3),  # Graveyard interaction
    "recursion": (1, 3),  # Card recursion
    "pillowfort": (1, 3),  # Defensive/protection
    "wincon": (1, 3),  # Win conditions
    "tutor": (0, 2),  # Tutors/search
    "creature": (20, 40),  # Creature count
    "main_theme": (0, 99),  # Main deck theme (kindred, etc.)
}

# CARD_TYPE_TARGETS defines the ideal number of each card type in a 100-card deck (percentages rounded to nearest card)
CARD_TYPE_TARGETS = {
    "land": 36,  # 36%
    "creature": 29,  # 29%
    "instant": 10,  # 10%
    "sorcery": 8,  # 8%
    "enchantment": 6,  # 6%
    "artifact": 6,  # 6%
    "planeswalker": 4,  # 4%
}

# LAND_TYPE_PRIORITY defines the preferred order for selecting lands to ensure color fixing and deck consistency.
LAND_TYPE_PRIORITY = [
    "command_tower",
    "rainbow",
    "dual",
    "fetch",
    "triland",
    "utility",
    "basic",
]


def detect_theme(commander: Dict[str, Any], card_pool: List[Dict[str, Any]]) -> str:
    print(
        f"[DEBUG] detect_theme called for commander: {commander.get('name')} | pool size: {len(card_pool)}"
    )
    """
    Detects the main deck theme based on the commander's type line and keywords.
    - If the commander is kindred or a creature, tries to infer the most common creature type in the pool.
    - Otherwise, uses the first keyword or ability word as the theme.
    - Returns 'generic' if no theme is detected.
    """
    import re

    GENERIC_TYPES = {"human", "wizard", "soldier", "warrior", "shaman"}
    GENERIC_KEYWORDS = {
        "flying",
        "trample",
        "haste",
        "deathtouch",
        "first strike",
        "vigilance",
        "reach",
        "menace",
        "hexproof",
        "indestructible",
        "lifelink",
    }
    type_line = commander.get("type_line", "").lower()
    print(
        f"[DEBUG] detect_theme: commander type_line='{type_line}', keywords={commander.get('keywords', [])}"
    )

    # Extract keywords and phrases
    commander_keywords = set(str(k).lower() for k in commander.get("keywords", []))
    oracle = str(commander.get("oracle_text", "")).lower()
    oracle_words: Set[str] = set(re.findall(r"\b[a-zA-Z][a-zA-Z\-']*\b", oracle))
    oracle_phrases: Set[str] = set()
    oracle_tokens = oracle.split()
    for i in range(len(oracle_tokens) - 1):
        phrase = f"{oracle_tokens[i]} {oracle_tokens[i+1]}".lower()
        oracle_phrases.add(phrase)
    # Theme candidates, prioritized: commander keywords, two-word phrases, single words
    theme_candidates: List[str] = []
    theme_candidates.extend([str(k) for k in commander_keywords])
    theme_candidates.extend([str(p) for p in oracle_phrases])
    theme_candidates.extend([str(w) for w in oracle_words])

    # 1. Try to match the commander's main type (e.g., Sphinx, Human, etc.)
    main_type = None
    if "creature" in type_line:
        parts = type_line.split("—")
        if len(parts) > 1:
            type_words = parts[-1].strip().split()
            if type_words:
                # Count all types in pool, not just the first
                type_counts: Counter[str] = Counter()
                for t in type_words:
                    count = sum(
                        1
                        for card in card_pool
                        if t in card.get("type_line", "").lower()
                    )
                    type_counts[t] = count
                if type_counts:
                    # Prefer non-generic types if possible
                    for t, _ in type_counts.most_common():
                        if t not in GENERIC_TYPES:
                            main_type = t
                            break
                    if not main_type:
                        main_type = type_counts.most_common(1)[0][0]
                    print(
                        f"[DEBUG] detect_theme: main_type from type_line is '{main_type}'"
                    )
    # 2. If main_type found, check if it's common in the pool
    if main_type:
        count = sum(
            1 for card in card_pool if main_type in card.get("type_line", "").lower()
        )
        if count > 2:
            print(
                f"[DEBUG] detect_theme: using main_type '{main_type}' as theme (count in pool: {count})"
            )
            return main_type

    # 3. Check for any theme candidate in prioritized order
    for candidate in theme_candidates:
        if not candidate or len(candidate) < 3:
            continue
        # Check if candidate is present in any card's type_line or keywords
        for card in card_pool:
            if candidate in card.get("type_line", "").lower() or candidate in " ".join(
                [str(k).lower() for k in card.get("keywords", [])]
            ):
                print(
                    f"[DEBUG] detect_theme: using commander keyword/oracle '{candidate}' as theme"
                )
                return candidate

    # 4. Otherwise, use most common creature type or non-generic keyword in pool
    types: List[str] = []
    pool_keywords: List[str] = []
    for card in card_pool:
        if "creature" in (card.get("type_line", "").lower()):
            for t in (
                card.get("type_line", "")
                .replace("Legendary Creature", "")
                .replace("Creature", "")
                .split("—")[-1]
                .split()
            ):
                types.append(t.strip())
        # Collect all keywords from pool
        pool_keywords.extend([str(k).lower() for k in card.get("keywords", [])])
    if types:
        # Prefer non-generic types
        type_counts = Counter(types)
        for t, _ in type_counts.most_common():
            if t not in GENERIC_TYPES:
                print(
                    f"[DEBUG] detect_theme: most common non-generic creature type is '{t}'"
                )
                return t
        most_common = type_counts.most_common(1)[0][0]
        print(f"[DEBUG] detect_theme: most common creature type is '{most_common}'")
        return most_common
    if pool_keywords:
        # Prefer non-generic keywords
        filtered_keywords = [kw for kw in pool_keywords if kw not in GENERIC_KEYWORDS]
        if filtered_keywords:
            most_common_kw = Counter(filtered_keywords).most_common(1)[0][0]
            print(
                f"[DEBUG] detect_theme: most common non-generic keyword in pool is '{most_common_kw}'"
            )
            return most_common_kw
        most_common_kw = Counter(pool_keywords).most_common(1)[0][0]
        print(
            f"[DEBUG] detect_theme: most common keyword in pool is '{most_common_kw}'"
        )
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
    if any(k in keywords + [type_line, oracle] for k in ["draw", "card draw", "loot"]):
        provided.add("draw")
        print("[DEBUG] commander_functions: provides 'draw'")
    if any(
        k in keywords + [type_line, oracle]
        for k in ["destroy", "exile", "removal", "kill"]
    ):
        provided.add("removal")
        print("[DEBUG] commander_functions: provides 'removal'")
    if any(k in keywords + [type_line, oracle] for k in ["ramp", "mana", "land"]):
        provided.add("ramp")
        print("[DEBUG] commander_functions: provides 'ramp'")
    if any(k in keywords + [type_line, oracle] for k in ["wincon", "win", "combo"]):
        provided.add("wincon")
        print("[DEBUG] commander_functions: provides 'wincon'")
    if any(
        k in keywords + [type_line, oracle]
        for k in ["recursion", "return", "graveyard"]
    ):
        provided.add("recursion")
        print("[DEBUG] commander_functions: provides 'recursion'")
    if any(k in keywords + [type_line, oracle] for k in ["sweeper", "boardwipe"]):
        provided.add("sweeper")
        print("[DEBUG] commander_functions: provides 'sweeper'")
    if any(
        k in keywords + [type_line, oracle]
        for k in ["pillowfort", "protection", "hexproof"]
    ):
        provided.add("pillowfort")
        print("[DEBUG] commander_functions: provides 'pillowfort'")
    print(f"[DEBUG] commander_functions: provided set = {provided}")
    return provided


def select_lands(
    commander: Dict[str, Any], pool: List[Dict[str, Any]], num_lands: int
) -> List[Dict[str, Any]]:
    print(
        f"[DEBUG] select_lands called for commander: {commander.get('name')} | colors: {commander.get('color_identity', [])} | num_lands: {num_lands}"
    )
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
        return cat in card.get("categories", set())

    # Assign categories to all cards in pool if not already present
    for c in pool:
        if "categories" not in c:
            c["categories"] = categorize_card(c)

    utility = [c for c in pool if has_cat(c, "utility")]
    basics = [c for c in pool if is_type(c, "basic land")]
    duals = [c for c in pool if has_cat(c, "dual")]
    fetches = [c for c in pool if has_cat(c, "fetch")]
    rainbow = [c for c in pool if has_cat(c, "rainbow")]
    command_tower = [c for c in pool if has_cat(c, "command_tower")]
    trilands = [c for c in pool if has_cat(c, "triland")]
    print(
        f"[DEBUG] select_lands: utility={len(utility)}, basics={len(basics)}, duals={len(duals)}, fetches={len(fetches)}, rainbow={len(rainbow)}, command_tower={len(command_tower)}, trilands={len(trilands)}"
    )

    # Add non-basic lands first, no duplicates
    if color_count == 1:
        lands += utility[:10]
        print(
            f"[DEBUG] select_lands: color_count=1, added {len(utility[:10])} utility lands"
        )
    elif color_count == 2:
        lands += command_tower[:1]
        lands += utility[:5]
        lands += duals[:5]
        lands += fetches[:5]
        print(
            "[DEBUG] select_lands: color_count=2, added command_tower, utility, duals, fetches"
        )
    elif color_count == 3:
        lands += command_tower[:1]
        lands += utility[:2]
        lands += duals[:5]
        lands += fetches[:5]
        lands += trilands[:5]
        lands += rainbow[:5]
        print(
            "[DEBUG] select_lands: color_count=3, added command_tower, utility, duals, fetches, trilands, rainbow"
        )
    elif color_count == 4:
        lands += command_tower[:1]
        lands += utility[:1]
        lands += fetches[:10]
        lands += rainbow[:10]
        print(
            "[DEBUG] select_lands: color_count=4, added command_tower, utility, fetches, rainbow"
        )
    elif color_count == 5:
        lands += command_tower[:1]
        lands += utility[:1]
        lands += fetches[:10]
        lands += rainbow[:10]
        print(
            "[DEBUG] select_lands: color_count=5, added command_tower, utility, fetches, rainbow"
        )

    # Remove duplicates by unique id, keep order
    seen_ids: Set[str] = set()
    final_lands: List[Dict[str, Any]] = []
    for c in lands:
        cid = str(c.get("id"))
        if cid not in seen_ids and len(final_lands) < num_lands:
            final_lands.append(c)
            seen_ids.add(cid)
            print(
                f"[DEBUG] select_lands: added nonbasic land {c.get('name')} (id={cid})"
            )

    # Fill remaining slots with basic lands, respecting all unique printings and their quantities
    print(
        f"[DEBUG] select_lands: filling with basics, need {num_lands - len(final_lands)} more lands"
    )
    basics_by_color: Dict[str, List[Dict[str, Any]]] = {
        "W": [],
        "U": [],
        "B": [],
        "R": [],
        "G": [],
    }
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
                    print(
                        f"[DEBUG] select_lands: added {c.get('name')} (id={cid}) for color {color} ({basics_used[cid]}/{basics_quantities[cid]})"
                    )
                    break
            if not found:
                # Try any basic with available quantity, all printings
                for cid, c in basics_by_id.items():
                    if basics_used[cid] < basics_quantities[cid]:
                        final_lands.append(dict(c))
                        basics_used[cid] += 1
                        added += 1
                        found = True
                        print(
                            f"[DEBUG] select_lands: added fallback {c.get('name')} (id={cid}) ({basics_used[cid]}/{basics_quantities[cid]})"
                        )
                        break
            if not found:
                print(
                    f"[DEBUG] select_lands: no more basics available to fill lands (added {added} of {num_needed})"
                )
                break
    # Truncate if over
    print(
        f"[DEBUG] select_lands: returning {len(final_lands[:num_lands])} lands (final)"
    )
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
    print(
        f"[DEBUG] filter_card_pool called for commander: {commander.get('name')} | bracket: {bracket} | house_rules: {house_rules} | input pool size: {len(cards)}"
    )
    commander_colors = set(commander.get("color_identity", []))
    filtered: List[Dict[str, Any]] = []
    for card in cards:
        # Color identity: skip cards with colors outside the commander's identity
        if not set(card.get("color_identity", [])).issubset(commander_colors):
            print(
                f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (color identity mismatch)"
            )
            continue
        # Legalities: skip cards not legal in Commander
        if card.get("legalities", {}).get("commander") != "legal":
            print(
                f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (not legal in Commander)"
            )
            continue
        # Bracket/game changer: enforce bracket rules for Game Changers
        if bracket in [1, 2] and card.get("game_changer", False):
            print(
                f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (game changer, bracket {bracket})"
            )
            continue
        if bracket == 3 and card.get("game_changer", False):
            # We'll enforce max 3 later in deck filling
            pass
        # House rules: ban certain cards or types
        if house_rules:
            name = card.get("name", "").lower()
            if name == "sol ring":
                print(
                    f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (house rules ban: sol ring)"
                )
                continue
            # Example: ban nonland tutors (very basic, can be improved)
            if "tutor" in name and "land" not in name:
                print(
                    f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (house rules ban: nonland tutor)"
                )
                continue
            # Example: ban "unfun" cards (define your own list)
            if name in {"armageddon", "winter orb", "stasis"}:
                print(
                    f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (house rules ban: unfun card)"
                )
                continue
        # Salt filtering: skip cards with too high salt weight
        salt_weight = salt_list.get(card.get("name", ""), 0.0)
        card["salt_weight"] = salt_weight
        # If salt_threshold >= 15, allow all cards (no salt filtering)
        if (
            salt_weight_threshold < 15
            and salt_weight_threshold > 0
            and salt_weight > salt_weight_threshold
        ):
            print(
                f"[DEBUG] filter_card_pool: Skipping {card.get('name')} (salt_weight {salt_weight} > threshold {salt_weight_threshold})"
            )
            continue
        filtered.append(card)
    print(f"[DEBUG] filter_card_pool: Final filtered pool size: {len(filtered)}")
    return filtered


def categorize_card(card: Dict[str, Any]) -> Set[str]:
    print(
        f"[DEBUG] categorize_card called for card: {card.get('name')} | type_line: {card.get('type_line')}"
    )
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
        print(
            f"[DEBUG] categorize_card: {card.get('name')} categorized as 'graveyard_hate'"
        )
    # Recursion
    if "recursion" in keywords:
        categories.add("recursion")
        print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'recursion'")
    # Pillowfort: protection/hexproof
    if any(k in keywords for k in ["hexproof", "shroud", "protection"]):
        categories.add("pillowfort")
        print(
            f"[DEBUG] categorize_card: {card.get('name')} categorized as 'pillowfort'"
        )
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
            print(
                f"[DEBUG] categorize_card: {card.get('name')} categorized as 'command_tower'"
            )
        # Rainbow lands: 3+ color identity or known rainbow names
        if (
            len(set(card.get("color_identity", []))) > 2
            or "rainbow" in keywords
            or name in {"cascading cataracts", "the world tree", "chromatic lantern"}
        ):
            categories.add("rainbow")
            print(
                f"[DEBUG] categorize_card: {card.get('name')} categorized as 'rainbow'"
            )
        # Dual lands: 2 color identity, not basic
        if (
            len(set(card.get("color_identity", []))) == 2
            and "basic land" not in type_line
        ):
            categories.add("dual")
            print(f"[DEBUG] categorize_card: {card.get('name')} categorized as 'dual'")
        # Triland: 3 color identity, not basic
        if (
            len(set(card.get("color_identity", []))) == 3
            and "basic land" not in type_line
        ):
            categories.add("triland")
            print(
                f"[DEBUG] categorize_card: {card.get('name')} categorized as 'triland'"
            )
        # Fetch lands: common fetch names or "fetch" in keywords
        fetch_names = [
            "flooded strand",
            "polluted delta",
            "windswept heath",
            "wooded foothills",
            "bloodstained mire",
            "marsh flats",
            "scalding tarn",
            "verdant catacombs",
            "arid mesa",
            "misty rainforest",
            "prismatic vista",
            "evolving wilds",
            "terramorphic expanse",
        ]
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
            print(
                f"[DEBUG] categorize_card: {card.get('name')} categorized as 'utility'"
            )
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
    salt_list: Optional[Dict[str, float]] = None,
    salt_threshold: int = 0,
    generation_settings: Optional[
        Dict[str, Any]
    ] = None,  # Placeholder for user settings
) -> Generator[str, Any, Any]:
    """
    Main function to generate a Commander deck from a user's collection and chosen commander.
    Returns a dictionary with the commander, deck, deck size, bracket info, and step debug logs.
    """

    # Live step log: 1. Starting deck generation
    yield json.dumps({"message": "[STEP 1] Starting deck generation"})
    yield json.dumps({"message": f"[STEP 2] Commander submitted: {commander.get('name')} (id={commander.get('id')}) | Bracket: {bracket} | House rules: {house_rules}"})

    try:
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
        if SUPABASE_URL is None or SUPABASE_SERVICE_KEY is None:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set."
            )
        lookup = CardLookup(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        # Decide if we need to canonicalize (anonymous/raw upload) or skip (enriched user)
        needs_canonicalization = any("scryfall_id" not in card for card in card_pool)
        if needs_canonicalization:
            user_card_names = set(card.get("name", "") for card in card_pool if card.get("name"))
            yield json.dumps({"message": f"[STEP 2a] Fetching only user's cards from Supabase ({len(user_card_names)} unique names)..."})
            # Use fetch_rows_by_field_values to get all cards with these names
            fetched_cards = lookup.fetch_rows_by_field_values(
                table="cards",
                field="name",
                values=user_card_names,
                select="id,name,printed_name,set,collector_number"
            )
            # Build a normalized name -> id(s) map
            name_to_ids: Dict[str, list[str]] = {}
            for c in fetched_cards:
                n = c.get("name")
                if n:
                    norm = normalize_name(n)
                    name_to_ids.setdefault(norm, []).append(str(c["id"]))
                pn = c.get("printed_name")
                if pn:
                    norm = normalize_name(pn)
                    name_to_ids.setdefault(norm, []).append(str(c["id"]))
            yield json.dumps({"message": "[STEP 2b] User card database loaded."})
            yield json.dumps({"message": "[STEP 2c] Canonicalizing card pool..."})
            canonical_pool: List[Dict[str, Any]] = []
            for card in card_pool:
                norm_name = normalize_name(card.get("name", ""))
                ids = name_to_ids.get(norm_name, [])
                if ids:
                    card["canonical_id"] = ids[0]
                canonical_pool.append(card)
            yield json.dumps({"message": f"[STEP 2d] Canonicalization complete. Pool size: {len(canonical_pool)}"})
        else:
            yield json.dumps({"message": "[STEP 2a] All cards have Scryfall IDs, skipping canonicalization."})
            canonical_pool = card_pool

        # Live step log: 3. Filter pool for color identity, legalities, and salt
        yield json.dumps({"message": "[STEP 3] Filtering card pool for color identity, legality, bracket, house rules, and salt..."})
        # Only fetch salt list and filter if salt_threshold < 15
        if salt_threshold < 15:
            if salt_list is None:
                yield json.dumps({"message": "[STEP 3a] Fetching salt list from Supabase..."})
                salt_list = fetch_salt_list_from_supabase(canonical_pool)
        else:
            salt_list = {}
            yield json.dumps({"message": "[STEP 3a] Salt filter disabled (threshold=15), skipping salt fetch."})
        filtered_pool = filter_card_pool(
            canonical_pool, commander, bracket, house_rules, salt_list, salt_threshold
        )
        yield json.dumps({"message": f"[STEP 4] Filtering complete. Pool size: {len(filtered_pool)} | Sample: {[c.get('name') for c in filtered_pool[:5]]}"})

        # Live step log: 5. Detect theme
        yield json.dumps({"message": "[STEP 5] Detecting deck theme..."})
        theme = detect_theme(commander, filtered_pool)
        yield json.dumps({"message": f"[STEP 6] Theme detected: {theme}"})

        # Live step log: 7. Categorize pool
        yield json.dumps({"message": "[STEP 7] Categorizing cards by function..."})
        categorized: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in CATEGORY_TARGETS}
        for card in filtered_pool:
            if "categories" not in card:
                card["categories"] = categorize_card(card)
            for cat in card["categories"]:
                if cat in categorized:
                    categorized[cat].append(card)
        yield json.dumps({"message": "[STEP 8] Categorization complete."})
        for cat, cards in categorized.items():
            yield json.dumps({"message": f"[STEP 9]   {cat}: {len(cards)} cards"})

        # Live step log: 10. Start with commander(s)
        deck = [commander]
        used_names = set([commander["name"]])
        used_ids = set([commander.get("id")])
        yield json.dumps({"message": f"[STEP 10] Starting deck with commander: {commander.get('name')} (id={commander.get('id')})"})

        # Live step log: 11. Commander functions (synergy)
        yield json.dumps({"message": "[STEP 11] Detecting commander functions (synergy)..."})
        commander_synergy = commander_functions(commander)
        yield json.dumps({"message": f"[STEP 12] Commander provides these deck functions: {commander_synergy}"})

        # 6. Select lands first
        _, max_lands = CATEGORY_TARGETS["lands"]
        num_lands = min(max_lands, 100 - len(deck))
        land_pool = categorized.get("lands", [])
        yield json.dumps({"message": f"[STEP 13] Selecting lands FIRST: need {num_lands}, pool size: {len(land_pool)}"})
        lands = select_lands(commander, land_pool, num_lands)
        yield json.dumps({"message": f"[STEP 14] Selected {len(lands)} lands: {[land.get('name') for land in lands[:5]]}{'...' if len(lands) > 5 else ''}"})
        land_add_idx = 1
        for land in lands:
            land_id = land.get("id")
            is_basic = "basic land" in (land.get("type_line", "").lower())
            count_in_deck = sum(1 for c in deck if c.get("id") == land_id)
            owned_qty = int(land.get("quantity", 1))
            if is_basic:
                if count_in_deck < owned_qty and len(deck) < 100:
                    deck.append(land)
                    yield json.dumps({"message": f"[STEP 15.{land_add_idx}]   Added basic land: {land.get('name')} (id={land_id}) [{count_in_deck+1}/{owned_qty}]"})
                    land_add_idx += 1
            else:
                if (
                    land["name"] not in used_names
                    and land_id not in used_ids
                    and len(deck) < 100
                ):
                    deck.append(land)
                    used_names.add(land["name"])
                    used_ids.add(land_id)
                    yield json.dumps({"message": f"[STEP 15.{land_add_idx}]   Added nonbasic land: {land.get('name')} (id={land_id})"})
                    land_add_idx += 1

        yield json.dumps({"message": f"[STEP 16] Deck size after lands: {len(deck)}"})
        yield json.dumps({"message": f"[STEP 17] Land count in deck: {sum(1 for c in deck if 'land' in (c.get('type_line','').lower()))}"})

        # 7. Mana curve fill
        curve_targets = get_mana_curve_targets(int(commander.get("cmc", 4)))
        yield json.dumps({"message": f"[STEP 18] Mana curve targets: {curve_targets}"})
        curve_add_idx = 1
        for cmc in range(1, 7):
            slot_cards = select_cards_for_curve_slot(
                filtered_pool,
                cmc,
                commander,
                int(commander.get("cmc", 4)),
                curve_targets,
                deviation=1,
                theme=theme,
            )
            for card in slot_cards:
                card_id = card.get("id")
                if card["name"] in used_names or card_id in used_ids:
                    continue
                deck.append(card)
                used_names.add(card["name"])
                used_ids.add(card_id)
                yield json.dumps({"message": f"[STEP 19.{curve_add_idx}] Added to mana curve slot {cmc}: {card.get('name')} (id={card_id})"})
                curve_add_idx += 1

        # 8. Mana rocks fill
        mana_rocks_target = curve_targets.get("mana_rocks", 0)
        yield json.dumps({"message": f"[STEP 20] Mana rocks target: {mana_rocks_target}"})
        mana_rocks_pool = [
            c
            for c in filtered_pool
            if "artifact" in str(c.get("type_line", "")).lower()
            and (
                "ramp" in str(c.get("keywords", [])).lower()
                or "mana" in str(c.get("keywords", [])).lower()
                or "mana" in str(c.get("type_line", "")).lower()
            )
            and (not house_rules or c.get("name", "").lower() != "sol ring")
            and c["name"] not in used_names
            and c.get("id") not in used_ids
        ]
        mana_rocks_pool = sorted(
            mana_rocks_pool,
            key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999
        )
        rocks_added = 0
        rocks_add_idx = 1
        for card in mana_rocks_pool:
            if rocks_added >= mana_rocks_target or len(deck) >= 100:
                break
            deck.append(card)
            used_names.add(card["name"])
            used_ids.add(card.get("id"))
            rocks_added += 1
            yield json.dumps({"message": f"[STEP 20.{rocks_add_idx}] Added mana rock: {card.get('name')} (id={card.get('id')})"})
            rocks_add_idx += 1

        # 9. Adjust land count based on curve targets
        land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
        target_lands = curve_targets.get("lands", len(land_cards))
        yield json.dumps({"message": f"[STEP 21] Target lands from curve: {target_lands}, current: {len(land_cards)}"})
        trim_land_idx = 1
        while len(land_cards) > target_lands:
            to_remove = sorted(
                land_cards, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999, reverse=True
            )[0]
            deck.remove(to_remove)
            used_names.discard(to_remove.get("name"))
            used_ids.discard(to_remove.get("id"))
            yield json.dumps({"message": f"[STEP 21.{trim_land_idx}]   Trimmed land: {to_remove.get('name')}"})
            trim_land_idx += 1
            land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
        land_pool: List[Dict[str, Any]] = [
            c
            for c in filtered_pool
            if "land" in str(c.get("type_line", "")).lower()
            and c["name"] not in used_names
            and c.get("id") not in used_ids
        ]
        land_pool = sorted(land_pool, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999)
        fill_land_idx = 1
        while len(land_cards) < target_lands and land_pool and len(deck) < 100:
            best: Dict[str, Any] = land_pool[0]
            deck.append(best)
            used_names.add(best.get("name", ""))  # safer than best["name"]
            used_ids.add(best.get("id", ""))  # safer than best.get("id")
            yield json.dumps({"message": f"[STEP 21.{fill_land_idx + trim_land_idx - 1}]   Filled land: {best.get('name', '')}"})
            fill_land_idx += 1
            land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
            land_pool = [
                c
                for c in land_pool
                if c.get("name", "") not in used_names
                and str(c.get("id", "")) not in used_ids
            ]

        # 10. Strict category fill
        yield json.dumps({"message": "[STEP 22] Strictly filling categories with theme/synergy priority and type targets..."})
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
            card_text = (
                card.get("type_line", "").lower()
                + " "
                + " ".join([str(k).lower() for k in card.get("keywords", [])])
            )
            return any(tc for tc in candidates if tc and len(tc) > 2 and tc in card_text)

        def get_type(card: Dict[str, Any]) -> str:
            type_line = str(card.get("type_line", "")).lower()
            for t in [
                "creature",
                "sorcery",
                "instant",
                "enchantment",
                "artifact",
                "planeswalker",
                "land",
            ]:
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

        def type_targets_met(deck: List[Dict[str, Any]]) -> bool:
            return all(type_counts(deck)[t] >= CARD_TYPE_TARGETS[t] for t in CARD_TYPE_TARGETS)
        cat_idx = 1
        for cat, (min_count, max_count) in CATEGORY_TARGETS.items():
            if cat == "lands":
                continue
            yield json.dumps({"message": f"[STEP 22.{cat_idx}] Strictly filling category '{cat}' (min={min_count}, max={max_count}) with theme/synergy priority and type targets (strict)"})
            pool = categorized.get(cat, [])
            theme_cat = [c for c in pool if card_matches_theme(c, theme_candidates)]
            synergy_cat = [
                c for c in pool if cat in commander_synergy and c not in theme_cat
            ]
            rest_cat = [c for c in pool if c not in theme_cat and c not in synergy_cat]
            rest_cat = sorted(rest_cat, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999)
            prioritized = theme_cat + synergy_cat + rest_cat
            count = 0
            type_priority_idx = 1
            overflow_idx = 1
            min_fill_idx = 1
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
                        continue
                    if bracket == 3 and card.get("game_changer", False):
                        if sum(1 for c in deck if c.get("game_changer", False)) >= 3:
                            continue
                    deck.append(card)
                    used_names.add(card["name"])
                    used_ids.add(card_id)
                    count += 1
                    yield json.dumps({"message": f"[STEP 22.{cat_idx}.{type_priority_idx}] (type-priority) Added to '{cat}' (type {t}): {card.get('name')} (id={card_id})"})
                    type_priority_idx += 1
                    found = True
                    break
                if not found:
                    break
            while count < max_count and len(deck) < 100 and type_targets_met(deck):
                found = False
                for card in prioritized:
                    card_id = card.get("id")
                    if card["name"] in used_names or card_id in used_ids:
                        continue
                    t = get_type(card)
                    if bracket == 3 and card.get("game_changer", False):
                        if sum(1 for c in deck if c.get("game_changer", False)) >= 3:
                            continue
                    deck.append(card)
                    used_names.add(card["name"])
                    used_ids.add(card_id)
                    count += 1
                    yield json.dumps({"message": f"[STEP 22.{cat_idx}.{overflow_idx}] (overflow) Added to '{cat}' (type {t}): {card.get('name')} (id={card_id})"})
                    overflow_idx += 1
                    found = True
                    break
                if not found:
                    break
            while count < min_count and len(deck) < 100:
                for card in prioritized:
                    card_id = card.get("id")
                    if card["name"] in used_names or card_id in used_ids:
                        continue
                    if bracket == 3 and card.get("game_changer", False):
                        if sum(1 for c in deck if c.get("game_changer", False)) >= 3:
                            continue
                    deck.append(card)
                    used_names.add(card["name"])
                    used_ids.add(card_id)
                    count += 1
                    t = get_type(card)
                    yield json.dumps({"message": f"[STEP 22.{cat_idx}.{min_fill_idx}] (min fill) Added to '{cat}' (type {t}): {card.get('name')} (id={card_id})"})
                    min_fill_idx += 1
                    break
                else:
                    break
            cat_idx += 1

        # 11. Final type enforcement
        type_count = type_counts(deck)
        final_type_idx = 1
        for t, target in CARD_TYPE_TARGETS.items():
            while type_count[t] < target and len(deck) < 99:
                candidates: List[Dict[str, Any]] = [
                    c
                    for c in filtered_pool
                    if c["name"] not in used_names
                    and c.get("id") not in used_ids
                    and get_type(c) == t
                ]
                if not candidates:
                    break
                best = sorted(candidates, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999)[0]  # type: ignore
                if bracket == 3 and best.get("game_changer", False):
                    if sum(1 for c in deck if c.get("game_changer", False)) >= 3:
                        continue
                deck.append(best)
                used_names.add(best["name"])
                used_ids.add(best.get("id"))
                type_count[t] += 1
                yield json.dumps({"message": f"[STEP 23.{final_type_idx}] (final type fill) Added {best.get('name')} to meet type target {t} ({type_count[t]}/{target})"})
                final_type_idx += 1

        # 12. Fill main theme (if not already filled)
        if "main_theme" in CATEGORY_TARGETS:
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
                card_text = (
                    card.get("type_line", "").lower()
                    + " "
                    + " ".join([str(k).lower() for k in card.get("keywords", [])])
                )
                return any(
                    tc for tc in candidates if tc and len(tc) > 2 and tc in card_text
                )

            theme_pool = [
                c for c in filtered_pool if card_matches_theme(c, theme_candidates)
            ]
            theme_pool = sorted(theme_pool, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999)
            theme_added = 0
            theme_synergy_idx = 1
            for card in theme_pool:
                if card["name"] in used_names or len(deck) >= 100:
                    continue
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
                    if bracket == 3 and card.get("game_changer", False):
                        if sum(1 for c in deck if c.get("game_changer", False)) >= 3:
                            continue
                    deck.append(card)
                    used_names.add(card["name"])
                    theme_added += 1
                    yield json.dumps({"message": f"[STEP 24.{theme_synergy_idx}] Added theme/synergy card: {card.get('name')} (id={card.get('id')})"})
                    theme_synergy_idx += 1
            yield json.dumps({"message": f"[STEP 24] Added {theme_added} theme/synergy cards (without exceeding category maxes)"})

        # 13. Final enforcement: Ensure all CATEGORY_TARGETS are respected
        def trim_category(deck: List[Dict[str, Any]], cat: str, max_count: int):
            trimmed = False
            trim_idx = 1
            while True:
                cat_cards = [
                    c for c in deck if "categories" in c and cat in c["categories"]
                ]
                if len(cat_cards) <= max_count:
                    break
                to_remove = sorted(
                    cat_cards, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999, reverse=True
                )[0]
                deck.remove(to_remove)
                trimmed = True
                yield json.dumps({"message": f"[STEP 25.{cat}.{trim_idx}]   Trimmed {cat}: {to_remove.get('name')}"})
                trim_idx += 1
            return trimmed

        def fill_category(
            deck: List[Dict[str, Any]],
            cat: str,
            min_count: int,
            pool: List[Dict[str, Any]],
            used_names: Set[str],
            used_ids: Set[Any],
        ):
            added = False
            fill_idx = 1
            while True:
                cat_cards = [
                    c for c in deck if "categories" in c and cat in c["categories"]
                ]
                if len(cat_cards) >= min_count:
                    break
                candidates = [
                    c
                    for c in pool
                    if "categories" in c
                    and cat in c["categories"]
                    and c["name"] not in used_names
                    and c.get("id") not in used_ids
                ]
                if not candidates:
                    break
                best = sorted(candidates, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999)[0]
                if bracket == 3 and best.get("game_changer", False):
                    if sum(1 for c in deck if c.get("game_changer", False)) >= 3:
                        continue
                deck.append(best)
                used_names.add(best["name"])
                used_ids.add(best.get("id"))
                added = True
                yield json.dumps({"message": f"[STEP 25.{cat}.{fill_idx}]   Filled {cat}: {best.get('name')}"})
                fill_idx += 1
            return added

        for cat, (min_count, max_count) in CATEGORY_TARGETS.items():
            if cat == "lands":
                continue
            for msg in trim_category(deck, cat, max_count):
                yield json.dumps({"message": msg})
        for cat, (min_count, max_count) in CATEGORY_TARGETS.items():
            if cat == "lands":
                continue
            for msg in fill_category(
                deck, cat, min_count, filtered_pool, used_names, used_ids
            ):
                yield json.dumps({"message": msg})

        # 14. Enforce land count strictly
        land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
        min_lands, max_lands = CATEGORY_TARGETS["lands"]
        land_trim_idx = 1
        while len(land_cards) > max_lands:
            to_remove = sorted(
                land_cards, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999, reverse=True
            )[0]
            deck.remove(to_remove)
            yield json.dumps({"message": f"[STEP 26.{land_trim_idx}]   Trimmed land: {to_remove.get('name')}"})
            land_trim_idx += 1
            land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
        land_pool = [
            c
            for c in filtered_pool
            if "land" in str(c.get("type_line", "")).lower()
            and c["name"] not in used_names
            and c.get("id") not in used_ids
        ]
        land_fill_idx = 1
        while len(land_cards) < min_lands and land_pool:
            best = sorted(land_pool, key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999)[0]
            deck.append(best)
            used_names.add(best["name"])
            used_ids.add(best.get("id"))
            yield json.dumps({"message": f"[STEP 26.{land_fill_idx + land_trim_idx - 1}]   Filled land: {best.get('name')}"})
            land_fill_idx += 1
            land_cards = [c for c in deck if "land" in str(c.get("type_line", "")).lower()]
            land_pool = [
                c
                for c in land_pool
                if "land" in str(c.get("type_line", "")).lower()
                and c["name"] not in used_names
                and c.get("id") not in used_ids
            ]

        # 15. Final fill: Fill to 99 cards (excluding commander)
        final_fill_idx = 1
        while len(deck) < 99:
            candidates: List[Dict[str, Any]] = [
                c
                for c in filtered_pool
                if c["name"] not in used_names and c.get("id") not in used_ids
            ]
            valid_candidates: List[Dict[str, Any]] = []
            type_count = type_counts(deck)
            under_types = {t for t, v in type_count.items() if v < CARD_TYPE_TARGETS[t]}
            for c in candidates:
                if "categories" not in c:
                    c["categories"] = categorize_card(c)
                cats = c["categories"]
                can_add = True
                for cat in cats:
                    if cat in CATEGORY_TARGETS:
                        _, max_count = CATEGORY_TARGETS[cat]
                        cat_count = sum(
                            1 for d in deck if "categories" in d and cat in d["categories"]
                        )
                        if cat_count >= max_count:
                            can_add = False
                            break
                if not can_add:
                    continue
                t = get_type(c)
                if under_types and t not in under_types:
                    continue
                valid_candidates.append(c)
            if not valid_candidates:
                yield json.dumps({"message": f"[STEP 27]   No valid candidates left to fill deck to 99. Deck size: {len(deck)}"})
                break
            best: Dict[str, Any] = sorted(
                valid_candidates, 
                key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999
            )[0]
            if bracket == 3 and best.get("game_changer", False):
                if sum(1 for c in deck if c.get("game_changer", False)) >= 3:
                    continue
            deck.append(best)
            used_names.add(best["name"])
            used_ids.add(best.get("id"))
            t = get_type(best)
            yield json.dumps({"message": f"[STEP 27.{final_fill_idx}]   Final fill: {best.get('name')} (type {t})"})
            final_fill_idx += 1

        # 16. Final trim if deck is over 99 (excluding commander)
        final_trim_idx = 1
        while len(deck) > 99:
            non_essential = [
                c
                for c in deck
                if "land" not in str(c.get("type_line", "")).lower()
                and "creature" not in str(c.get("type_line", "")).lower()
            ]
            if non_essential:
                to_remove = sorted(
                    non_essential, 
                    key=lambda c: c["edhrec_rank"] if isinstance(c.get("edhrec_rank"), (int, float)) and c.get("edhrec_rank") is not None else 999999
                )[0]
                deck.remove(to_remove)
                yield json.dumps({"message": f"[STEP 28.{final_trim_idx}]   Final trim: {to_remove.get('name')}"})
                final_trim_idx += 1
            else:
                deck.pop()
                yield json.dumps({"message": f"[STEP 28.{final_trim_idx}]   Final trim: removed last card"})
                final_trim_idx += 1

        yield json.dumps({"message": f"[STEP 29] Final deck size: {len(deck)} (should be 99 + commander)"})
        yield json.dumps({"message": f"[STEP 29] Final land count: {sum(1 for c in deck if 'land' in (c.get('type_line','').lower()))}"})

        # Prepare deck_dict for final event yield json.dumps({"message":

        def convert_sets(obj: Any) -> Any:
            if isinstance(obj, set):
                return list(obj)  # type: ignore
            elif isinstance(obj, dict):
                return dict((str(k), convert_sets(v)) for k, v in obj.items())   # type: ignore
            elif isinstance(obj, list):
                return [convert_sets(v) for v in obj]  # type: ignore
            else:
                return obj

        deck_dict: Dict[str, Any] = {
            "commander": convert_sets(commander),
            "cards": convert_sets(deck),
            "deck_size": len(deck),
            "total_cards": len(deck) + 1,
            "bracket": bracket,
            "theme": theme,
        }

        # Yield the final deck dictionary as a JSON object
        return json.dumps({"deck": deck_dict})
    except Exception as e:
        logger.error("Exception in generate_commander_deck", error=str(e), traceback=traceback.format_exc())
        return json.dumps({"error": f"Exception in deck generation: {str(e)}", "traceback": traceback.format_exc()})