import React from 'react';
// Core MTG Types
export interface MTGCard {
  id: string;
  scryfall_id?: string;
  name: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic';
  set: string;
  set_name: string;
  collector_number: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  prices?: {
    usd?: string;
    usd_foil?: string;
    eur?: string;
  };
  legalities: Record<string, 'legal' | 'not_legal' | 'restricted' | 'banned'>;
  quantity?: number;
  foil?: boolean;
  oracle_id?: string; // Scryfall UUID for oracle card
  arena_id?: number;
  mtgo_id?: number;
  mtgo_foil_id?: number;
  multiverse_ids?: number[];
  tcgplayer_id?: number;
  tcgplayer_etched_id?: number;
  cardmarket_id?: number;
  object?: string;
  layout?: string;
  prints_search_uri?: string;
  rulings_uri?: string;
  scryfall_uri?: string;
  uri?: string;
  all_parts?: unknown; // JSONB, could be more specific
  card_faces?: unknown; // JSONB, for double-faced cards
  color_indicator?: string[];
  defense?: string;
  edhrec_rank?: number;
  game_changer?: boolean;
  hand_modifier?: string;
  keywords?: string[];
  life_modifier?: string;
  loyalty?: string;
  penny_rank?: number;
  power?: string;
  produced_mana?: string[];
  reserved?: boolean;
  toughness?: string;
  artist?: string;
  artist_ids?: string[];
  attraction_lights?: string[];
  booster?: boolean;
  border_color?: string;
  card_back_id?: string;
  content_warning?: boolean;
  digital?: boolean;
  finishes?: string[];
  flavor_name?: string;
  flavor_text?: string;
  frame_effects?: string[];
  frame?: string;
  full_art?: boolean;
  games?: string[];
  highres_image?: boolean;
  illustration_id?: string;
  image_status?: string;
  oversized?: boolean;
  printed_name?: string;
  printed_text?: string;
  printed_type_line?: string;
  promo?: boolean;
  promo_types?: string[];
  purchase_uris?: Record<string, string>;
  related_uris?: Record<string, string>;
  released_at?: string;
  reprint?: boolean;
  scryfall_set_uri?: string;
  set_search_uri?: string;
  set_type?: string;
  set_uri?: string;
  set_id?: string;
  story_spotlight?: boolean;
  textless?: boolean;
  variation?: boolean;
  variation_of?: string;
  security_stamp?: string;
  watermark?: string;
  preview?: unknown; // JSONB
}

// User & Authentication Types
export interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
  app_metadata?: {
    role?: string;
    [key: string]: unknown;
  };
  role?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;  // Changed from 'username' to 'email'
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;  // Changed from 'username' to 'full_name'
  confirmPassword: string;
}

// Collection Types
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  cards: MTGCard[];
  created_at: string;
  updated_at: string;
  total_cards?: number;   // total number of cards (sum of quantities)
  unique_cards?: number;  // number of unique cards
}

export interface CollectionStats {
  total_cards: number;
  unique_cards: number;
  total_value: number;
  colors: Record<string, number>;
  rarities: Record<string, number>;
  sets: Record<string, number>;
}

// Deck Types
export interface Deck {
  id: string;
  name: string;
  commander: MTGCard;
  bracket?: number;
  cards: MTGCard[];
  description?: string;
  colors: string[];
  color_identity?: string[];
  theme?: string;
  total_cards: number;
  mana_curve: Record<number, number>;
  created_at: string;
  updated_at: string;
  analysis?: Record<string, unknown>;
}

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

// Filter & Search Types
export interface CardFilters {
  colors?: string[];
  color_identity?: string[];
  rarities?: string[];
  sets?: string[];
  types?: string[];
  cmc_min?: number;
  cmc_max?: number;
  price_min?: number;
  price_max?: number;
  name?: string;
  text?: string;
}

export interface SortOptions {
  field: keyof MTGCard;
  direction: 'asc' | 'desc';
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

// Form Types
export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
}

export interface FormState<T extends Record<string, unknown>> {
  fields: { [K in keyof T]: FormField<T[K]> };
  isValid: boolean;
  isSubmitting: boolean;
}

// File Upload Types
export interface UploadProgress {
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  message?: string;
}

export interface CSVUploadResult {
  collection: MTGCard[];
  stats: CollectionStats;
  errors?: string[];
  warnings?: string[];
}

// Settings Types
export interface UserSettings {
  theme?: 'dark' | 'light';
  default_format?: string;
  currency?: 'usd' | 'eur';
  card_display?: 'grid' | 'list';
  auto_save?: boolean;
  notifications?: {
    price_alerts?: boolean;
    deck_updates?: boolean;
    collection_changes?: boolean;
  };
  playmat_texture?: string; // e.g. "playmat-texture-1.svg"
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
