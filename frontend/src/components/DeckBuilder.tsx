import React, { useState, useMemo } from 'react';
import { useToast } from './ToastProvider';
import BracketPicker from '@/components/BracketPicker';
import { ApiClient } from '@/lib/api';
import { useCollectionStore } from '@/store/collectionStore';

export interface DeckBuilderProps {
  onDeckGenerated: (cards: any[]) => void;
  onShowGameChangers: () => void;
  onHideGameChangers?: () => void;
  loading?: boolean;
}

export default function DeckBuilder({ onDeckGenerated, onShowGameChangers, onHideGameChangers, loading: loadingProp }: DeckBuilderProps) {
  // Track if Game Changers is open (for toggle button label and behavior)
  const [gameChangersOpen, setGameChangersOpen] = useState(false);
  const showToast = useToast();
  const [bracket, setBracket] = useState(2); // Default to Core
  const [commanderId, setCommanderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { activeCollection } = useCollectionStore();

  // Memoized list of possible commanders
  const commanderOptions = useMemo(() => {
    if (!activeCollection || !Array.isArray(activeCollection.cards)) return [];
    return activeCollection.cards.filter(
      (card) =>
        typeof card.type_line === 'string' &&
        card.type_line.toLowerCase().includes('legendary creature')
    );
  }, [activeCollection]);

  const handleGenerateDeck = async () => {
    setLoading(true);
    setError('');
    try {
      const apiClient = new ApiClient();
      const result: unknown = await apiClient.generateDeck(
        activeCollection?.cards ? (activeCollection.cards as unknown as Record<string, unknown>[]) : [],
        commanderId,
        bracket
      );
      if (
        result &&
        typeof result === 'object' &&
        ('success' in result || 'deck' in result)
      ) {
        const deckCards = Array.isArray((result as any).deck)
          ? (result as any).deck
          : Object.values((result as any).deck || {});
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
    <div className="sleeve-morphism w-full flex flex-col backdrop-blur-sm" style={{backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)"}}>
      <div className="container mx-auto w-full shadow-md px-0 sm:px-0 py-0 flex flex-col">
        <h2 className="text-3xl font-mtg pt-4 pb-2 text-rarity-rare">Deck Builder</h2>
        <div className="flex flex-col md:flex-row gap-4 pb-4 items-start">
          <div className="flex-1 min-w-[260px] flex flex-col gap-4">
            <BracketPicker value={bracket} onChange={setBracket} className="mb-2" onlyButtons />
            <div className="flex flex-col gap-2">
              <label htmlFor="commander-picker" className="block text-mtg-white font-semibold mb-1">Choose Commander</label>
              <select
                id="commander-picker"
                className="form-input w-full px-3 py-2 rounded border border-mtg-blue bg-black text-white mb-1"
                value={commanderId}
                onChange={e => setCommanderId(e.target.value)}
              >
                <option value="">-- Select a Commander --</option>
                {commanderOptions.map(card => (
                  <option key={card.id} value={card.id}>
                    {card.name} {card.mana_cost ? `(${card.mana_cost})` : ''}
                  </option>
                ))}
              </select>
              {commanderOptions.length === 0 && (
                <div className="text-slate-400 text-sm mb-1">No eligible commanders found in your collection.</div>
              )}
              {error && <div className="text-red-500 mt-1">{error}</div>}
            </div>
          </div>
          <div className="flex-1 min-w-[260px] flex flex-col gap-2">
            <BracketPicker value={bracket} onChange={setBracket} className="mb-2" onlyDescription />
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
