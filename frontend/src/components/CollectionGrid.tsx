import React from 'react';
import DetailModal from './DetailModal';
import { useToast } from './ToastProvider';
import { useState, useEffect } from 'react';
import { ApiClient } from '@/lib/api';
import { useCollectionStore } from '@/store/collectionStore';
import Image from 'next/image';
import type { MTGCard } from '@/types';
import ConfirmModal from "./ConfirmModal";

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
  const showToast = useToast();
  // Removed: token (secure session via cookie)
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
  const [filters] = useState<{ types?: string[] }>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState(activeCollection?.name || "");
  const [renameDesc, setRenameDesc] = useState(activeCollection?.description || "");
  const [renaming, setRenaming] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'created_at'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);

  // Fetch collections on mount
  useEffect(() => {
    async function fetchCollections() {
      setError(null);
      try {
        const apiClient = new ApiClient();
        const result = await apiClient.getCollections();
        if (Array.isArray(result)) {
          setCollections(result);
          if (result.length > 0) setActiveCollection(result[0]);
        }
      } catch (err: unknown) {
        let msg = 'Failed to fetch collections';
        if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
          msg = (err as { message: string }).message || msg;
        }
        setError(msg);
        // Only show toast if user is authenticated or attempted a protected action
        // (Do not show on mount for unauthenticated users)
        // Optionally, check isAuthenticated here if available
      }
    }
    fetchCollections();
  }, [setCollections, setActiveCollection]);

  // Sort collections
  const sortedCollections = [...collections].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'created_at') {
      cmp = (a.created_at || '').localeCompare(b.created_at || '');
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

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

  // Handler for delete button
  const handleDeleteClick = (collectionId: string) => {
    setCollectionToDelete(collectionId);
    setShowDeleteModal(true);
  };

  // Handler for confirming deletion
  const handleConfirmDelete = async () => {
    if (!collectionToDelete) return;
    try {
      await deleteCollection(collectionToDelete);
      setShowDeleteModal(false);
      setCollectionToDelete(null);
      showToast('Collection deleted', 'success');
    } catch (err) {
      showToast('Failed to delete collection', 'error');
    }
  };

  // Main component return
  return (
    <div className="sleeve-morphism w-full flex flex-col backdrop-blur-sm" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
      <div className="container mx-auto w-full shadow-md px-0 sm:px-0 py-0 flex flex-col">
          <h2 className="text-3xl font-mtg pt-4 pb-2 text-rarity-rare">Collection</h2>
          <div className="flex flex-col md:flex-row gap-4 pb-4 items-start">
  {/* Left column: buttons and collection dropdown */}
  <div className="flex-1 min-w-[260px] flex flex-col gap-4">
    <div className="flex gap-2 flex-wrap mb-2">
      <button className="btn-secondary" onClick={() => setShowImport(true)}>Import</button>
      <button className="btn-secondary" onClick={() => setShowExport(true)} disabled={!activeCollection}>Export</button>
      <button className="btn-secondary" onClick={() => setShowRename(true)} disabled={!activeCollection}>Rename/Edit</button>
      <button
        className="btn-secondary text-red-500 border-red-500"
        onClick={() => {
          selectedIds.forEach(id => {
            deleteCollection(id);
            showToast('Collection deleted', 'success');
          });
          setSelectedIds([]);
        }}
        disabled={selectedIds.length === 0}
      >
        Delete Selected
      </button>
    </div>
    <select
              value={activeCollection?.id || ''}
              onChange={e => {
                const selected = collections.find(c => c.id === e.target.value);
                if (selected) setActiveCollection(selected);
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-rarity-uncommon rounded-lg text-white focus:border-rarity-mythic focus:outline-none mb-2"
            >
              {sortedCollections.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
  </div>
  {/* Right column: sorting and search */}
  <div className="flex-1 min-w-[260px] flex flex-col gap-2">
    <div className="flex gap-2 items-center mb-2">
      <label className="text-slate-300 text-sm">Sort by:</label>
      <select className="form-input px-2 py-1 rounded border border-mtg-blue bg-black text-white" value={sortField} onChange={e => setSortField(e.target.value as any)}>
        <option value="name">Name</option>
        <option value="created_at">Created</option>
      </select>
      <select className="form-input px-2 py-1 rounded border border-mtg-blue bg-black text-white" value={sortDir} onChange={e => setSortDir(e.target.value as any)}>
        <option value="asc">Asc</option>
        <option value="desc">Desc</option>
      </select>
    </div>
    <div className="relative">
      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        placeholder="Search cards..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-rarity-uncommon rounded-lg text-white placeholder-slate-400 focus:border-rarity-mythic focus:outline-none"
      />
    </div>
  </div>
</div>
        {/* Import Modal */}
        {showImport && (
          <DetailModal open={showImport} title="Import Collection" onClose={() => setShowImport(false)}>
            <form
              onSubmit={async e => {
                e.preventDefault();
                setImporting(true);
                setImportError(null);
                try {
                  const fileInput = (e.target as HTMLFormElement).elements.namedItem('importFile') as HTMLInputElement;
                  if (!fileInput?.files?.[0]) throw new Error('No file selected');
                  const file = fileInput.files[0];
                  const api = new ApiClient();
                  // Try both parseCollection and parseCollectionPublic endpoints
                  let parsed;
                  try {
                    parsed = await api.parseCollection(file);
                  } catch {
                    parsed = await api.parseCollectionPublic(file);
                  }
                  const p: any = parsed;
                  const cards = Array.isArray(p.cards)
                    ? p.cards
                    : Array.isArray(p.collection)
                      ? p.collection
                      : null;
                  if (!cards) throw new Error('Failed to parse collection');
                  // Add as new collection
                  await api.saveCollection({
                    name: file.name.replace(/\.[^.]+$/, ''),
                    cards,
                  });
                  showToast('Collection imported', 'success');
                  setShowImport(false);
                } catch (err: any) {
                  setImportError(err.message || 'Import failed');
                  showToast(err.message || 'Import failed', 'error');
                } finally {
                  setImporting(false);
                }
              }}
            >
              <input type="file" name="importFile" accept=".csv,.txt,.xls,.xlsx" className="mb-4" required />
              <div className="flex gap-4 justify-end">
                <button className="btn-secondary" type="button" onClick={() => setShowImport(false)} disabled={importing}>Cancel</button>
                <button className="btn-primary" type="submit" disabled={importing}>{importing ? 'Importing...' : 'Import'}</button>
              </div>
              {importError && <div className="text-red-500 mt-2">{importError}</div>}
            </form>
          </DetailModal>
        )}
        {/* Export Modal */}
        {showExport && (
          <DetailModal open={showExport} title="Export Collection" onClose={() => setShowExport(false)}>
            <div className="mb-4 text-mtg-white">Export your current collection as CSV.</div>
            <div className="flex gap-4 justify-end">
              <button className="btn-secondary" type="button" onClick={() => setShowExport(false)} disabled={exporting}>Cancel</button>
              <button
                className="btn-primary"
                type="button"
                disabled={exporting || !activeCollection}
                onClick={async () => {
                  if (!activeCollection) return;
                  setExporting(true);
                  setExportError(null);
                  try {
                    // Convert cards to CSV (simple format)
                    const headers = ['Name', 'Mana Cost', 'CMC', 'Type', 'Oracle Text', 'Colors', 'Set', 'Rarity'];
                    const rows = activeCollection.cards.map(card => [
                      card.name,
                      card.mana_cost || '',
                      card.cmc || '',
                      card.type_line || '',
                      card.oracle_text || '',
                      (card.colors || []).join(' '),
                      card.set || '',
                      card.rarity || '',
                    ]);
                    const csv = [headers.join(','), ...rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))].join('\r\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeCollection.name || 'collection'}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }, 100);
                    showToast('Collection exported', 'success');
                    setShowExport(false);
                  } catch (err: any) {
                    setExportError(err.message || 'Export failed');
                    showToast(err.message || 'Export failed', 'error');
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                {exporting ? 'Exporting...' : 'Export as CSV'}
              </button>
            </div>
            {exportError && <div className="text-red-500 mt-2">{exportError}</div>}
          </DetailModal>
        )}
        {/* Rename/Edit Modal */}
        {showRename && (
          <DetailModal open={showRename} title="Rename/Edit Collection" onClose={() => setShowRename(false)}>
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!activeCollection) return;
                setRenaming(true);
                try {
                  const api = new ApiClient();
                  await api.saveCollection({
                    ...activeCollection,
                    name: renameValue,
                    description: renameDesc,
                  });
                  updateCollection(activeCollection.id, { name: renameValue, description: renameDesc });
                  showToast('Collection updated', 'success');
                  setShowRename(false);
                } catch (err: any) {
                  showToast(err.message || 'Rename failed', 'error');
                } finally {
                  setRenaming(false);
                }
              }}
            >
              <div className="mb-4">
                <label className="block text-mtg-white mb-2">Name</label>
                <input
                  className="form-input w-full"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-mtg-white mb-2">Description</label>
                <textarea
                  className="form-input w-full"
                  value={renameDesc}
                  onChange={e => setRenameDesc(e.target.value)}
                />
              </div>
              <div className="flex gap-4 justify-end">
                <button className="btn-secondary" type="button" onClick={() => setShowRename(false)} disabled={renaming}>Cancel</button>
                <button className="btn-primary" type="submit" disabled={renaming}>{renaming ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </DetailModal>
        )}
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
                className="group relative bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-rarity-uncommon hover:border-rarity-mythic/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
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
                      <p className="text-slate-300 text-sm">{cardType}</p>
                      {manaCost && (
                        <p className="text-amber-400 text-sm mt-1">{manaCost}</p>
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
                className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-rarity-uncommon hover:border-rarity-mythic/50 transition-colors"
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
                      <p className="text-slate-400 text-sm">CMC: {cmc}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    <ConfirmModal
      open={showDeleteModal}
      title="Delete Collection?"
      message="Are you sure you want to delete this collection? This action cannot be undone."
      confirmText="Delete"
      cancelText="Cancel"
      onConfirm={handleConfirmDelete}
      onCancel={() => setShowDeleteModal(false)}
    />
  </div>
  );
};

export default CollectionGrid;