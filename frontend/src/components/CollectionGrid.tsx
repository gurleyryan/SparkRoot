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
  // Fetch collections and inventory on mount for logged-in users
  const accessToken = useAuthStore((state) => state.accessToken);
  const setCollections = useCollectionStore((state) => state.setCollections);
  const setUserInventory = useCollectionStore((state) => state.setUserInventory);
  const setActiveCollection = useCollectionStore((state) => state.setActiveCollection);
  useEffect(() => {
    async function fetchCollectionsAndInventory() {
      try {
        // Fetch collections
        const collectionsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/collections`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!collectionsRes.ok) throw new Error('Failed to fetch collections');
        const collectionsData = await collectionsRes.json();
        const collections = collectionsData.collections || [];

        // Fetch inventory (all cards)
        let inventoryCards = [];
        let invData: any = null;
        try {
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/inventory`;
          const invRes = await fetch(apiUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (invRes.ok) {
            invData = await invRes.json();
            // Defensive: support both { inventory: { cards: [...] } } and { cards: [...] }
            inventoryCards = Array.isArray(invData?.inventory?.cards)
              ? invData.inventory.cards
              : Array.isArray(invData?.cards)
                ? invData.cards
                : [];
            setUserInventory(inventoryCards);
          }
        } catch (e) {
          // Optionally handle inventory fetch error
        }

        // Add synthetic inventory collection if inventory exists
        let allCollections = collections;
        let inventoryCollection = null;
        if (inventoryCards && inventoryCards.length > 0) {
          // If you have the backend inventory object (e.g., invData.inventory), use its fields:
          if (invData?.inventory) {
            inventoryCollection = {
              ...invData.inventory,
              name: 'All Cards (Inventory)',
              description: 'All cards in your account inventory',
            };
          } else {
            inventoryCollection = {
              id: 'inventory',
              name: 'All Cards (Inventory)',
              cards: inventoryCards,
              description: 'All cards in your account inventory',
              created_at: null,
              updated_at: null,
              user_id: '',
              total_cards: inventoryCards.reduce((sum: number, c: any) => sum + (c.quantity || 1), 0),
              unique_cards: new Set(inventoryCards.map((c: any) => c.id || c.name)).size,
            };
          }
          allCollections = [inventoryCollection, ...collections];
        }
        setCollections(allCollections);
        // Default to inventory collection as active
        if (inventoryCollection) {
          setActiveCollection(inventoryCollection);
        } else if (allCollections.length > 0) {
          setActiveCollection(allCollections[0]);
        }
      } catch (err) {
        // Optionally handle error
      }
    }
    if (accessToken) {
      fetchCollectionsAndInventory();
    }
  }, [accessToken, setCollections, setUserInventory, setActiveCollection]);
  const {
    collections,
    activeCollection,
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

  // Card-level search/filter/sort state for opened collection
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [cardSortField, setCardSortField] = useState<"name" | "cmc" | "rarity" | "set">("name");
  const [cardSortDir, setCardSortDir] = useState<"asc" | "desc">("asc");

  // Pagination state for CardGrid
  const [currentPage, setCurrentPage] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(100);

  // Compute filtered/sorted cards for opened collection, grouped by id and summed quantity
  const filteredSortedCards = React.useMemo(() => {
    if (!openedCollection?.cards) return [];
    let cards = [...openedCollection.cards];
    // Search by name
    if (cardSearchQuery) {
      cards = cards.filter(card => card.name.toLowerCase().includes(cardSearchQuery.toLowerCase()));
    }
    // Filter by color
    if (colorFilter) {
      if (colorFilter === "C") {
        cards = cards.filter(card => (card.colors?.length === 0));
      } else if (colorFilter === "M") {
        cards = cards.filter(card => (card.colors?.length ?? 0) > 1);
      } else {
        cards = cards.filter(card => card.colors?.includes(colorFilter));
      }
    }
    // Filter by rarity
    if (rarityFilter) {
      cards = cards.filter(card => card.rarity === rarityFilter);
    }
    // Group by id and sum quantity
    const map = new Map<string, any>();
    for (const card of cards) {
      const key = card.id || card.name;
      if (map.has(key)) {
        map.get(key).quantity = (map.get(key).quantity || 1) + (card.quantity || 1);
      } else {
        map.set(key, { ...card, quantity: card.quantity || 1 });
      }
    }
    let grouped = Array.from(map.values());
    // Sort
    grouped.sort((a, b) => {
      let cmp = 0;
      if (cardSortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (cardSortField === "cmc") {
        cmp = (a.cmc ?? 0) - (b.cmc ?? 0);
      } else if (cardSortField === "rarity") {
        const order = { common: 1, uncommon: 2, rare: 3, mythic: 4 };
        cmp = (order[a.rarity as keyof typeof order] ?? 0) - (order[b.rarity as keyof typeof order] ?? 0);
      } else if (cardSortField === "set") {
        cmp = a.set.localeCompare(b.set);
      }
      return cardSortDir === "asc" ? cmp : -cmp;
    });
    return grouped;
  }, [openedCollection, cardSearchQuery, colorFilter, rarityFilter, cardSortField, cardSortDir]);

  // Pagination logic for CardGrid
  const totalCards = filteredSortedCards.length;
  const totalPages = Math.max(1, Math.ceil(totalCards / cardsPerPage));
  const pagedCards = filteredSortedCards.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);

  // Reset to page 1 if filters or cardsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [openedCollection, cardSearchQuery, colorFilter, rarityFilter, cardsPerPage]);

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
      <div className="mb-4 container sleeve-morphism mx-auto flex flex-col backdrop-blur-sm" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
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
      {/* Main Content: CollectionList or CardGrid below controls, no background */}
      <div className="w-full flex flex-col items-center">
        {openedCollection ? (
          <>
            <div className="flex flex-col gap-2 w-full max-w-5xl mb-4">
              <div className="flex items-center gap-4 mb-2">
                <button type="button" className="btn-secondary" onClick={() => setOpenedCollectionId(null)}>
                  &larr; Back to Collections
                </button>
                <h3 className="text-2xl font-bold text-rarity-rare">{openedCollection.name}</h3>
                <span className="text-rarity-uncommon">
                  Cards: {
                    Array.isArray(openedCollection?.cards)
                      ? openedCollection.cards.reduce((sum: number, c: any) => sum + (c.quantity || 1), 0)
                      : openedCollection?.total_cards ?? 0
                  }
                </span>
                <span className="text-rarity-uncommon">
                  Unique: {
                    Array.isArray(openedCollection?.cards)
                      ? new Set(openedCollection.cards.map((c: any) => c.id || c.name)).size
                      : openedCollection?.unique_cards ?? 0
                  }
                </span>
              </div>
              {/* Card search, filter, sort, and pagination controls */}
              <div className="flex flex-wrap gap-2 items-center bg-slate-800/60 p-2 rounded-lg">
                <input
                  type="text"
                  placeholder="Search cards..."
                  className="input input-bordered input-sm w-48"
                  value={cardSearchQuery}
                  onChange={e => setCardSearchQuery(e.target.value)}
                />
                <select
                  className="select select-bordered select-sm"
                  value={colorFilter}
                  onChange={e => setColorFilter(e.target.value)}
                >
                  <option value="">All Colors</option>
                  <option value="W">White</option>
                  <option value="U">Blue</option>
                  <option value="B">Black</option>
                  <option value="R">Red</option>
                  <option value="G">Green</option>
                  <option value="C">Colorless</option>
                  <option value="M">Multicolor</option>
                </select>
                <select
                  className="select select-bordered select-sm"
                  value={rarityFilter}
                  onChange={e => setRarityFilter(e.target.value)}
                >
                  <option value="">All Rarities</option>
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="mythic">Mythic</option>
                </select>
                <select
                  className="select select-bordered select-sm"
                  value={cardSortField}
                  onChange={e => setCardSortField(e.target.value as "name" | "cmc" | "rarity" | "set")}
                >
                  <option value="name">Sort: Name</option>
                  <option value="cmc">Sort: CMC</option>
                  <option value="rarity">Sort: Rarity</option>
                  <option value="set">Sort: Set</option>
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setCardSortDir(cardSortDir === 'asc' ? 'desc' : 'asc')}
                  title="Toggle sort direction"
                >
                  {cardSortDir === 'asc' ? '⬆️ Asc' : '⬇️ Desc'}
                </button>
                <label className="ml-4 text-sm text-slate-300">Cards per page:</label>
                <select
                  className="select select-bordered select-sm"
                  value={cardsPerPage}
                  onChange={e => setCardsPerPage(Number(e.target.value))}
                >
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    className="btn btn-xs btn-outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >Prev</button>
                  <span className="px-2 text-slate-300">Page {currentPage} / {totalPages}</span>
                  <button
                    className="btn btn-xs btn-outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >Next</button>
                </div>
              </div>
            </div>
            <CardGrid cards={pagedCards} />
          </>
        ) : (
          <div className="m-auto">
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
    </>
  );
};

export default CollectionGrid;