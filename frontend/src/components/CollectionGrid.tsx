import React from 'react';

import { useState, useEffect } from 'react';
import { ApiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCollectionStore } from '@/store/collectionStore';
import Image from 'next/image';
import type { MTGCard } from '@/types';

type CollectionGridProps = Record<string, unknown>; // Fix empty interface warning

// Helper function to get card properties (handles both API and CSV formats) - unused
const getCardProperty = (card: MTGCard, property: keyof MTGCard, fallback?: string): string => {
  const value = card[property];
  if (value !== undefined && value !== null) {
    return typeof value === 'string' ? value : String(value);
  }
  return fallback || '';
};

const CollectionGrid: React.FC<CollectionGridProps> = () => {
  const token = useAuthStore((s) => s.token);
  const {
    collections,
    activeCollection,
    setCollections,
    setActiveCollection,
    updateCollection,
    deleteCollection,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
  } = useCollectionStore();
  // removed loading as unused
  const [error, setError] = useState<string | null>(null);
  const [filters] = useState<{ types?: string[] }>({}); // removed setFilters as unused

  // Fetch collections on mount
  useEffect(() => {
    async function fetchCollections() {
      // setLoading(true); // removed as unused
      setError(null);
      try {
        const apiClient = new ApiClient(token || undefined);
        const result = await apiClient.getCollections();
        if (Array.isArray(result)) {
          setCollections(result);
          if (result.length > 0) setActiveCollection(result[0]);
        }
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
          setError((err as { message: string }).message || 'Failed to fetch collections');
        } else {
          setError('Failed to fetch collections');
        }
      } finally {
        // setLoading(false); // removed as unused
      }
    }
    fetchCollections();
  }, [token, setCollections, setActiveCollection]);

  // Get unique card types for filter - unused
  // removed cardTypes as unused

  // Filter collection
  const filteredCollection = (activeCollection?.cards || []).filter(card => {
    const cardName = getCardProperty(card, 'name');
    const matchesSearch = cardName.toLowerCase().includes(searchQuery.toLowerCase());
    const cardType = getCardProperty(card, 'type_line');
    const matchesType = filters.types?.length ? filters.types.includes(cardType) : true;
    return matchesSearch && matchesType;
  });

  // Get Scryfall image URL for a card
  const getCardImageUrl = (card: MTGCard): string => {
    // Use Scryfall image URL if available, otherwise use card name lookup
    if (card.image_uris?.normal) {
      return card.image_uris.normal;
    }

    // Fallback to name-based lookup
    const cardName = getCardProperty(card, 'name');
    const encodedName = encodeURIComponent(cardName);
    return `https://api.scryfall.com/cards/named?exact=${encodedName}&format=image&version=normal`;
  };

  return (
    <div className="space-y-6">
      {/* Collection Selector & Controls */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Collection Selector */}
          <div className="flex-1 max-w-md">
            <select
              value={activeCollection?.id || ''}
              onChange={e => {
                const selected = collections.find(c => c.id === e.target.value);
                if (selected) setActiveCollection(selected);
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-amber-400 focus:outline-none mb-2"
            >
              {collections.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
            >
              List
            </button>
          </div>
        </div>

        {/* Edit/Delete Buttons */}
        {activeCollection && (
          <div className="flex gap-2 mt-4">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              onClick={async () => {
                // Example: Edit collection name
                const newName = prompt('Edit collection name:', activeCollection.name);
                if (newName && newName !== activeCollection.name) {
                  try {
                    const apiClient = new ApiClient(token || undefined);
                    await apiClient.saveCollection({ ...activeCollection, name: newName });
                    updateCollection(activeCollection.id, { name: newName });
                  } catch (err: unknown) {
                    if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
                      setError((err as { message: string }).message || 'Failed to update collection');
                    } else {
                      setError('Failed to update collection');
                    }
                  }
                }
              }}
            >Edit</button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
              onClick={async () => {
                if (window.confirm('Delete this collection?')) {
                  try {
                    const apiClient = new ApiClient(token || undefined);
                    await apiClient.deleteCollectionById(activeCollection.id); // <-- FIXED
                    deleteCollection(activeCollection.id);
                  } catch (err: unknown) {
                    if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
                      setError((err as { message: string }).message || 'Failed to delete collection');
                    } else {
                      setError('Failed to delete collection');
                    }
                  }
                }
              }}
            >Delete</button>
          </div>
        )}

        {/* Results Count */}
        <div className="mt-4 text-slate-400">
          Showing {filteredCollection.length} of {(activeCollection?.cards || []).length} cards
        </div>
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </div>

      {/* Collection Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCollection.map((card, index) => {
            const cardName = getCardProperty(card, 'name', 'Unknown Card');
            const cardType = getCardProperty(card, 'type_line', 'Unknown Type');
            const manaCost = getCardProperty(card, 'mana_cost');

            return (
              <div
                key={`${cardName}-${index}`}
                className="group relative bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 hover:border-amber-400/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              >
                {/* Card Image */}
                <div className="relative aspect-[63/88] bg-slate-900">
                  <Image
                    src={getCardImageUrl(card)}
                    alt={cardName}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      // Fallback to placeholder if Scryfall image fails
                      e.currentTarget.src = '/api/placeholder/250/350';
                    }}
                  />

                  {/* Sleeve Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-900/20 pointer-events-none" />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="text-center p-4">
                      <h3 className="text-white font-bold text-sm mb-2">{cardName}</h3>
                      <p className="text-slate-300 text-xs">{cardType}</p>
                      {manaCost && (
                        <p className="text-amber-400 text-xs mt-1">{manaCost}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {filteredCollection.map((card, index) => {
            const cardName = getCardProperty(card, 'name', 'Unknown Card');
            const cardType = getCardProperty(card, 'type_line', 'Unknown Type');
            const manaCost = getCardProperty(card, 'mana_cost');
            const cmc = card.cmc || 0;

            return (
              <div
                key={`${cardName}-${index}`}
                className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700 hover:border-amber-400/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{cardName}</h3>
                    <p className="text-slate-400 text-sm">{cardType}</p>
                  </div>
                  <div className="text-right">
                    {manaCost && (
                      <p className="text-amber-400 font-mono text-sm">{manaCost}</p>
                    )}
                    {cmc !== undefined && (
                      <p className="text-slate-400 text-xs">CMC: {cmc}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredCollection.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 text-lg mb-2">No cards found</div>
          <p className="text-slate-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

export default CollectionGrid;
