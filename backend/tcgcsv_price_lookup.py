import os
import csv
import json
from typing import Optional, Dict, Any

# TCGCSV Magic category id is 3
tcgcsv_magic_category = '3'

def find_tcgcsv_price_file(date_dir: str, group_id: str, product_id: str) -> Optional[str]:
    """Return the path to the TCGCSV price file for a given date, group, and product."""
    price_file = os.path.join(date_dir, tcgcsv_magic_category, group_id, product_id, 'prices')
    if os.path.exists(price_file):
        return price_file
    return None

def read_tcgcsv_price(price_file: str) -> Optional[Dict[str, Any]]:
    """Read the latest price entry from a TCGCSV price file (JSON lines)."""
    try:
        with open(price_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            if not lines:
                return None
            # Use the last line (latest price)
            last = lines[-1]
            return json.loads(last)
    except Exception:
        return None

def get_tcgcsv_price_for_card(date_dir: str, group_id: str, product_id: str) -> Optional[Dict[str, Any]]:
    price_file = find_tcgcsv_price_file(date_dir, group_id, product_id)
    if not price_file:
        return None
    return read_tcgcsv_price(price_file)

# Optionally, add a CSV loader for ProductsAndPrices.csv for mapping names to product IDs
def load_tcgcsv_products_csv(csv_path: str) -> Dict[str, Dict[str, Any]]:
    """Load ProductsAndPrices.csv and return a mapping of card name to product info."""
    mapping = {}
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            mapping[row['productName'].strip().lower()] = row
    return mapping
