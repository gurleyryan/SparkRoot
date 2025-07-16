import React from 'react';
import { useState } from 'react';
import BracketPicker from '@/components/BracketPicker';
import { ApiClient } from '@/lib/api';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuthStore } from '@/store/authStore';

interface DeckResult {
  deck: Record<string, unknown>;
  bracket: number;
  [key: string]: unknown;
}

export default function DeckBuilder() {
  const [bracket, setBracket] = useState(2); // Default to Core
  const [commanderId] = useState('');
  const [deck, setDeck] = useState<DeckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { activeCollection } = useCollectionStore();
  const token = useAuthStore((s) => s.token);

  const handleGenerateDeck = async () => {
    setLoading(true);
    setError('');
    try {
      const apiClient = new ApiClient(token || undefined);
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
      } else if (
        result &&
        typeof result === 'object' &&
        ('error' in result || 'message' in result)
      ) {
        setError(
          ((result as { error?: string; message?: string }).error ||
            (result as { error?: string; message?: string }).message) ||
            'Failed to generate deck'
        );
      } else {
        setError('Failed to generate deck');
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string') {
        setError((err as { message: string }).message || 'Failed to generate deck');
      } else {
        setError('Failed to generate deck');
      }
    } finally {
      setLoading(false);
    }
  };

  // Optional: Filtering/sorting UI for bracket (for a list of decks)
  // This is a placeholder for future expansion

  return (
    <div className="space-y-6">
      <BracketPicker value={bracket} onChange={setBracket} />
      {/* Commander selection UI would go here */}
      <button
        className="bg-amber-600 text-white px-4 py-2 rounded"
        onClick={handleGenerateDeck}
        disabled={loading}
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
