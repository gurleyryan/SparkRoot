
import json
import re
from typing import List, Dict, Any, Tuple, Optional, Union
from supabase import create_client, Client

"""
CardLookup: Robust, reusable class for fetching and matching cards from a large Supabase Scryfall table.
Features:
- Cursor-based pagination for reliability with large tables
- Name normalization (handles reprints, alternates, card faces)
- Fast lookup and fuzzy matching
- Optional diagnostics for debugging and data quality
"""



# --- Normalization Utilities ---
def normalize_name(name: Optional[str]) -> str:
    """
    Normalize a card name for matching: lowercase, remove punctuation, strip whitespace.
    """
    if name is None:
        return ""
    return re.sub(r"[^a-z0-9 ]", "", str(name).lower().strip())

def normalize_set_code(set_code: Union[str, None]) -> str:
    """
    Normalize set code: lowercase, strip whitespace, handle common aliases.
    """
    if not set_code:
        return ""
    code = set_code.lower().strip()
    # Add alias handling if needed (e.g., promo sets)
    aliases = {
        "plst": "plist",  # Example alias
    }
    return aliases.get(code, code)

def normalize_collector_number(collector_number: Union[str, int, None]) -> str:
    """
    Normalize collector number: always convert to string, lowercase, strip whitespace, remove leading zeros, handle tokens/emblems.
    """
    if collector_number is None:
        return ""
    num = str(collector_number).lower().strip()
    # Remove leading zeros (but preserve non-numeric parts)
    match = re.match(r"(\d+)(.*)", num)
    if match:
        digits, rest = match.groups()
        digits = str(int(digits))  # Remove leading zeros
        num = digits + rest
    # Remove token/emblem suffixes for fallback
    num = num.replace("token", "").replace("emblem", "").strip()
    return num


