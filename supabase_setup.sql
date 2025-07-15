-- MTG Deck Optimizer - Supabase Database Setup
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    profile_public BOOLEAN DEFAULT FALSE
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    price_source TEXT DEFAULT 'tcgplayer',
    currency TEXT DEFAULT 'USD',
    reference_price TEXT DEFAULT 'market',
    profile_public BOOLEAN DEFAULT FALSE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collections table
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    collection_data JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social integrations table
CREATE TABLE IF NOT EXISTS social_integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    provider_email TEXT,
    access_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Price cache table for API optimization
CREATE TABLE IF NOT EXISTS price_cache (
    id SERIAL PRIMARY KEY,
    card_name TEXT NOT NULL,
    set_code TEXT NOT NULL,
    source TEXT NOT NULL,
    market_price DECIMAL(10,2),
    low_price DECIMAL(10,2),
    high_price DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(card_name, set_code, source)
);

-- Deck saves table for generated decks
CREATE TABLE IF NOT EXISTS saved_decks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    commander_name TEXT NOT NULL,
    deck_data JSONB NOT NULL,
    deck_analysis JSONB,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_price_cache_card_lookup ON price_cache(card_name, set_code);
CREATE INDEX IF NOT EXISTS idx_saved_decks_user_id ON saved_decks(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_decks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see/edit their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = current_user_id());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = current_user_id());

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings FOR ALL USING (user_id = current_user_id());

-- Collections policies
CREATE POLICY "Users can manage own collections" ON collections FOR ALL USING (user_id = current_user_id());
CREATE POLICY "Public collections are viewable" ON collections FOR SELECT USING (is_public = true);

-- Social integrations policies
CREATE POLICY "Users can manage own integrations" ON social_integrations FOR ALL USING (user_id = current_user_id());

-- Saved decks policies
CREATE POLICY "Users can manage own decks" ON saved_decks FOR ALL USING (user_id = current_user_id());
CREATE POLICY "Public decks are viewable" ON saved_decks FOR SELECT USING (is_public = true);

-- Price cache is readable by all authenticated users
ALTER TABLE price_cache DISABLE ROW LEVEL SECURITY;

-- Helper function to get current user ID (you'll need to implement this in your auth)
CREATE OR REPLACE FUNCTION current_user_id() 
RETURNS INTEGER AS $$
BEGIN
    -- This will be replaced with actual JWT parsing logic
    RETURN COALESCE(
        (current_setting('app.current_user_id', true))::INTEGER,
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_social_integrations_updated_at BEFORE UPDATE ON social_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_saved_decks_updated_at BEFORE UPDATE ON saved_decks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
