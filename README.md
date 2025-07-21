<p align="center">
  <img src="frontend/public/logocropped.png" alt="SparkRoot Logo" width="512" />
</p>

# <img src="frontend/public/logocropped.png" alt="SparkRoot Logo" width="32"/> SparkRoot

**A comprehensive Magic: The Gathering collection management and deck optimization platform with real-time pricing, advanced filtering, and powerful deck building tools.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-green.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-green.svg)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://typescriptlang.org/)
[![License](https://img.shields.io/badge/License-BUSL--1.1-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Deployed-brightgreen.svg)](https://sparkroot.cards/)

> **Professional-grade MTG deck building and collection management** - Transform your physical collection into optimized Commander decks through an intuitive, beautifully designed web interface with powerful Python algorithms for complex deck generation tasks.

## 🚀 **Current Status: [Deployed](https://sparkroot.cards/)**

## 📢 Disclaimer

 > Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. SparkRoot is an unofficial, fan-made tool with no official affiliation. If Wizards of the Coast ever asks us to make changes to the branding, we’ll comply immediately.

## What Makes This Special

1. **🎯 Uses Your Real Collection** - Not theoretical deckbuilding
2. **⚡ Instant Results** - See what you can build right now
3. **🔒 Format Perfect** - Follows all Commander rules automatically
4. **🎨 Professional Quality** - Production-ready code and UI
5. **🔧 Extensible Design** - Clean architecture for easy enhancement

## ✨ Features

### �️ **Collection Management**
- **CSV Upload**: Import from MTGGoldfish, Archidekt, ManaBox, Deckbox, or custom formats
- **Auto-Detection**: Intelligent CSV format detection and column mapping
- **Scryfall Integration**: Enrich card data with high-resolution images, current prices, and metadata
- **Quantity Expansion**: Automatically handle collections with quantity columns

### 💰 **Real-Time Pricing**
- **Multiple Sources**: TCGPlayer and Scryfall market data integration
- **Intelligent Caching**: Optimized API calls with smart caching strategies
- **Collection Valuation**: Track your collection's total market value
- **Price History**: Monitor card value trends over time

### ⚔️ **Deck Building**
- **Commander Deck Generator**: AI-powered deck suggestions based on your collection
- **Color Identity Matching**: Ensures all cards match your commander's color identity
- **Synergy Analysis**: Advanced card interaction detection and optimization
- **Mana Curve Optimization**: Automatically balanced deck construction
- **Export Support**: TXT, JSON, and MoxField compatible formats

### 🎨 **Professional Interface**
- **Dark MTG Aesthetic**: Inspired by premium card sleeves and play mats
- **Beleren-Inspired Typography**: Legal font alternatives (Cinzel) that capture the authentic MTG feel
- **Rarity Color Coding**: Visual indicators for Common, Uncommon, Rare, and Mythic cards
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Next.js 15**: Latest React 19 with App Router and TypeScript

### 🔐 **User Management**
- **Secure Authentication**: JWT-based user accounts with password hashing
- **Collection Persistence**: Save and manage multiple collections
- **User Preferences**: Customizable settings and advanced filters
- **Privacy Focused**: Your collection data stays secure and private

## 🎯 **Usage Guide**

### **Getting Started**
1. **Start the application** using one of the quick start methods above
2. **Create an account** or sign in through the web interface
3. **Upload your collection** in CSV format (MTGGoldfish, Archidekt, etc.)
4. **Browse available commanders** from your collection
5. **Generate optimized decks** with one click
6. **Export and share** your decks in multiple formats

### **CSV Format Support**
The application automatically detects and handles various CSV formats:

- **MTGGoldfish exports** (name, set, quantity, foil, price)
- **Archidekt exports** (name, edition, quantity, condition)
- **Custom formats** with automatic column mapping
- **Quantity expansion** for multi-card entries

## 📱 How to Use

1. **🔍 Select Commander**: Browse commanders from your collection with interactive cards
2. **⚡ Generate Deck**: Click to build a legal 99-card deck instantly
3. **📊 Analyze Results**: View mana curve, card types, and deck composition  
4. **💾 Export Deck**: Download as TXT, JSON, or copy for MoxField

### Web Interface Features
- **Interactive Commander Selection**: Click-to-select with visual feedback
- **Real-time Deck Generation**: Instant deck building with full rule compliance
- **Comprehensive Analysis**: Mana curve, type distribution, average CMC
- **Multiple Export Options**: Professional formats for online play

## Key Features

### ⚔️ Smart Deck Building
- ✅ **Color identity validation** - All cards match commander colors
- ✅ **Format legality checking** - Only legal Commander cards included
- ✅ **Proper basic land handling** - Unlimited basics as per rules
- ✅ **Collection quantity respect** - Uses your actual card availability

### 💾 Export & Analysis
- 📄 **MTGO/Arena format** (.txt files) - Ready for online import
- 💾 **JSON format** (programmatic use) - Complete deck data
- 📋 **MoxField import** (copy to clipboard) - One-click sharing
- 📊 **Deck statistics** - Type distribution and mana analysis

### 🧪 Proven Results
*From our test collection of 635 cards (343 unique cards):*
- ✅ **7 legal commanders** found automatically

## 🔧 Technical Details

### Architecture
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Pandas for efficient data processing
- **Data Source**: Scryfall API for complete, up-to-date card information  
- **Format Support**: Commander/EDH with full rules compliance
- **Deployment**: Vercel (frontend) + Railway/Render (backend)

### Performance
- **Load Time**: ~2 seconds for 108K card database
- **Deck Generation**: Instant (<1 second)
- **Export Speed**: <1 second for all formats
- **Memory Usage**: Efficient pandas operations for large datasets

### 📋 **Manual Setup**

**Prerequisites:**
- Node.js 18+ and npm
- Python 3.8+ and pip
- Git for version control

**Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**Frontend Setup (separate terminal):**
```bash
cd frontend
npm install
npm run dev
```


## 🏗️ **Architecture**

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
├── backend/              # FastAPI Python application
│   ├── main.py          # API server entry point
│   ├── deckgen.py       # Deck generation algorithms
│   ├── deck_analysis.py # Advanced deck scoring
│   ├── utils.py         # Utility functions
│   ├── data/            # Scryfall card database
│   └── requirements.txt # Python dependencies
│
└── data/                # Shared data files
    └── scryfall_all_cards.json # Complete MTG card database
```

## 📦 Data Files for Deployment

### Large Files Not in Git

The following large files are excluded from git but needed for the application:

#### `scryfall_all_cards.json` (505MB)
- **Source**: Download from [Scryfall API](https://scryfall.com/docs/api/bulk-data)
- **Purpose**: Complete MTG card database for deck optimization
- **Railway Deployment**: Upload directly to Railway or use download script
- **Local Development**: Download manually or use setup script

### Download Script
```python
import requests
import json

def download_scryfall_data():
    print("Downloading Scryfall bulk data...")
    # Get bulk data info
    bulk_url = "https://api.scryfall.com/bulk-data"
    response = requests.get(bulk_url)
    bulk_data = response.json()
    # Find the default cards download
    default_cards = None
    for item in bulk_data["data"]:
        if item["type"] == "default_cards":
            default_cards = item
            break
    if default_cards:
        # Download the file
        print(f"Downloading {default_cards['name']}...")
        cards_response = requests.get(default_cards["download_uri"])
        # Save to data directory
        with open("data/scryfall_all_cards.json", "w", encoding="utf-8") as f:
            json.dump(cards_response.json(), f)
        print("Download complete!")
    else:
        print("Could not find default cards data")

if __name__ == "__main__":
    download_scryfall_data()
```

**For Railway Deployment:**
Add this script to your Railway deployment or download the file manually.

## 🎯 **Core Technologies & Recent Changes**

### **Frontend Stack**
- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19 with TypeScript
- **Styling**: Tailwind CSS v4 with custom MTG theme
- **State Management**: Zustand for client state
- **Authentication**: Secure JWT in HttpOnly cookies (no localStorage)
- **Fonts**: Next.js optimized Google Fonts (Cinzel, Source Sans 3)
- **Icons**: Lucide React icon library
- **Error Monitoring**: Sentry SDK integration for frontend error tracking

### **Backend Stack**
- **API Framework**: FastAPI with automatic OpenAPI docs
- **Database**: Supabase PostgreSQL via REST API (SQLite fully removed)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Security**: TOTP enforcement, rate limiting, input validation
- **Logging**: Structured logging with structlog (JSON/timestamp format)
- **Error Monitoring**: Sentry SDK integration for backend error tracking
- **File Processing**: CSV parsing with pandas
- **CORS**: Configured for frontend integration
- **Core Algorithms**: Python-powered deck generation and analysis
- **Testing**: Automated tests for authentication and account flows
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Environment Management**: Standardized `.env`, `.env.example` for frontend and backend

### **Other Improvements**
- **Documentation**: README.md updated for error monitoring, logging, and security
- **Module Aliases**: Jest/Babel config for frontend tests and alias resolution
- **Supabase Audit**: Verified secure integration and removed unused DB code

## 🛡️ **Security & Monitoring**

- **Sentry**: All backend and frontend errors are tracked in Sentry
- **structlog**: Backend logs use JSON format with timestamps for easy analysis
- **TOTP**: Two-factor authentication required for sensitive actions
- **Rate Limiting**: Sensitive endpoints are rate-limited
- **Input Validation**: All input is validated using Pydantic models
- **Environment Variables**: All secrets and config are managed via standardized `.env` files

## 📡 **API Documentation & Error Monitoring**

The FastAPI backend provides a comprehensive REST API with automatic OpenAPI documentation at `http://localhost:8000/docs`.

## 📡 **API Reference & Security Checklist**

### Authentication & Account Endpoints

- **POST /api/auth/login**: Authenticates user and sets JWT in HttpOnly cookie.
- **GET /api/auth/me**: Returns current user info if authenticated (cookie required).
- **POST /api/auth/update-profile**: Updates user profile (full name, username).
- **POST /api/auth/update-email**: Updates user email (requires TOTP verification).
- **POST /api/auth/update-password**: Updates user password (requires current password).
- **POST /api/auth/verify-totp**: Verifies TOTP code for sensitive actions.
- **GET /api/auth/check-username?username=...**: Checks if username is available.
- **GET /api/auth/check-email?email=...**: Checks if email is available.

### Security & Rate Limiting
- Sensitive endpoints are rate-limited (e.g., password/email change).
- All input is validated using Pydantic models.
- Logging is structured (structlog) and errors are tracked with Sentry.

### Usage Notes
- All authenticated requests require cookie-based session (JWT in HttpOnly cookie).
- TOTP is required for email changes and other sensitive actions.
- Uniqueness checks for username/email are available via dedicated endpoints.

### Error Monitoring & Logging
- **Sentry**: All backend and frontend errors are reported to Sentry in production.
- **structlog**: Backend logs use JSON format with timestamps for easy analysis and monitoring.
- See this README for setup and troubleshooting.

### Sentry/structlog Production Validation Checklist

1. **Sentry DSN**: Confirm `SENTRY_DSN` is set in production environment variables.
2. **Sentry SDK**: Ensure `sentry_sdk.init()` is called in `backend/main.py` with the correct DSN.
3. **Structlog**: Confirm `structlog.configure()` is present and logger is used for all backend logging.
4. **Error Tracking**: Trigger a test error in production and verify it appears in Sentry dashboard.
5. **Log Format**: Check production logs for JSON format and timestamps (structlog).
6. **CI/CD**: Ensure CI workflow does not overwrite or remove Sentry/structlog config.
7. **Documentation**: This README is the single source of truth for error monitoring and logging setup.

### Key Algorithms
```python
# Core Functions
find_valid_commanders()         # Auto-detect legal commanders
generate_commander_deck()       # Build rule-compliant 100-card decks
analyze_deck_quality()          # Advanced 422-line scoring system
export_deck_to_*()             # Multi-format export system
```

## **Deployment**

#### Supabase + Railway + Vercel**

**Complete modern stack with PostgreSQL:**

1. **Database (Supabase)**:
   - Create Supabase project
   - Run `supabase_setup.sql` in SQL Editor
   - Get your project credentials

2. **Backend (Railway)**:
   - Deploy backend with Supabase environment variables
   - PostgreSQL database with full SQL features
   - Auto-scaling and monitoring

3. **Frontend (Vercel)**:
   - Deploy frontend with API URL configuration
   - Automatic HTTPS and global CDN
   - Zero-config deployment

## 📡 **API Documentation**

The FastAPI backend provides a comprehensive REST API with automatic OpenAPI documentation available at `http://localhost:8000/docs` when running locally.

### **Authentication Endpoints**
```
POST /auth/register    # Create new user account
POST /auth/login       # Authenticate user and get JWT token
GET  /auth/me          # Get current user information
```

### **Collection Management**
```
POST   /collections/upload     # Upload and process CSV collection
GET    /collections/cards      # Retrieve user's collection
DELETE /collections/clear      # Clear collection data
GET    /collections/stats      # Get collection statistics
```

### **Deck Building**
```
GET  /cards/commanders         # Find available commanders
POST /decks/generate          # Generate deck for commander
GET  /decks/export/{format}   # Export deck in specified format
```

## Development Roadmap

### 🎯 Phase 2: Enhanced Features (Next Sprint)
- [ ] **EDHREC Integration** - Compare with meta decks
- [ ] **Advanced Scoring** - Rate deck quality and balance
- [ ] **Multiple Variants** - Generate different builds per commander
- [ ] **Visual Mana Curve** - Interactive charts and graphs

### 🌐 Phase 3: Community Features
- [ ] **Deck Sharing** - Community deck database
- [ ] **Collection Upload** - Direct CSV upload interface
- [ ] **Price Tracking** - Card value and budget analysis
- [ ] **Tournament Mode** - Competitive deck suggestions

### 💰 Phase 4: Business Development
- [ ] **SaaS Deployment** - Cloud hosting for broader access
- [ ] **WOTC and LGS Partnerships** - Receive support from Wizards of the Coast and local game store integrations
- [ ] **Premium Features** - Advanced analytics and tools
- [ ] **Mobile App** - Native mobile experience

## 🤝 Contributing

We welcome contributions! This project is built with clean, modular code that's easy to enhance.

## Attributions

Icons from [mana-font](https://mana.andrewgioia.com/) by Andrew Gioia.
> All mana images and card symbols © Wizards of the Coast.<br>
The Mana font is licensed under the the SIL OFL 1.1.<br>
Mana CSS, LESS, and Sass files are licensed under the MIT License.<br>

## 📢 Disclaimer

> Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. SparkRoot is an unofficial, fan-made tool with no official affiliation. If Wizards of the Coast ever asks us to make changes to the branding, we’ll comply immediately.

## License

This project is licensed under the [Business Source License 1.1(BUSL-1.1)](LICENSE).
> You may make use of the Licensed Work in non-production (non-commercial) environments.<br>
Use of the Licensed Work in a production environment (commercial use, SaaS, or hosted deployment) requires purchasing a separate commercial license from the Licensor.<br>
On the Change Date, the Licensed Work will automatically transition to the Change License.

## Questions

For questions, feedback, or collaboration opportunities:

- **GitHub**: [@gurleyryan](https://github.com/gurleyryan)
- **Email**: [gurleyryan@gmail.com](mailto:gurleyryan@gmail.com)