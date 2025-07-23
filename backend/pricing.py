import os
import json
from backend.supabase_db import db
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from typing import List, Dict, Any

router = APIRouter()

async def enrich_collection_with_prices(collection: List[Dict[str, Any]], source: str = "tcgplayer") -> List[Dict[str, Any]]:
    """
    Enrich a collection of cards with price data from the price_cache table or external source.
    Each card dict should get a 'price_data' field with at least 'market_price'.
    """

    enriched: List[Dict[str, Any]] = []
    for card in collection:
        card_name: str = str(card.get('name', ''))
        set_code: str = str(card.get('set', ''))
        price_row = await db.execute_query_one(
            '''SELECT * FROM price_cache WHERE card_name = %s AND set_code = %s AND source = %s ORDER BY last_updated DESC LIMIT 1''',
            (card_name, set_code, source)
        )
        if price_row:
            card['price_data'] = {
                'market_price': float(price_row.get('market_price', 0.0)),
                'low_price': float(price_row.get('low_price', 0.0)),
                'high_price': float(price_row.get('high_price', 0.0)),
                'currency': str(price_row.get('currency', 'USD')),
                'source': source,
                'last_updated': str(price_row.get('last_updated', ''))
            }
        else:
            card['price_data'] = {'market_price': 0.0, 'currency': 'USD', 'source': source, 'last_updated': ''}
        enriched.append(card)
    return enriched

