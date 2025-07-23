import React from 'react';
// Core MTG Types
export interface MTGCard {
  id: string;
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
  cards: MTGCard[];
  description?: string;
  colors: string[];
  total_cards: number;
  mana_curve: Record<number, number>;
  created_at: string;
  updated_at: string;
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
