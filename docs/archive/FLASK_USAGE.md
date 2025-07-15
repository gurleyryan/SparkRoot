# Flask Web Application Usage

## Quick Start

1. **Install dependencies** (if not already done):
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Flask app**:
   ```bash
   cd src
   python app.py
   ```
   
   Or use the provided batch file:
   ```bash
   run_app.bat
   ```

3. **Open your browser** and go to: `http://localhost:5000`

## Features

### Web Interface
- **Commander Selection**: Browse all legendary creatures in your collection that are legal in Commander format
- **Interactive Cards**: Click to select a commander with visual feedback
- **Deck Generation**: Automatically generate a 99-card deck matching your commander's color identity
- **Deck Display**: View your generated deck with detailed card information

### Routes
- `/` - Main page for commander selection and deck generation
- `/download-data` - Download latest Scryfall card data

## How It Works

1. **Commander Selection Page** (`GET /`):
   - Displays all valid commanders from your collection
   - Shows card details including mana cost, color identity, power/toughness
   - Interactive selection with JavaScript

2. **Deck Generation** (`POST /`):
   - Takes selected commander ID from form submission
   - Generates a deck using the `generate_commander_deck()` function
   - Filters cards by color identity and Commander legality
   - Displays the complete deck with commander and 99 other cards

## File Structure
```
src/
├── app.py              # Flask application
├── utils.py            # Data loading utilities
├── deckgen.py          # Deck generation logic
└── templates/          # HTML templates
    ├── base.html       # Base template with styling
    ├── index.html      # Commander selection page
    └── deck.html       # Generated deck display
```

## Customization

### Styling
All CSS is included in `templates/base.html`. The design features:
- Responsive grid layout for commander cards
- Interactive hover effects
- Clean, modern styling with Magic-themed colors

### Deck Generation Logic
The deck generation can be enhanced in `deckgen.py`:
- Add mana curve optimization
- Implement card type distribution
- Add synergy detection
- Include ramp/removal recommendations

## Troubleshooting

### Common Issues
1. **Import errors**: Make sure you're running from the `src` directory
2. **Missing data**: Run `/download-data` route to get latest Scryfall data
3. **No commanders found**: Check that your collection has legendary creatures legal in Commander

### Development Mode
The app runs in debug mode by default, which provides:
- Auto-reload on file changes
- Detailed error pages
- Hot reloading for development

For production deployment, set `debug=False` in `app.run()`.
