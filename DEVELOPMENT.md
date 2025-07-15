# 🛠️ Development Setup Guide

This guide will help you set up the MTG Deck Optimizer for local development.

## Prerequisites

- Python 3.13+
- Node.js 18+
- Git

## Backend Setup

### 1. Environment Configuration

```bash
# Navigate to backend directory
cd backend

# Copy environment template
copy .env.example .env

# Edit .env with your Supabase credentials:
# - SUPABASE_URL (from your Supabase dashboard)
# - SUPABASE_ANON_KEY (from your Supabase dashboard)
# - SUPABASE_SERVICE_KEY (from your Supabase dashboard)
```

### 2. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL from `supabase_setup.sql` in your Supabase SQL Editor
3. Update your `.env` file with the connection details

### 3. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt
```

### 4. Start Backend Server

```bash
# From project root directory
python run.py
```

The backend will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- Interactive API: `http://localhost:8000/redoc`

## Frontend Setup

### 1. Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
copy .env.example .env.local

# Edit .env.local with your configuration
```

### 3. Start Frontend Server

```bash
# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Testing the Setup

### 1. Backend Health Check

```bash
curl http://localhost:8000/docs
```

### 2. Database Connection Test

```bash
# Run the connection test script
python scripts/supabase_connection_test.py
```

### 3. End-to-End Test

1. Open `http://localhost:3000` in your browser
2. Try registering a new user
3. Upload a test collection CSV
4. Generate a deck

## Common Issues

### Backend Issues

- **Import errors**: Make sure all dependencies are installed with `pip install -r requirements.txt`
- **Database connection**: Verify your Supabase credentials in `.env`
- **Port conflicts**: Backend runs on port 8000, make sure it's available

### Frontend Issues

- **Node version**: Use Node.js 18+ for compatibility
- **API connection**: Ensure backend is running on `http://localhost:8000`
- **Environment variables**: Check `.env.local` configuration

## Project Structure

```
MTG-Deck-Optimizer/
├── backend/                 # FastAPI backend
│   ├── main.py             # Main application entry
│   ├── auth_supabase.py    # Authentication & user management
│   ├── supabase_db.py      # Database connection layer
│   └── .env                # Environment variables
├── frontend/               # Next.js frontend
│   ├── src/app/           # App router pages
│   ├── src/components/    # React components
│   └── .env.local         # Frontend environment
├── scripts/               # Utility scripts
│   └── supabase_connection_test.py
└── supabase_setup.sql     # Database schema
```

## Next Steps

1. **Test the user registration flow**
2. **Set up collection upload functionality**
3. **Configure deck generation algorithms**
4. **Deploy to production (Railway + Vercel)**
