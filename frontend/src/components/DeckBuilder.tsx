import React, { useState, useMemo } from 'react';
import { useToast } from './ToastProvider';
import BracketPicker from '@/components/BracketPicker';
import { ApiClient } from '@/lib/api';
import type { MTGCard } from '@/types/index';
import { useCollectionStore } from '@/store/collectionStore';
import CardGrid from './CardGrid';

export interface DeckBuilderProps {
  onDeckGenerated: (cards: MTGCard[]) => void;
  onShowGameChangers: () => void;
  onHideGameChangers?: () => void;
  loading?: boolean;
}

export default function DeckBuilder({ onDeckGenerated, onShowGameChangers, onHideGameChangers, loading: loadingProp }: DeckBuilderProps) {
  // Track if Game Changers is open (for toggle button label and behavior)
  const [gameChangersOpen, setGameChangersOpen] = useState(false);
  const showToast = useToast();
  const [bracket, setBracket] = useState(1); // Default to 1 for House Rules
  const [commanderId, setCommanderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [houseRules, setHouseRules] = useState(false);
  const saltOptions = [
    { label: 'Allow all', value: 99 },
    { label: 'Salt weight < 3', value: 3 },
    { label: 'Salt weight < 2', value: 2 },
    { label: 'No salty cards', value: 1 },
  ];
  const [saltThreshold, setSaltThreshold] = useState(saltOptions[0].value);
  const [deck, setDeck] = useState<MTGCard[]>([]);
  const { collections, userInventory } = useCollectionStore();

  // Local state for card source selection: 'inventory' or collection id
  const [cardSourceType, setCardSourceType] = useState<string>(() => 'inventory');

  // Find the selected collection (if any)
  const selectedCollection = useMemo(() => {
    if (cardSourceType === 'inventory') return null;
    return collections.find(col => col.id === cardSourceType) || null;
  }, [cardSourceType, collections]);

  // Use selected collection or full inventory as card source
  const cardSource = useMemo(() => {
    if (selectedCollection && Array.isArray(selectedCollection.cards) && selectedCollection.cards.length > 0) {
      return selectedCollection.cards;
    }
    if (userInventory && Array.isArray(userInventory)) {
      return userInventory;
    }
    return [];
  }, [selectedCollection, userInventory]);

  // Memoized list of possible commanders (from cardSource)
  const commanderOptions = useMemo(() => {
    return cardSource.filter(
      (card: MTGCard) =>
        typeof card.type_line === 'string' &&
        card.type_line.toLowerCase().includes('legendary creature')
    );
  }, [cardSource]);

  const handleGenerateDeck = async () => {
    setLoading(true);
    setError('');
    try {
      const apiClient = new ApiClient();
      const result: unknown = await apiClient.generateDeck(
        cardSource as unknown as Record<string, unknown>[],
        commanderId,
        bracket,
        houseRules,
        saltThreshold
      );
      if (
        result &&
        typeof result === 'object' &&
        ('success' in result || 'deck' in result)
      ) {
        const deckRaw = (result as { deck?: unknown }).deck;
        let deckCards: MTGCard[] = [];
        if (Array.isArray(deckRaw)) {
          deckCards = deckRaw as MTGCard[];
        } else if (deckRaw && typeof deckRaw === 'object') {
          deckCards = Object.values(deckRaw) as MTGCard[];
        }
        setDeck(deckCards);
        onDeckGenerated(deckCards);
        showToast('Deck generated successfully!', 'success');
      } else if (
        result &&
        typeof result === 'object' &&
        ('error' in result || 'message' in result)
      ) {
        const msg = ((result as { error?: string; message?: string }).error ||
          (result as { error?: string; message?: string }).message) ||
          'Failed to generate deck';
        setError(msg);
        showToast(msg, 'error');
      } else {
        setError('Failed to generate deck');
        showToast('Failed to generate deck', 'error');
      }
    } catch (err: unknown) {
      let msg = 'Failed to generate deck';
      if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
        msg = (err as { message: string }).message || msg;
      }
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler for Game Changer button toggle
  const handleGameChangersToggle = () => {
    setGameChangersOpen((open) => !open);
  };

  // Call parent handler when gameChangersOpen changes
  React.useEffect(() => {
    if (gameChangersOpen) {
      onShowGameChangers();
    } else if (typeof onHideGameChangers === 'function') {
      onHideGameChangers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameChangersOpen]);

  return (
    <div className="container mx-auto sleeve-morphism w-full flex flex-col backdrop-blur-sm" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
      <div className="container mx-auto w-full shadow-md px-4 py-0 flex flex-col">
        <h2 className="text-3xl font-mtg pt-4 pb-2 text-rarity-rare">Deck Builder</h2>
        <div className="mb-4">
          <label htmlFor="card-source-select" className="block text-slate-200 font-semibold mb-1">Choose Card Source</label>
          <select
            id="card-source-select"
            className="w-full rounded-md border border-slate-600 bg-mtg-black text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mtg-blue"
            value={cardSourceType}
            onChange={e => setCardSourceType(e.target.value)}
          >
            {collections.map(col => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>
        </div>
        {/* Commander selection dropdown */}
        <div className="mb-4">
          <label htmlFor="commander-select" className="block text-slate-200 font-semibold mb-1">Choose Commander</label>
          <select
            id="commander-select"
            className="w-full rounded-md border border-slate-600 bg-mtg-black text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mtg-blue"
            value={commanderId}
            onChange={e => setCommanderId(e.target.value)}
            disabled={commanderOptions.length === 0}
          >
            <option value="">-- Select a Commander --</option>
            {commanderOptions.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          {commanderOptions.length === 0 && (
            <div className="text-red-400 mt-2">No eligible commanders found in this source.</div>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-4 pb-4 items-start">
          <div className="flex-1 min-w-[260px] flex flex-col gap-4">
            <div className="flex flex-row items-center gap-2 mb-2">
              <input
                id="house-rules-checkbox"
                type="checkbox"
                checked={houseRules}
                onChange={e => {
                  setHouseRules(e.target.checked);
                  if (e.target.checked) setBracket(1);
                }}
                className="form-checkbox h-5 w-5 text-mtg-blue"
                disabled={loadingProp || loading}
              />
              <label htmlFor="house-rules-checkbox" className="text-mtg-white font-semibold select-none cursor-pointer">Enable House Rules</label>
            </div>
            <BracketPicker
              value={bracket}
              onChange={setBracket}
              className="mb-2"
              onlyButtons
              disabledBrackets={houseRules ? [2, 3, 4, 5] : []}
            />
            <div className="flex flex-col gap-2">
              <label htmlFor="salt-select" className="block text-mtg-white font-semibold mb-1">Salt Filtering:</label>
              <select
                id="salt-select"
                className="form-input w-full px-3 py-2 rounded border border-mtg-blue bg-black text-white mb-1"
                value={saltThreshold}
                onChange={e => setSaltThreshold(Number(e.target.value))}
                disabled={loadingProp || loading}
              >
                {saltOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="text-xs text-slate-400">Choose how strictly to filter salty cards. "Salt weight" combines salt score, years included, and recency.</div>
              {commanderOptions.length === 0 && (
                <div className="text-slate-400 text-sm mb-1">No eligible commanders found in your collection.</div>
              )}
              {error && <div className="text-red-500 mt-1">{error}</div>}
            </div>
            <div className="flex flex-col gap-2 mt-2">
            </div>
          </div>
          <div className="flex-1 min-w-[260px] flex flex-col gap-2">
            <BracketPicker
              value={bracket}
              onChange={setBracket}
              className="mb-2"
              onlyDescription
              disabledBrackets={houseRules ? [2, 3, 4, 5] : []}
            />
            <div className="flex flex-row gap-2 items-start mt-2 w-full">
              <button
                className="btn-primary text-sm py-3 grow basis-3/4"
                style={{ minWidth: 0 }}
                onClick={handleGenerateDeck}
                disabled={loadingProp || loading || !commanderId}
              >
                {loadingProp || loading ? 'Generating...' : 'Generate Deck'}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm px-2 py-1 rounded-md border transition-all grow basis-1/4 w-full font-semibold"
                style={{ minWidth: 0, fontWeight: 500 }}
                onClick={handleGameChangersToggle}
                disabled={loadingProp || loading}
              >
                {gameChangersOpen ? 'Exile Game Changers' : 'Summon Game Changers'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