class CardLookup:
    def fetch_rows_by_field_values(
        self,
        table: str,
        field: str,
        values: set[Any],
        select: str = "*",
        page_size: int = 100,
        order_field: str = "id",
        diagnostics: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Generic cursor-based pagination for any table/field.
        Args:
            table: Table name (e.g., "cards", "user_cards")
            field: Field to match (e.g., "name", "card_id", "user_id")
            values: Set of values to match (batched with .in_())
            select: Columns to select (default "*")
            page_size: Batch size
            order_field: Field to use for cursor pagination (must be unique and ordered)
            diagnostics: Print debug info
        Returns: List of matching rows
        """
        self.connect()
        if self.supabase is None:
            raise RuntimeError("Supabase client is not initialized.")
        all_rows: List[Dict[str, Any]] = []
        values_list = list(values)
        total = len(values_list)
        import time
        import postgrest
        for i in range(0, total, page_size):
            batch = values_list[i : i + page_size]
            attempt = 0
            max_attempts = 3
            while attempt < max_attempts:
                try:
                    query = (
                        self.supabase.table(table)
                        .select(select)
                        .in_(field, batch)
                        .order(order_field)
                    )
                    resp = query.execute()
                    rows = resp.data or []
                    if diagnostics:
                        print(f"Fetched {len(rows)} rows from {table} for {field} in batch {i // page_size + 1}")
                    all_rows.extend(rows)
                    break
                except postgrest.exceptions.APIError as e:
                    print(f"[CardLookup] Supabase APIError on batch {i // page_size + 1}: {e}")
                    attempt += 1
                    if attempt < max_attempts:
                        time.sleep(2 * attempt)
                    else:
                        print(f"[CardLookup] Failed after {max_attempts} attempts for batch {i // page_size + 1}. Retrying individually.")
                        # Instead of skipping, try each value individually
                        for value in batch:
                            single_attempt = 0
                            while single_attempt < max_attempts:
                                try:
                                    single_query = (
                                        self.supabase.table(table)
                                        .select(select)
                                        .in_(field, [value])
                                        .order(order_field)
                                    )
                                    single_resp = single_query.execute()
                                    single_rows = single_resp.data or []
                                    if diagnostics:
                                        print(f"Fetched {len(single_rows)} rows from {table} for {field}={value}")
                                    all_rows.extend(single_rows)
                                    break
                                except postgrest.exceptions.APIError as single_e:
                                    print(f"[CardLookup] Supabase APIError for value {value}: {single_e}")
                                    single_attempt += 1
                                    if single_attempt < max_attempts:
                                        time.sleep(2 * single_attempt)
                                    else:
                                        print(f"[CardLookup] Failed after {max_attempts} attempts for value {value}. Skipping this value.")
                                        break
                        break
        return all_rows
    """
    CardLookup provides robust, reusable card lookup and matching for large Scryfall tables.
    Usage:
        lookup = CardLookup(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        lookup.fetch_all_cards(diagnostics=True)
        ids = lookup.lookup('Lightning Bolt')
    """

    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase: Optional[Client] = None
        self.card_id_map: Optional[Dict[str, List[str]]] = None
        self.card_list: Optional[List[Dict[str, Any]]] = None
        self.name_set_collector_map: Optional[Dict[Tuple[str, str, str], str]] = None

    def connect(self):
        """Ensure Supabase client is initialized."""
        if not self.supabase:
            self.supabase = create_client(self.supabase_url, self.supabase_key)
        if not self.supabase:
            raise RuntimeError("Failed to initialize Supabase client.")

    def fetch_all_cards(
        self, page_size: int = 100, diagnostics: bool = False
    ) -> Tuple[Dict[str, List[str]], List[Dict[str, Any]], Dict[Tuple[str, str, str], str]]:
        """
        Fetch all cards from Supabase using cursor-based pagination.
        Builds a normalized name → id(s) map and stores the full card list.
        Set diagnostics=True for printouts and data checks.
        """
        self.connect()
        if self.supabase is None:
            raise RuntimeError("Supabase client is not initialized.")
        cards: List[Dict[str, Any]] = []
        last_id = None
        page = 0
        while True:
            query = (
                self.supabase.table("cards")
                .select("id,name,printed_name,card_faces,set,collector_number")
                .order("id")
            )
            if last_id is not None:
                query = query.gte("id", last_id)
            resp = query.limit(page_size + 1).execute()
            data = resp.data
            if diagnostics:
                print(f"Page {page}: fetched {len(data) if data else 0} rows")
            if not data:
                break
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
        cards = list(unique_cards.values())
        if diagnostics:
            print(f"Total cards fetched from Supabase (raw): {len(cards)}")
            print(f"Total unique card IDs after deduplication: {len(unique_cards)}")
        # Map: normalized name -> list of ids
        name_to_ids: Dict[str, List[str]] = {}
        name_set_collector_map: Dict[Tuple[str, str, str], str] = {}
        for c in cards:
            id_ = c.get("id")
            if not id_:
                continue
            set_code = normalize_set_code(c.get("set", ""))
            collector_number = normalize_collector_number(c.get("collector_number", ""))
            names: set[str] = set()
            for key in ["name", "printed_name"]:
                n = c.get(key)
                if n:
                    names.add(normalize_name(n))
            faces = c.get("card_faces")
            if faces and isinstance(faces, str):
                try:
                    faces = json.loads(faces)
                except Exception:
                    faces = None
            if faces and isinstance(faces, list):
                for face in faces:  # type: ignore
                    if isinstance(face, dict):
                        face_name = face.get("name")  # type: ignore
                        if isinstance(face_name, str) and face_name:
                            names.add(normalize_name(face_name))
            for n in names:
                name_to_ids.setdefault(n, []).append(id_)
                # Composite key map
                if set_code and collector_number:
                    name_set_collector_map[(n, set_code, collector_number)] = id_
        self.card_id_map = name_to_ids
        self.card_list = cards
        self.name_set_collector_map = name_set_collector_map
        if diagnostics:
            print(f"Total normalized names in card_id_map: {len(name_to_ids)}")
            print(f"Sample normalized names: {list(name_to_ids.keys())[:20]}")
            print(f"Total composite keys in name_set_collector_map: {len(name_set_collector_map)}")
            print(f"Sample composite keys: {list(name_set_collector_map.keys())[:10]}")
            # Diagnostic: print sample composite keys for major sets
            major_sets = ["dom", "grn", "m19", "rna", "war", "gk2"]
            for set_code in major_sets:
                keys_for_set = [k for k in name_set_collector_map.keys() if k[1] == set_code]
                print(f"Set '{set_code}': {len(keys_for_set)} composite keys")
                print(f"Sample for '{set_code}': {keys_for_set[:10]}")
        return name_to_ids, cards, name_set_collector_map

    def lookup_by_name_set_collector(self, name: str, set_code: str, collector_number: str) -> Optional[str]:
        """
        Return card_id for composite key (normalized_name, set, collector_number).
        """
        if self.name_set_collector_map is None:
            raise RuntimeError("Card data not loaded. Call fetch_all_cards() first.")
        key = (
            normalize_name(name),
            normalize_set_code(set_code),
            normalize_collector_number(collector_number),
        )
        return self.name_set_collector_map.get(key)


    def lookup(self, name: str) -> List[str]:
        """
        Return all card ids matching the normalized name (handles reprints/alternates).
        """
        if self.card_id_map is None:
            raise RuntimeError("Card data not loaded. Call fetch_all_cards() first.")
        return self.card_id_map.get(normalize_name(name), [])


    def fuzzy_lookup(self, name: str, n: int = 3, cutoff: float = 0.7) -> List[str]:
        """
        Return a list of close matches for the normalized name (for diagnostics or user suggestions).
        """
        import difflib
        if self.card_id_map is None:
            raise RuntimeError("Card data not loaded. Call fetch_all_cards() first.")
        norm_name = normalize_name(name)
        return difflib.get_close_matches(
            norm_name, list(self.card_id_map.keys()), n=n, cutoff=cutoff
        )

    def robust_lookup(self, name: str, set_code: str, collector_number: str, diagnostics: bool = False) -> Dict[str, Any]:
        """
        Robustly match a card using composite key, then fallback to name, then fuzzy match.
        Returns a dict with match status, card_id, and diagnostics for frontend/user correction.
        """
        result: Dict[str, Any] = {
            "match_status": "not_found",
            "card_id": None,
            "method": None,
            "diagnostics": {},
        }
        norm_name = normalize_name(name)
        norm_set = normalize_set_code(set_code)
        norm_collector = normalize_collector_number(collector_number)
        # 1. Composite key lookup
        if self.name_set_collector_map is not None:
            key = (norm_name, norm_set, norm_collector)
            card_id = self.name_set_collector_map.get(key)
            if card_id:
                result["match_status"] = "composite_key"
                result["card_id"] = card_id
                result["method"] = "composite_key"
                return result
            # 2. Fallback: try with original collector number (no normalization)
            fallback_key = (norm_name, norm_set, collector_number.lower().strip())
            card_id = self.name_set_collector_map.get(fallback_key)
            if card_id:
                result["match_status"] = "fallback_collector"
                result["card_id"] = card_id
                result["method"] = "fallback_collector"
                return result
            # 3. Fallback: try with original set code (no normalization)
            fallback_key2 = (norm_name, set_code.lower().strip(), norm_collector)
            card_id = self.name_set_collector_map.get(fallback_key2)
            if card_id:
                result["match_status"] = "fallback_set"
                result["card_id"] = card_id
                result["method"] = "fallback_set"
                return result
        # 4. Name-only lookup
        if self.card_id_map is not None:
            ids = self.card_id_map.get(norm_name, [])
            if ids:
                result["match_status"] = "name_only"
                result["card_id"] = ids[0]
                result["method"] = "name_only"
                if diagnostics:
                    result["diagnostics"]["name_only_ids"] = ids
                return result
            # 5. Fuzzy match
            fuzzy_matches = self.fuzzy_lookup(name, n=3, cutoff=0.7)
            if fuzzy_matches:
                match_name = fuzzy_matches[0]
                match_ids = self.card_id_map.get(match_name, [])
                if match_ids:
                    result["match_status"] = "fuzzy"
                    result["card_id"] = match_ids[0]
                    result["method"] = "fuzzy"
                    if diagnostics:
                        result["diagnostics"]["fuzzy_matches"] = fuzzy_matches
                    return result
        # 6. Not found
        if diagnostics:
            result["diagnostics"]["input"] = {
                "name": name,
                "set_code": set_code,
                "collector_number": collector_number,
                "norm_name": norm_name,
                "norm_set": norm_set,
                "norm_collector": norm_collector,
            }
        return result