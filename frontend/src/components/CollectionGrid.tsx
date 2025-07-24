import React, { useState, useEffect } from "react";
import CollectionUpload from "./CollectionUpload";
import { useCollectionStore } from "../store/collectionStore";
import CollectionList from "./CollectionList";
import CardGrid from "./CardGrid";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./ToastProvider";
import { useAuthStore } from "../store/authStore";
type CollectionGridProps = Record<string, unknown>;

const CollectionGrid: React.FC<CollectionGridProps> = () => {
  // Fetch collections on mount for logged-in users
  const accessToken = useAuthStore((state) => state.accessToken);
  const setCollections = useCollectionStore((state) => state.setCollections);
  useEffect(() => {
    async function fetchCollections() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/collections`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error('Failed to fetch collections');
        const data = await res.json();
        setCollections(data.collections || []);
      } catch (err) {
        // Optionally handle error
      }
    }
    if (accessToken) {
      fetchCollections();
    }
  }, [accessToken, setCollections]);
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

  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Handler for selecting a collection card
  function handleSelectCollection(id: string) {
    const selected = collections.find(c => c.id === id);
    if (selected) {
      setActiveCollection(selected);
      // Defensive: ensure cards is always an array
      if (Array.isArray(selected.cards)) {
        // Optionally set cards in store if needed
        // setCards(selected.cards); // Uncomment if you want to sync cards separately
      }
    }
  }

  return (
    <>
      {/* Import Modal - overlays entire app */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="sleeve-morphism p-6 rounded-xl max-w-2xl w-full relative" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-rarity-rare">Import Collection</h2>
              <button
                className="btn-secondary text-white px-3 rounded"
                onClick={() => setShowImportModal(false)}
              >
                Close
              </button>
            </div>
            <CollectionUpload onCollectionUploaded={() => setShowImportModal(false)} />
          </div>
        </div>
      )}

      {/* Main grid UI */}
      <div className="container sleeve-morphism mx-auto flex flex-col backdrop-blur-sm" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
        <div className="container mx-auto shadow-md px-4 flex flex-col">
          <div className="flex flex-col md:flex-row gap-4 pb-4 items-start">
            {/* Left column: buttons and collection dropdown */}
            <div className="flex-1 flex flex-col">
              <div className="flex flex-row items-end justify-between mb-4">
                <h2 className="text-3xl font-mtg pt-4 text-rarity-rare">Collection</h2>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-secondary" onClick={() => setShowImportModal(true)}>Import</button>
                  <button className="btn-secondary" onClick={() => setShowExportModal(true)} disabled={!activeCollection}>Export</button>
                  <button className="btn-secondary" onClick={() => setShowRenameModal(true)} disabled={!activeCollection}>Rename/Edit</button>
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
              </div>
              <select
                value={activeCollection?.id || ''}
                onChange={e => {
                  const selected = collections.find(c => c.id === e.target.value);
                  if (selected) setActiveCollection(selected);
                }}
                className="form-input px-2 py-2 bg-mtg-black border border-mtg-blue rounded-lg text-white focus:border-rarity-mythic focus:outline-none cursor-pointer"
              >
                <option value="">Select a collection...</option>
                {collections.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
            {/* Right column: controls and main content */}
            <div className="flex-[1]">
              <div className="rounded-xl shadow-lg flex flex-col md:flex-row gap-4 py-3 items-start flex-shrink-0">
                <div className="flex-1 min-w-[260px] flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <label className="text-rarity-uncommon text-sm">Sort by:</label>
                    <select className="form-input px-2 py-2 rounded border border-mtg-blue bg-mtg-black text-white cursor-pointer" value={sortField} onChange={e => setSortField(e.target.value as 'name' | 'created_at')}>
                      <option value="name">Name</option>
                      <option value="created_at">Created</option>
                    </select>
                    <select className="form-input px-2 py-2 rounded border border-mtg-blue bg-mtg-black text-white cursor-pointer" value={sortDir} onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}>
                      <option value="asc">Asc</option>
                      <option value="desc">Desc</option>
                    </select>
                    <div className="flex gap-2 items-center">
                      <label className="text-rarity-uncommon text-sm">View:</label>
                      <button
                        type="button"
                        className={`btn-secondary px-2 py-2 ${viewMode === 'grid' ? 'bg-mtg-blue text-white' : ''}`}
                        onClick={() => setViewMode('grid')}
                      >Grid</button>
                      <button
                        type="button"
                        className={`btn-secondary px-2 py-2 ${viewMode === 'list' ? 'bg-mtg-blue text-white' : ''}`}
                        onClick={() => setViewMode('list')}
                      >List</button>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="form-input px-2 py-2 rounded border border-mtg-blue bg-mtg-black text-white"
                    placeholder="Search collections..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {/* Main Content: CollectionList or CardGrid below controls, no background */}
              <div className="w-full flex flex-col items-center">
                {openedCollection ? (
                  <>
                    <div className="flex items-center gap-4 mb-4 w-full max-w-6xl">
                      <button type="button" className="btn-secondary" onClick={() => setOpenedCollectionId(null)}>
                        &larr; Back to Collections
                      </button>
                      <h3 className="text-2xl font-bold text-rarity-rare">{openedCollection.name}</h3>
                      <span className="text-rarity-uncommon">{openedCollection.cards?.length ?? 0} cards</span>
                    </div>
                    <CardGrid cards={openedCollection.cards || []} />
                  </>
                ) : (
                  <div className="w-full max-w-6xl">
                    <CollectionList
                      collections={sortedCollections.filter(col => col.name.toLowerCase().includes(searchQuery.toLowerCase()))}
                      viewMode={viewMode}
                      selectedId={activeCollection?.id}
                      onSelect={handleSelectCollection}
                      onOpen={id => setOpenedCollectionId(id)}
                      className="bg-transparent"
                    />
                  </div>
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
              {/* Export and Rename modals */}
              {showExportModal && (
                <ConfirmModal
                  open={showExportModal}
                  title="Export Collection"
                  message="Export modal placeholder. Implement export logic here."
                  confirmText="Close"
                  cancelText="Cancel"
                  onConfirm={() => setShowExportModal(false)}
                  onCancel={() => setShowExportModal(false)}
                />
              )}
              {showRenameModal && (
                <ConfirmModal
                  open={showRenameModal}
                  title="Rename/Edit Collection"
                  message="Rename/Edit modal placeholder. Implement edit logic here."
                  confirmText="Close"
                  cancelText="Cancel"
                  onConfirm={() => setShowRenameModal(false)}
                  onCancel={() => setShowRenameModal(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CollectionGrid;