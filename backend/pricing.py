import os
import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from .tcgcsv_price_lookup import get_tcgcsv_price_for_card, load_tcgcsv_products_csv

router = APIRouter()

# --- Collection Pricing Helpers ---

async def enrich_collection_with_prices(collection: list, source: str = "tcgplayer") -> list:
    """
    Enrich a collection of cards with price data from the price_cache table or external source.
    Each card dict should get a 'price_data' field with at least 'market_price'.
    """
    # Import db here to avoid circular import
    from backend.supabase_db import db
    enriched = []
    for card in collection:
        card_name = card.get('name')
        set_code = card.get('set', '')
        # Try to get cached price
        price_row = await db.execute_query_one(
            '''SELECT * FROM price_cache WHERE card_name = %s AND set_code = %s AND source = %s ORDER BY last_updated DESC LIMIT 1''',
            (card_name, set_code, source)
        )
        if price_row:
            card['price_data'] = {
                'market_price': price_row.get('market_price'),
                'low_price': price_row.get('low_price'),
                'high_price': price_row.get('high_price'),
                'currency': price_row.get('currency', 'USD'),
                'source': source
            }
        else:
            # Fallback: no price found
            card['price_data'] = {'market_price': 0.0, 'currency': 'USD', 'source': source}
        enriched.append(card)
    return enriched

def calculate_collection_value(collection: list) -> dict:
    """
    Calculate total value and breakdowns for a collection of cards with price_data.
    Returns: { total_value, by_rarity, by_set, by_color, ... }
    """
    total_value = 0.0
    by_rarity = {}
    by_set = {}
    by_color = {}
    for card in collection:
        price = 0.0
        qty = float(card.get('quantity', 1))
        if 'price_data' in card and card['price_data'].get('market_price') is not None:
            price = float(card['price_data']['market_price'])
        value = price * qty
        total_value += value
        rarity = card.get('rarity', 'Unknown')
        by_rarity[rarity] = by_rarity.get(rarity, 0.0) + value
        set_name = card.get('set', 'Unknown')
        by_set[set_name] = by_set.get(set_name, 0.0) + value
        color = ','.join(card.get('color_identity', [])) if card.get('color_identity') else 'Colorless'
        by_color[color] = by_color.get(color, 0.0) + value
    return {
        'total_value': total_value,
        'by_rarity': by_rarity,
        'by_set': by_set,
        'by_color': by_color
    }

# --- Data Models ---
@dataclass
class Card:
    name: str
    price: float = 0.0
    decks_containing: int = 0
    win_count: int = 0

@dataclass
class Deck:
    id: str
    name: str
    format: str
async def enrich_collection_with_prices(collection: list, source: str = "tcgcsv", date: Optional[str] = None) -> list:
    """
    Enrich a collection with price data from TCGCSV files (preferred) or cache fallback.
    If date is provided, use historical prices from the archive for that date (YYYY-MM-DD).
    """
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    # If date is provided, use archive folder, else use 'latest' or fallback
    if date:
        date_dir = os.path.join(DATA_DIR, date)
    else:
        # Assume 'latest' is a symlink or copy of the most recent archive
        date_dir = os.path.join(DATA_DIR, 'latest')
        if not os.path.exists(date_dir):
            # Fallback: use most recent available date
            all_dates = [d for d in os.listdir(DATA_DIR) if d[:4].isdigit()]
            if all_dates:
                date_dir = os.path.join(DATA_DIR, sorted(all_dates)[-1])

    # Load product mapping for name->productId/groupId
    # Assume ProductsAndPrices.csv is in each group folder
    # Build a mapping: (set_name, card_name) -> (group_id, product_id)
    product_map = {}
    for group_folder in os.listdir(os.path.join(date_dir, '3')):
        group_path = os.path.join(date_dir, '3', group_folder)
        csv_path = os.path.join(group_path, 'ProductsAndPrices.csv')
        if os.path.exists(csv_path):
            group_products = load_tcgcsv_products_csv(csv_path)
            for name, row in group_products.items():
                product_map[(row['groupName'].strip().lower(), name)] = (row['groupId'], row['productId'])

    enriched = []
    for card in collection:
        # Try to find group and product id
        set_name = card.get('set_name', '').strip().lower()
        card_name = card.get('name', '').strip().lower()
        ids = product_map.get((set_name, card_name))
        price_data = None
        if ids:
            group_id, product_id = ids
            price_data = get_tcgcsv_price_for_card(date_dir, group_id, product_id)
        # Fallback: no price found
        if price_data:
            card['price_mid'] = price_data.get('midPrice')
            card['price_market'] = price_data.get('marketPrice')
            card['price_low'] = price_data.get('lowPrice')
            card['price_date'] = price_data.get('date')
        else:
            card['price_mid'] = None
            card['price_market'] = None
            card['price_low'] = None
            card['price_date'] = None
        enriched.append(card)
    return enriched
    event_date: Optional[str]
    win_count: Optional[int]
    card_list: List[Dict] = field(default_factory=list)
    source: str = ""

@dataclass
class Event:
    name: str
    type: str
    date: str
    format: str

# --- Config ---
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
DECKS_JSON = os.path.join(DATA_DIR, 'tournament_decks_mtggoldfish.json')

# --- Helper: Load decks from JSON ---
def load_decks() -> List[Deck]:
    if not os.path.exists(DECKS_JSON):
        return []
    with open(DECKS_JSON, 'r', encoding='utf-8') as f:
        raw = json.load(f)
    decks = []
    for d in raw:
        decks.append(Deck(
            id=d.get('id', d.get('source', '')),
            name=d.get('name', ''),
            format=d.get('format', ''),
            event=d.get('event', ''),
            event_date=d.get('event_date'),
            win_count=d.get('win_count'),
            card_list=d.get('card_list', []),
            source=d.get('source', '')
        ))
    return decks

