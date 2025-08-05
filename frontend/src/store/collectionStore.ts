import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MTGCard, Collection, CollectionStats, CardFilters, SortOptions } from '@/types';

interface CollectionState {
  // Data
  collections: Collection[];
  activeCollection: Collection | null;
  cards: MTGCard[];
  filteredCards: MTGCard[];
  stats: CollectionStats | null;
  userInventory: MTGCard[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  filters: CardFilters;
  sort: SortOptions;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  
  // Actions
  setCollections: (collections: Collection[]) => void;
  setActiveCollection: (collection: Collection | null) => void;
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  
  setCards: (cards: MTGCard[]) => void;
  addCards: (cards: MTGCard[]) => void;
  updateCard: (id: string, updates: Partial<MTGCard>) => void;
  removeCard: (id: string) => void;
  
  setFilters: (filters: Partial<CardFilters>) => void;
  clearFilters: () => void;
  setSort: (sort: SortOptions) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  
  setUserInventory: (cards: MTGCard[]) => void;
  clearUserInventory: () => void;
  
  applyFilters: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const initialFilters: CardFilters = {
  colors: [],
  color_identity: [],
  rarities: [],
  sets: [],
  types: [],
  cmc_min: undefined,
  cmc_max: undefined,
  price_min: undefined,
  price_max: undefined,
  name: '',
  text: '',
};

const initialSort: SortOptions = {
  field: 'name',
  direction: 'asc',
};

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
  // Initial state
  collections: [],
  activeCollection: null,
  cards: [],
  filteredCards: [],
  stats: null,
  userInventory: [],
  
  isLoading: false,
  error: null,
  filters: initialFilters,
  sort: initialSort,
  searchQuery: '',
  viewMode: 'grid',
  
  // Collection actions
  setCollections: (collections) => set({ collections }),
  
  setActiveCollection: (collection) => {
    if (!collection) {
      set({ activeCollection: null, cards: [] });
      return;
    }
    // Defensive: ensure cards is always an array
    const safeCards = Array.isArray(collection.cards) ? collection.cards : [];
    set({ activeCollection: { ...collection, cards: safeCards }, cards: safeCards });
  },
  
  addCollection: (collection) =>
    set((state) => ({
      collections: [...state.collections, collection],
    })),
  
  updateCollection: (id, updates) =>
    set((state) => ({
      collections: state.collections.map((col) =>
        col.id === id ? { ...col, ...updates } : col
      ),
      activeCollection:
        state.activeCollection?.id === id
          ? { ...state.activeCollection, ...updates }
          : state.activeCollection,
    })),
  
  deleteCollection: (id) =>
    set((state) => ({
      collections: state.collections.filter((col) => col.id !== id),
      activeCollection:
        state.activeCollection?.id === id ? null : state.activeCollection,
    })),
  
  // Card actions
  setCards: (cards) => {
    // Defensive: ensure cards is always an array
    const safeCards = Array.isArray(cards) ? cards : [];
    set({ cards: safeCards });
  },
  
  addCards: (newCards) =>
    set((state) => {
      const cards = [...state.cards, ...newCards];
      const stats = calculateStats(cards);
      get().applyFilters();
      return { cards, stats };
    }),
  
  updateCard: (id, updates) =>
    set((state) => {
      const cards = state.cards.map((card) =>
        card.id === id ? { ...card, ...updates } : card
      );
      const stats = calculateStats(cards);
      get().applyFilters();
      return { cards, stats };
    }),
  
  removeCard: (id) =>
    set((state) => {
      const cards = state.cards.filter((card) => card.id !== id);
      const stats = calculateStats(cards);
      get().applyFilters();
      return { cards, stats };
    }),
  
  // Filter and sort actions
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
    get().applyFilters();
  },
  
  clearFilters: () => {
    set({ filters: initialFilters, searchQuery: '' });
    get().applyFilters();
  },
  
