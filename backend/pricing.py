# Card Pricing Integration
# Fetches current market prices from multiple sources

import requests
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import sqlite3
import json
from dataclasses import dataclass
import os

@dataclass
class PriceData:
    source: str
    market_price: Optional[float] = None
    low_price: Optional[float] = None
    high_price: Optional[float] = None
    currency: str = "USD"
    last_updated: Optional[datetime] = None

class PriceCache:
    """Manage price caching to avoid excessive API calls"""
    
    def __init__(self, cache_duration_hours: int = 6):
        self.cache_duration = timedelta(hours=cache_duration_hours)
        self.init_cache_db()
    
    def init_cache_db(self):
        """Initialize price cache database"""
        os.makedirs('../data', exist_ok=True)
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS price_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_name TEXT NOT NULL,
                set_code TEXT NOT NULL,
                source TEXT NOT NULL,
                market_price REAL,
                low_price REAL,
                high_price REAL,
                currency TEXT DEFAULT 'USD',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(card_name, set_code, source)
            )
        ''')
        conn.commit()
        conn.close()
    
    def get_cached_price(self, card_name: str, set_code: str, source: str) -> Optional[PriceData]:
        """Get cached price if still valid"""
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT market_price, low_price, high_price, currency, last_updated
            FROM price_cache 
            WHERE card_name = ? AND set_code = ? AND source = ?
        ''', (card_name, set_code, source))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return None
        
        last_updated = datetime.fromisoformat(result[4])
        if datetime.now() - last_updated > self.cache_duration:
            return None  # Cache expired
        
        return PriceData(
            source=source,
            market_price=result[0],
            low_price=result[1],
            high_price=result[2],
            currency=result[3],
            last_updated=last_updated
        )
    
    def cache_price(self, card_name: str, set_code: str, price_data: PriceData):
        """Cache price data"""
        conn = sqlite3.connect('../data/mtg_optimizer.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO price_cache 
            (card_name, set_code, source, market_price, low_price, high_price, currency, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (card_name, set_code, price_data.source, price_data.market_price,
              price_data.low_price, price_data.high_price, price_data.currency))
        
        conn.commit()
        conn.close()

class TCGCSVAPI:
    """tcgcsv.com API integration (public TCGplayer cache)"""
    BASE_URL = "https://tcgcsv.com/tcgplayer"

    @staticmethod
    def get_category_id(game: str = "mtg") -> int:
        # Only MTG supported for now
        return 1

    @staticmethod
    def get_group_id_for_set(set_name: str) -> int:
        # This should be cached or indexed for production use
        category_id = TCGCSVAPI.get_category_id()
        url = f"{TCGCSVAPI.BASE_URL}/{category_id}/groups"
        resp = requests.get(url)
        if resp.status_code != 200:
            return None
        groups = resp.json().get('results', [])
        for group in groups:
            if group['name'].lower() == set_name.lower():
                return group['groupId']
        return None

    @staticmethod
    def get_product_and_price(card_name: str, set_name: str = None) -> Optional[PriceData]:
        category_id = TCGCSVAPI.get_category_id()
        group_id = None
        if set_name:
            group_id = TCGCSVAPI.get_group_id_for_set(set_name)
        if not group_id:
            # fallback: try all groups
            url = f"{TCGCSVAPI.BASE_URL}/{category_id}/groups"
            resp = requests.get(url)
            if resp.status_code != 200:
                return None
            groups = resp.json().get('results', [])
        else:
            groups = [{"groupId": group_id}]

        for group in groups:
            gid = group['groupId']
            # Get products for this group
            prod_url = f"{TCGCSVAPI.BASE_URL}/{category_id}/{gid}/products"
            prod_resp = requests.get(prod_url)
            if prod_resp.status_code != 200:
                continue
            products = prod_resp.json().get('results', [])
            for product in products:
                if product['name'].lower() == card_name.lower():
                    product_id = product['productId']
                    # Get price for this product
                    price_url = f"{TCGCSVAPI.BASE_URL}/{category_id}/{gid}/prices"
                    price_resp = requests.get(price_url)
                    if price_resp.status_code != 200:
                        continue
                    prices = price_resp.json().get('results', [])
                    for price in prices:
                        if price['productId'] == product_id:
                            return PriceData(
                                source='tcgcsv',
                                market_price=price.get('midPrice'),
                                low_price=price.get('lowPrice'),
                                high_price=price.get('highPrice'),
                                currency='USD'
                            )
        return None

class ScryfallPriceAPI:
    """Use Scryfall's pricing data as a fallback"""
    
    @staticmethod
    async def get_card_price(card_name: str, set_code: str = None) -> Optional[PriceData]:
        """Get card price from Scryfall"""
        try:
            base_url = "https://api.scryfall.com/cards/named"
            params = {'fuzzy': card_name}
            if set_code:
                params['set'] = set_code
            
            async with aiohttp.ClientSession() as session:
                async with session.get(base_url, params=params) as response:
                    if response.status != 200:
                        return None
                    
                    card_data = await response.json()
                    prices = card_data.get('prices', {})
                    
                    # Scryfall provides USD prices
                    usd_price = prices.get('usd')
                    
                    if usd_price:
                        price_float = float(usd_price)
                        return PriceData(
                            source='scryfall',
                            market_price=price_float,
                            low_price=price_float * 0.8,  # Estimate
                            high_price=price_float * 1.2,  # Estimate
                            currency='USD'
                        )
        
        except Exception as e:
            print(f"Scryfall API error for {card_name}: {e}")
            return None

class PriceManager:
    """Centralized price management with multiple sources"""
    
    def __init__(self):
        self.cache = PriceCache()
        self.tcgplayer = TCGCSVAPI()
        self.scryfall = ScryfallPriceAPI()
        self.source_priority = ['tcgplayer', 'scryfall']
    
    async def get_card_price(self, card_name: str, set_code: str = None, preferred_source: str = 'tcgplayer') -> Optional[PriceData]:
        """Get card price with caching and fallback sources"""
        
        # Check cache first
        cached_price = self.cache.get_cached_price(card_name, set_code or '', preferred_source)
        if cached_price:
            return cached_price
        
        # Try preferred source first
        price_data = None
        if preferred_source == 'tcgplayer':
            # Use tcgcsv.com as the TCGPlayer proxy
            price_data = TCGCSVAPI.get_product_and_price(card_name, set_code)
        elif preferred_source == 'scryfall':
            price_data = await self.scryfall.get_card_price(card_name, set_code)
        
        # Fallback to other sources if preferred fails
        if not price_data:
            for source in self.source_priority:
                if source != preferred_source:
                    if source == 'tcgplayer':
                        price_data = await self.tcgplayer.get_card_price(card_name, set_code)
                    elif source == 'scryfall':
                        price_data = await self.scryfall.get_card_price(card_name, set_code)
                    
                    if price_data:
                        break
        
        # Cache the result
        if price_data:
            self.cache.cache_price(card_name, set_code or '', price_data)
        
        return price_data
    
    async def get_collection_prices(self, collection: List[Dict], preferred_source: str = 'tcgplayer') -> Dict[str, PriceData]:
        """Get prices for an entire collection"""
        price_data = {}
        
        # Process in batches to avoid overwhelming APIs
        batch_size = 10
        for i in range(0, len(collection), batch_size):
            batch = collection[i:i + batch_size]
            
            tasks = []
            for card in batch:
                card_name = card.get('name', '')
                set_code = card.get('set', '')
                
                if card_name:
                    task = self.get_card_price(card_name, set_code, preferred_source)
                    tasks.append((card_name, set_code, task))
            
            # Execute batch
            results = await asyncio.gather(*[task for _, _, task in tasks], return_exceptions=True)
            
            # Process results
            for (card_name, set_code, _), result in zip(tasks, results):
                if isinstance(result, PriceData):
                    key = f"{card_name}|{set_code}"
                    price_data[key] = result
            
            # Rate limiting - wait between batches
            await asyncio.sleep(1)
        
        return price_data

# Utility functions for the API
async def enrich_collection_with_prices(collection: List[Dict], preferred_source: str = 'tcgplayer') -> List[Dict]:
    """Add pricing data to collection"""
    price_manager = PriceManager()
    price_data = await price_manager.get_collection_prices(collection, preferred_source)
    
    enriched_collection = []
    for card in collection:
        enriched_card = card.copy()
        card_name = card.get('name', '')
        set_code = card.get('set', '')
        key = f"{card_name}|{set_code}"
        
        if key in price_data:
            price_info = price_data[key]
            enriched_card['price_data'] = {
                'source': price_info.source,
                'market_price': price_info.market_price,
                'low_price': price_info.low_price,
                'high_price': price_info.high_price,
                'currency': price_info.currency,
                'last_updated': price_info.last_updated.isoformat() if price_info.last_updated else None
            }
            
            # Calculate collection value for this card
            quantity = card.get('Quantity', 1)
            if price_info.market_price:
                enriched_card['total_value'] = price_info.market_price * quantity
        
        enriched_collection.append(enriched_card)
    
    return enriched_collection

def calculate_collection_value(collection: List[Dict]) -> Dict[str, float]:
    """Calculate total collection value from cards with price data"""
    total_value = 0
    total_low = 0
    total_high = 0
    cards_with_prices = 0
    
    for card in collection:
        price_data = card.get('price_data', {})
        quantity = card.get('Quantity', 1)
        
        if price_data.get('market_price'):
            total_value += price_data['market_price'] * quantity
            cards_with_prices += 1
        
        if price_data.get('low_price'):
            total_low += price_data['low_price'] * quantity
        
        if price_data.get('high_price'):
            total_high += price_data['high_price'] * quantity
    
    return {
        'total_market_value': round(total_value, 2),
        'total_low_value': round(total_low, 2),
        'total_high_value': round(total_high, 2),
        'cards_with_prices': cards_with_prices,
        'total_cards': len(collection),
        'pricing_coverage': round(cards_with_prices / len(collection) * 100, 2) if collection else 0
    }
