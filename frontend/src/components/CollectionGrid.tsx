import React, { useState } from "react";
import { useCollectionStore } from "../store/collectionStore";
import CollectionList from "./CollectionList";
import CardGrid from "./CardGrid";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./ToastProvider"; // adjust path if needed
type CollectionGridProps = Record<string, unknown>; // Fix empty interface warning

const CollectionGrid: React.FC<CollectionGridProps> = () => {
  const {
    collections,
    activeCollection,
    setActiveCollection,
    deleteCollection,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
  } = useCollectionStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'name' | 'created_at'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
  const [openedCollectionId, setOpenedCollectionId] = useState<string | null>(null);
  const showToast = useToast();

  // Find the opened collection object
  const openedCollection = collections.find(c => c.id === openedCollectionId);

  // Sort collections based on active sort field and direction
  const sortedCollections = [...collections].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'created_at') {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleConfirmDelete(): void {
    if (collectionToDelete) {
      deleteCollection(collectionToDelete);
      showToast('Collection deleted', 'success');
      setCollectionToDelete(null);
      setShowDeleteModal(false);
      // If the deleted collection was active, clear activeCollection
      if (activeCollection?.id === collectionToDelete) {
        setActiveCollection(null);
      }
    }
  }

  const [, setShowImport] = useState(false);
  const [, setShowExport] = useState(false);
  const [, setShowRename] = useState(false);

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
              <div className="flex gap-2 items-center mt-2">
                <label className="text-slate-300 text-sm">View:</label>
                <button
                  className={`btn-secondary px-2 py-1 ${viewMode === 'grid' ? 'bg-mtg-blue text-white' : ''}`}
                  onClick={() => setViewMode('grid')}
                >Grid</button>
                <button
                  className={`btn-secondary px-2 py-1 ${viewMode === 'list' ? 'bg-mtg-blue text-white' : ''}`}
                  onClick={() => setViewMode('list')}
                >List</button>
              </div>
            </div>
            <input
              type="text"
              className="form-input px-2 py-1 rounded border border-mtg-blue bg-black text-white"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

          </div>
        </div>
        {/* Render collections or cards in opened collection */}
        <div className="py-4">
          {openedCollection ? (
            <>
              <div className="flex items-center gap-4 mb-4">
                <button className="btn-secondary" onClick={() => setOpenedCollectionId(null)}>
                  &larr; Back to Collections
                </button>
                <h3 className="text-2xl font-bold text-rarity-rare">{openedCollection.name}</h3>
                <span className="text-slate-400">{openedCollection.cards?.length ?? 0} cards</span>
              </div>
              <CardGrid cards={openedCollection.cards || []} />
            </>
          ) : (
            <CollectionList
              collections={sortedCollections.filter(col => col.name.toLowerCase().includes(searchQuery.toLowerCase()))}
              viewMode={viewMode}
              selectedId={activeCollection?.id}
              onSelect={id => setActiveCollection(collections.find(c => c.id === id) || null)}
              onOpen={id => setOpenedCollectionId(id)}
            />
          )}
        </div>
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
    </div>
  );
}

export default CollectionGrid;