# Deployment Guide

## Railway Deployment

This project is configured to deploy on Railway using the following setup:

### Project Structure
- `backend/` - FastAPI backend application
- `frontend/` - Next.js frontend application  
- `data/` - Data storage directory (created during deployment)
- `run.py` - Railway deployment runner script

### Deployment Configuration
- **Primary config**: `railway.json` with `nixpacks.toml`
- **Start command**: `python run.py`
- **Health check**: `/health` endpoint
- **Port**: Automatically assigned by Railway via `$PORT` environment variable

### Build Process
1. Install Python dependencies from `backend/requirements.txt`
2. Create `data/` directory
3. Download Scryfall card data via `download_data.py`
4. Start FastAPI server using `run.py`

### Key Files
- `run.py` - Main entry point that sets up Python path and starts uvicorn
- `nixpacks.toml` - Build configuration for Railway
- `railway.json` - Railway deployment settings
- `backend/main.py` - FastAPI application

### Troubleshooting
- The app runs from the root directory but imports from `backend/`
- Data files are stored in `data/` relative to project root
- All file paths in backend code use `../data/` to reference data directory

### Local Development
```bash
# Install dependencies
pip install -r backend/requirements.txt

# Download data
python download_data.py

# Start server
python run.py
```

## Docker Deployment

Use the included `Dockerfile` for containerized deployment:

```bash
docker build -t mtg-deck-optimizer .
docker run -p 8000:8000 mtg-deck-optimizer
```

## Vercel Deployment (Frontend Only)

The frontend can be deployed separately to Vercel using the `vercel.json` configuration.