  setSort: (sort) => {
    set({ sort });
    get().applyFilters();
  },
  
  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
    get().applyFilters();
  },
  
  setViewMode: (viewMode) => set({ viewMode }),
  
  setUserInventory: (cards) => {
    const safeCards = Array.isArray(cards) ? cards : [];
    set({ userInventory: safeCards });
  },
  
  clearUserInventory: () => set({ userInventory: [] }),
  
  applyFilters: () => {
    const { cards, filters, sort, searchQuery } = get();
    
    const filtered = cards.filter((card) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !card.name.toLowerCase().includes(query) &&
          !card.oracle_text?.toLowerCase().includes(query) &&
          !card.type_line.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      
      // Color filters
      if (filters.colors && filters.colors.length > 0) {
        if (!filters.colors.some(color => card.colors.includes(color))) {
          return false;
        }
      }
      
      // Color identity filters
      if (filters.color_identity && filters.color_identity.length > 0) {
        if (!filters.color_identity.some(color => card.color_identity.includes(color))) {
          return false;
        }
      }
      
      // Rarity filters
      if (filters.rarities && filters.rarities.length > 0) {
        if (!filters.rarities.includes(card.rarity)) {
          return false;
        }
      }
      
      // Set filters
      if (filters.sets && filters.sets.length > 0) {
        if (!filters.sets.includes(card.set)) {
          return false;
        }
      }
      
      // CMC filters
      if (filters.cmc_min !== undefined && card.cmc < filters.cmc_min) {
        return false;
      }
      if (filters.cmc_max !== undefined && card.cmc > filters.cmc_max) {
        return false;
      }
      
      // Price filters
      if (filters.price_min !== undefined || filters.price_max !== undefined) {
        const price = parseFloat(card.prices?.usd || '0');
        if (filters.price_min !== undefined && price < filters.price_min) {
          return false;
        }
        if (filters.price_max !== undefined && price > filters.price_max) {
          return false;
        }
      }
      
      return true;
    });
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sort.field];
      const bValue = b[sort.field];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sort.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sort.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
    
    set({ filteredCards: filtered });
  },
  
  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),
  resetAll: () => set({
    collections: [],
    activeCollection: null,
    cards: [],
    filteredCards: [],
    stats: null,
    userInventory: [],
    isLoading: false,
    error: null,
    filters: initialFilters,
    sort: initialSort,
    searchQuery: '',
    viewMode: 'grid',
  }),
    }),
    {
      name: 'collection-storage',
      partialize: (state) => ({
        // Only persist minimal metadata for collections
        collections: Array.isArray(state.collections)
          ? state.collections.map(col => ({
              id: col.id,
              name: col.name,
              description: col.description,
              created_at: col.created_at,
              updated_at: col.updated_at,
              is_public: col.is_public,
            }))
          : [],
        // Only persist minimal user inventory
        userInventory: Array.isArray(state.userInventory)
          ? state.userInventory.map(card => ({
              id: card.id,
              name: card.name,
              quantity: card.quantity,
              set: card.set,
              collector_number: card.collector_number,
            }))
          : [],
      }),
    }
  )
);

// Helper function to calculate collection statistics
function calculateStats(cards: MTGCard[]): CollectionStats {
  const stats: CollectionStats = {
    total_cards: cards.reduce((sum, card) => sum + (card.quantity || 1), 0),
    unique_cards: cards.length,
    total_value: cards.reduce((sum, card) => {
      const price = parseFloat(card.prices?.usd || '0');
      return sum + price * (card.quantity || 1);
    }, 0),
    colors: {},
    rarities: {},
    sets: {},
  };
  
  cards.forEach((card) => {
    const quantity = card.quantity || 1;
    
    // Count colors
    card.colors.forEach((color) => {
      stats.colors[color] = (stats.colors[color] || 0) + quantity;
    });
    
    // Count rarities
    stats.rarities[card.rarity] = (stats.rarities[card.rarity] || 0) + quantity;
    
    // Count sets
    stats.sets[card.set] = (stats.sets[card.set] || 0) + quantity;
  });
  
  return stats;
}

export type { CollectionState };