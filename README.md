<p align="center">
  <img src="frontend/public/logo.png" alt="SparkRoot Logo" width="256" />
</p>

# <img src="frontend/public/logo.png" alt="SparkRoot Logo" width="32"/> SparkRoot
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-green.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-green.svg)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://typescriptlang.org/)
[![License](https://img.shields.io/badge/License-BUSL--1.1-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Deployed-brightgreen.svg)](https://sparkroot.cards/)

**Magic: The Gathering collection manager and deck optimizer. Upload your collection, generate legal Commander decks, and analyze deck quality—all in a modern web interface.**

## Features

- Upload your MTG collection (CSV formats: [Moxfield](https://moxfield.com/), [Manabox](https://manabox.app/), etc.)
- Automatic card data enrichment from [Scryfall](https://scryfall.com/)
- Generate and save legal Commander decks from your collection
- Analyze deck quality and composition
- Export decks in TXT, JSON, and CSV formats
- Secure user authentication and collection management

### Planned

- Real-time pricing and collection valuation
- User profiles and community features
- Any community-requested features

## 🔧 Technical Details

### **Architecture**
- **Frontend**: Next.js + React + TypeScript + Tailwind CSS
- **Backend**: Python FastAPI for efficient data processing and deck generation
- **Data Source**: Scryfall API and Supabase PostgresSQL for complete, up-to-date card information and storage  
- **Format Support**: Commander with [bracket](https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta), [salt](https://edhrec.com/top/salt), and *house rules* options
- **Deployment**: Vercel (frontend) + Railway/Redis (backend) + Supabase (data storage)

> House rules are Bracket 1 and no Sol Ring, nonland tutors, or some 'unfun' cards like Armageddon, Winter Orb, and Stasis.

### **Manual Setup**

**Prerequisites:**
- Node.js 18+ and npm
- Python 3.8+ and pip
- Git for version control

**Backend Setup:**
```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Frontend:**
```powershell
cd frontend
npm install
```

**Run Development Servers from Root:**
```powershell
./run.ps1
```

## Architecture

```
MTG-Deck-Optimizer/
├── frontend/              # Next.js 15 + React 19 application
│   ├── src/
│   │   ├── app/          # App Router pages and layouts
│   │   ├── components/   # Reusable React components
│   │   ├── lib/          # API client and utilities
│   │   ├── stores/       # Zustand state management
│   │   └── types/        # TypeScript definitions
│   ├── public/           # Static assets
│   └── tailwind.config.js # Tailwind CSS configuration
│
└── backend/              # FastAPI Python application
    ├── main.py          # API server entry point
    ├── deckgen.py       # Deck generation algorithms
    ├── deck_analysis.py # Advanced deck scoring
    ├── utils.py         # Utility functions
    ├── data/            # Scryfall card database
    └── requirements.txt # Python dependencies
```

## Data Files

Some large files (like `scryfall_all_cards.json`) are not in git. Download from [Scryfall API](https://scryfall.com/docs/api/bulk-data) or use the provided script in `data/`. In SparkRoot, these are uploaded to a public.cards table in Supabase.

## API

The FastAPI backend provides REST endpoints and automatic OpenAPI docs at `http://localhost:8000/docs`.

## Attributions

Icons from [Mana Font](https://mana.andrewgioia.com/) by Andrew Gioia.
> All mana images and card symbols © Wizards of the Coast.<br>
The Mana font is licensed under the the SIL OFL 1.1.<br>
Mana CSS, LESS, and Sass files are licensed under the MIT License.<br>

## Sources

- [Intro guide to Commander (EDH) decks](https://archidekt.com/decks/1048638#EDH__Deck_Template_(read_description_at_bottom))
- [What's an Optimal Mana Curve and Land/Ramp Count for Commander?](https://www.tcgplayer.com/content/article/What-s-an-Optimal-Mana-Curve-and-Land-Ramp-Count-for-Commander/e22caad1-b04b-4f8a-951b-a41e9f08da14/)
- [Commander Deckbuilding Template for the New Era](https://www.youtube.com/watch?v=OSNV6224cHg)

## License & Disclaimer

This project is licensed under the [Business Source License 1.1(BUSL-1.1)](LICENSE).

 > Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. SparkRoot is unofficial Fan Content permitted under the [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

## Contributing

We welcome contributions! Please:
- Open issues for bugs, feature requests, or questions
- Fork the repo and submit pull requests for improvements
- Follow clean code practices and keep changes focused
- Add clear commit messages and documentation for new features
- Join the [Discord](https://discord.gg/3TC9QkPSc6) for discussions and support

## Contact

For questions, feedback, or collaboration opportunities:

- **GitHub**: [@gurleyryan](https://github.com/gurleyryan)
- **Email**: [gurleyryan@gmail.com](mailto:gurleyryan@gmail.com)
- **Discord**: [Grand Gurley Generation](https://discord.gg/3TC9QkPSc6)
- **Website**: [Gurley Music](https://gurleymusic.com)