import React, { useState, useMemo } from 'react';
import { useToast } from './ToastProvider';
import BracketPicker from '@/components/BracketPicker';
import { ApiClient } from '@/lib/api';
import { useCollectionStore } from '@/store/collectionStore';
// ...existing code...

interface DeckResult {
  deck: Record<string, unknown>;
  bracket: number;
  [key: string]: unknown;
}

export default function DeckBuilder() {
  const showToast = useToast();
  const [bracket, setBracket] = useState(2); // Default to Core
  const [commanderId, setCommanderId] = useState('');
  const [deck, setDeck] = useState<DeckResult | null>(null);
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
  // Removed: token (secure session via cookie)

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
        setDeck(result as DeckResult);
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

  // Optional: Filtering/sorting UI for bracket (for a list of decks)
  // This is a placeholder for future expansion

  return (
    <div className="space-y-6">
      <BracketPicker value={bracket} onChange={setBracket} />
      {/* Commander Picker Dropdown */}
      <div>
        <label htmlFor="commander-picker" className="block text-mtg-white font-semibold mb-2">Choose Commander</label>
        <select
          id="commander-picker"
          className="form-input w-full px-4 py-2 rounded border border-mtg-blue bg-black text-white mb-4"
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
          <div className="text-slate-400 text-sm mb-2">No eligible commanders found in your collection.</div>
        )}
      </div>
      <button
        className="bg-amber-600 text-white px-4 py-2 rounded"
        onClick={handleGenerateDeck}
        disabled={loading || !commanderId}
      >
        {loading ? 'Generating...' : 'Generate Deck'}
      </button>
      {error && <div className="text-red-500">{error}</div>}
      {deck && (
        <div className="mt-6">
          <div className="font-bold text-lg text-amber-400 mb-2">Bracket: {deck.bracket || bracket}</div>
          {/* Render deck list here, including bracket info */}
          <pre className="bg-slate-900 text-slate-200 p-4 rounded overflow-x-auto text-xs">{JSON.stringify(deck, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