def calculate_collection_value(collection: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Calculate total value and breakdowns for a collection of cards with price_data.
    Returns: { total_value, by_rarity, by_set, by_color, ... }
    """
    total_value: float = 0.0
    by_rarity: dict[str, float] = {}
    by_set: dict[str, float] = {}
    by_color: dict[str, float] = {}
    for card in collection:
        price: float = 0.0
        qty: float = float(card.get('quantity', 1))
        price_data = card.get('price_data', {})
        market_price = price_data['market_price'] if isinstance(price_data, dict) and 'market_price' in price_data else None  # type: ignore
        if market_price is not None:
            price = float(market_price)  # type: ignore
        value: float = price * qty
        total_value += value
        rarity: str = str(card.get('rarity', 'Unknown'))
        by_rarity[rarity] = by_rarity.get(rarity, 0.0) + value
        set_name: str = str(card.get('set', 'Unknown'))
        by_set[set_name] = by_set.get(set_name, 0.0) + value
        color_identity = card.get('color_identity', [])
        color: str = ','.join([str(c) for c in color_identity]) if isinstance(color_identity, list) else 'Colorless'  # type: ignore
        by_color[color] = by_color.get(color, 0.0) + value
    return {
        'total_value': total_value,
        'by_rarity': by_rarity,
        'by_set': by_set,
        'by_color': by_color
    }

@dataclass
class Event:
    name: str
    type: str
    date: str
    format: str
@dataclass
class Deck:
    id: str
    name: str
    format: str
    event: str = ''
    event_date: str = ''
    win_count: int = 0
    card_list: List[Dict[str, Any]] = field(default_factory=list)  # type: ignore
    source: str = ''
    source: str = ''

# --- Config ---
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
DECKS_JSON = os.path.join(DATA_DIR, 'tournament_decks_mtggoldfish.json')

# --- Helper: Load decks from JSON ---
def load_decks() -> list[Deck]:
    if not os.path.exists(DECKS_JSON):
        return []
    with open(DECKS_JSON, 'r', encoding='utf-8') as f:
        raw = json.load(f)
    decks: list[Deck] = []
    for d in raw:
        decks.append(Deck(
            id=str(d.get('id', d.get('source', ''))),
            name=str(d.get('name', '')),
            format=str(d.get('format', ''))
        ))
        # Set additional fields if present
        deck = decks[-1]
        if 'event' in d:
            setattr(deck, 'event', d.get('event', ''))
        if 'event_date' in d:
            setattr(deck, 'event_date', d.get('event_date'))
        if 'win_count' in d:
            setattr(deck, 'win_count', d.get('win_count'))
        if 'card_list' in d:
            setattr(deck, 'card_list', d.get('card_list', []))
        if 'source' in d:
            setattr(deck, 'source', d.get('source', ''))
    return decks

# --- Analytics Endpoints ---
@router.get("/api/analytics/cei")
async def analytics_cei():
    decks = load_decks()
    card_stats: dict[str, dict[str, Any]] = {}
    for deck in decks:
        seen: set[str] = set()
        for card in deck.card_list:
            name = str(card.get('name', '')).strip()
            if not name or name in seen:
                continue
            seen.add(name)
            if name not in card_stats:
                card_stats[name] = { 'name': name, 'decks_containing': 0, 'win_count': 0, 'price': 0.0 }
            card_stats[name]['decks_containing'] += 1
            if deck.win_count:
                card_stats[name]['win_count'] += int(deck.win_count)
    # Use Supabase price_cache for pricing
    for name, stat in card_stats.items():
        price_row: Optional[dict[str, Any]] = await db.execute_query_one(
            '''SELECT * FROM price_cache WHERE card_name = %s ORDER BY last_updated DESC LIMIT 1''',
            (name,)
        )
        stat['price'] = float(price_row['market_price']) if price_row and price_row.get('market_price') is not None else 0.0
        stat['cei'] = (stat['decks_containing'] / stat['price']) if stat['price'] else None
    result = sorted(card_stats.values(), key=lambda x: (float(x['cei']) if x['cei'] is not None else 0, x['decks_containing']), reverse=True)
    return JSONResponse(result)

@router.get("/api/analytics/deck-cost-to-win")
async def analytics_deck_cost_to_win():
    decks = load_decks()
    results: list[dict[str, Any]] = []
    for deck in decks:
        total_price: float = 0.0
        for card in deck.card_list:
            card_name: str = str(card.get('name', ''))
            set_code: str = str(card.get('set', ''))
            price_row: Optional[dict[str, Any]] = await db.execute_query_one(
                '''SELECT * FROM price_cache WHERE card_name = %s AND set_code = %s ORDER BY last_updated DESC LIMIT 1''',
                (card_name, set_code)
            )
            price: float = float(price_row['market_price']) if price_row and price_row.get('market_price') is not None else 0.0
            qty: float = float(card.get('quantity', 1))
            total_price += price * qty
        cost_to_win: Optional[float] = (total_price / deck.win_count) if deck.win_count else None
        results.append({
            'id': deck.id,
            'name': deck.name,
            'event': deck.event,
            'event_date': deck.event_date,
            'win_count': deck.win_count,
            'total_price': total_price,
            'cost_to_win': cost_to_win
        })
    results = sorted(results, key=lambda x: (float(x['cost_to_win']) if x['cost_to_win'] is not None else float('inf')))  # type: ignore
    return JSONResponse(results)

@router.get("/api/analytics/investment-watch")
async def analytics_investment_watch():
    decks = load_decks()
    card_names: set[str] = set()
    for deck in decks:
        for card in deck.card_list:
            card_names.add(card.get('name', '').strip())
    investment_data: list[dict[str, Any]] = []
    for name in card_names:
        price_row: Optional[dict[str, Any]] = await db.execute_query_one(
            '''SELECT * FROM price_cache WHERE card_name = %s ORDER BY last_updated DESC LIMIT 1''',
            (name,)
        )
        price: float = float(price_row['market_price']) if price_row and price_row.get('market_price') is not None else 0.0
        investment_data.append({'name': name, 'latest_price': price})
    return JSONResponse(investment_data)

@router.get("/api/analytics/pack-set-analysis")
async def analytics_pack_set_analysis():
    decks = load_decks()
    set_stats: dict[str, dict[str, Any]] = {}
    for deck in decks:
        for card in deck.card_list:
            set_name = str(card.get('set', 'Unknown'))
            rarity = str(card.get('rarity', 'Unknown'))
            if set_name not in set_stats:
                set_stats[set_name] = {'total': 0, 'rarity': {}}
            set_stats[set_name]['total'] += 1
            if rarity not in set_stats[set_name]['rarity']:
                set_stats[set_name]['rarity'][rarity] = 0
            set_stats[set_name]['rarity'][rarity] += 1
    return JSONResponse(set_stats)