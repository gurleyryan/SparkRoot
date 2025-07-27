import json
import re
from typing import List, Dict, Any, Tuple, Optional
from supabase import create_client, Client

"""
CardLookup: Robust, reusable class for fetching and matching cards from a large Supabase Scryfall table.
Features:
- Cursor-based pagination for reliability with large tables
- Name normalization (handles reprints, alternates, card faces)
- Fast lookup and fuzzy matching
- Optional diagnostics for debugging and data quality
"""


def normalize_name(name: str) -> str:
    """
    Normalize a card name for matching: lowercase, remove punctuation, strip whitespace.
    """
    return re.sub(r"[^a-z0-9 ]", "", name.lower().strip())


class CardLookup:
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

    def connect(self):
        """Ensure Supabase client is initialized."""
        if not self.supabase:
            self.supabase = create_client(self.supabase_url, self.supabase_key)
        if not self.supabase:
            raise RuntimeError("Failed to initialize Supabase client.")

    def fetch_all_cards(
        self, page_size: int = 100, diagnostics: bool = False
    ) -> Tuple[Dict[str, List[str]], List[Dict[str, Any]]]:
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
        for c in cards:
            id_ = c.get("id")
            if not id_:
                continue
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
        self.card_id_map = name_to_ids
        self.card_list = cards
        if diagnostics:
            print(f"Total normalized names in card_id_map: {len(name_to_ids)}")
            print(f"Sample normalized names: {list(name_to_ids.keys())[:20]}")
        return name_to_ids, cards

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