# --- Archive/Price Helpers ---
def get_available_archive_dates() -> List[str]:
    # Returns list of available price archive dates (YYYY-MM-DD) in data dir
    if not os.path.exists(DATA_DIR):
        return []
    files = os.listdir(DATA_DIR)
    dates = []
    for fname in files:
        if fname.startswith('prices-') and fname.endswith('.ppmd.7z'):
            date_str = fname[len('prices-'):-len('.ppmd.7z')]
            dates.append(date_str)
    return dates

def read_price_for_card(tcgcsv_id: str, date_str: str) -> Optional[float]:
    # Looks for extracted price file for given date, returns price for card id
    price_file = os.path.join(DATA_DIR, date_str, 'prices.json')
    if not os.path.exists(price_file):
        return None
    try:
        with open(price_file, 'r', encoding='utf-8') as f:
            prices = json.load(f)
        price = prices.get(tcgcsv_id)
        if price is not None:
            return float(price)
    except Exception:
        return None
    return None

# --- Analytics Endpoints ---
@router.get("/api/analytics/cei")
async def analytics_cei():
    decks = load_decks()
    card_stats = {}
    for deck in decks:
        seen = set()
        for card in deck.card_list:
            name = card.get('name', '').strip()
            if not name or name in seen:
                continue
            seen.add(name)
            if name not in card_stats:
                card_stats[name] = { 'name': name, 'decks_containing': 0, 'win_count': 0, 'price': 0.0 }
            card_stats[name]['decks_containing'] += 1
            if deck.win_count:
                card_stats[name]['win_count'] += deck.win_count
    available_dates = get_available_archive_dates()
    latest_date = max(available_dates) if available_dates else None
    for name, stat in card_stats.items():
        tcgcsv_id = None
        for deck in decks:
            for card in deck.card_list:
                if card.get('name', '').strip() == name:
                    tcgcsv_id = str(card.get('tcgcsv_id') or card.get('product_id') or card.get('id'))
                    break
            if tcgcsv_id:
                break
        if tcgcsv_id and latest_date:
            price = read_price_for_card(tcgcsv_id, latest_date)
            if price:
                stat['price'] = price
        stat['cei'] = (stat['decks_containing'] / stat['price']) if stat['price'] else None
    result = sorted(card_stats.values(), key=lambda x: (x['cei'] or 0, x['decks_containing']), reverse=True)
    return JSONResponse(result)

@router.get("/api/analytics/deck-cost-to-win")
async def analytics_deck_cost_to_win():
    decks = load_decks()
    available_dates = get_available_archive_dates()
    latest_date = max(available_dates) if available_dates else None
    results = []
    for deck in decks:
        total_price = 0.0
        for card in deck.card_list:
            tcgcsv_id = str(card.get('tcgcsv_id') or card.get('product_id') or card.get('id'))
            price = read_price_for_card(tcgcsv_id, latest_date) if latest_date else 0.0
            qty = float(card.get('quantity', 1))
            if price:
                total_price += price * qty
        cost_to_win = (total_price / deck.win_count) if deck.win_count else None
        results.append({
            'id': deck.id,
            'name': deck.name,
            'event': deck.event,
            'event_date': deck.event_date,
            'win_count': deck.win_count,
            'total_price': total_price,
            'cost_to_win': cost_to_win
        })
    results = sorted(results, key=lambda x: (x['cost_to_win'] if x['cost_to_win'] is not None else float('inf')))
    return JSONResponse(results)

@router.get("/api/analytics/investment-watch")
async def analytics_investment_watch():
    available_dates = sorted(get_available_archive_dates())
    if not available_dates:
        return JSONResponse([])
    decks = load_decks()
    card_names = set()
    for deck in decks:
        for card in deck.card_list:
            card_names.add(card.get('name', '').strip())
    investment_data = []
    for name in card_names:
        price_trend = []
        tcgcsv_id = None
        for deck in decks:
            for card in deck.card_list:
                if card.get('name', '').strip() == name:
                    tcgcsv_id = str(card.get('tcgcsv_id') or card.get('product_id') or card.get('id'))
                    break
            if tcgcsv_id:
                break
        if not tcgcsv_id:
            continue
        for date_str in available_dates:
            price = read_price_for_card(tcgcsv_id, date_str)
            price_trend.append({'date': date_str, 'price': price})
        investment_data.append({'name': name, 'price_trend': price_trend})
    return JSONResponse(investment_data)

@router.get("/api/analytics/pack-set-analysis")
async def analytics_pack_set_analysis():
    decks = load_decks()
    set_stats = {}
    for deck in decks:
        for card in deck.card_list:
            set_name = card.get('set', 'Unknown')
            rarity = card.get('rarity', 'Unknown')
            if set_name not in set_stats:
                set_stats[set_name] = {'total': 0, 'rarity': {}}
            set_stats[set_name]['total'] += 1
            if rarity not in set_stats[set_name]['rarity']:
                set_stats[set_name]['rarity'][rarity] = 0
            set_stats[set_name]['rarity'][rarity] += 1
    return JSONResponse(set_stats)

@router.get("/api/analytics/credit")
async def analytics_credit():
    return JSONResponse({
        "credit": "Data from MTGGoldfish/MTGTop8. All rights belong to their respective owners. This project respects robots.txt and rate limits."
    })
