from typing import List, Dict, Optional, Any
import os
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime

# --- CONFIG ---
MTGGOLDFISH_URL = "https://www.mtggoldfish.com/tournament_series/pioneer-challenge#paper"
OUTPUT_JSON = "data/tournament_decks_mtggoldfish.json"

# --- SCRAPER ---
def fetch_event_decks(event_url: str) -> List[Dict[str, Any]]:
    resp = requests.get(event_url)
    soup = BeautifulSoup(resp.text, "html.parser")
    deck_links = [str(a['href']) for a in soup.select('a.deck-view-link')]
    decks: List[Dict[str, Any]] = []
    for link in deck_links:
        deck_url: str = f"https://www.mtggoldfish.com{link}"
        deck: Optional[Dict[str, Any]] = fetch_deck(deck_url)
        if deck:
            decks.append(deck)
    return decks

def fetch_deck(deck_url: str) -> Optional[Dict[str, Any]]:
    resp = requests.get(deck_url)
    soup = BeautifulSoup(resp.text, "html.parser")
    # Deck name
    name = soup.select_one('h1.deck-view-title')
    name = name.text.strip() if name else "Unknown Deck"
    # Event info
    event = soup.select_one('a.deck-view-event-link')
    event_name = event.text.strip() if event else "Unknown Event"
    event_url = event['href'] if event else None
    # Date (try to parse from event page or deck page)
    date_str = soup.select_one('div.deck-view-date')
    event_date = None
    if date_str:
        try:
            event_date = datetime.strptime(date_str.text.strip(), "%b %d, %Y").date().isoformat()
        except Exception:
            event_date = None
    # Format
    fmt = soup.select_one('span.deck-view-format')
    fmt = fmt.text.strip() if fmt else "Unknown"
    # Win count (not always available)
    win_count: Optional[int] = None
    win_tag = soup.find(string="Win")
    if win_tag and isinstance(win_tag, str):
        try:
            digits = ''.join(filter(str.isdigit, win_tag))
            win_count = int(digits) if digits else None
        except Exception:
            win_count = None
    # Card list
    card_list: List[Dict[str, Any]] = []
    for row in soup.select('table.deck-view-deck-table tr'):
        cols = row.find_all('td')
        if len(cols) == 2:
            count: int = int(cols[0].text.strip())
            card_name: str = cols[1].text.strip()
            card_list.append({"name": card_name, "count": count})
    return {
        "name": name,
        "format": fmt,
        "event": event_name,
        "event_url": event_url,
        "event_date": event_date,
        "win_count": win_count,
        "card_list": card_list,
        "source": deck_url
    }

def main():
    print("Fetching event decks from MTGGoldfish...")
    resp = requests.get(MTGGOLDFISH_URL)
    soup = BeautifulSoup(resp.text, "html.parser")
    # Find event links (limit to first 3 for demo)
    event_links = [a['href'] for a in soup.select('a.tournament-title-link')][:3]
    all_decks: List[Dict[str, Any]] = []
    for rel_link in event_links:
        event_url = f"https://www.mtggoldfish.com{rel_link}"
        print(f"Fetching decks for event: {event_url}")
        decks = fetch_event_decks(event_url)
        all_decks.extend(decks)
    # Save as JSON
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_decks, f, indent=2)
    print(f"Saved {len(all_decks)} decks to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
