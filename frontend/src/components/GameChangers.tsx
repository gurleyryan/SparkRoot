"use client";
import React from "react";
import { useAuthStore } from '@/store/authStore';
import CardGrid from "./CardGrid";
import type { MTGCard } from '@/types/index';

const GameChangers: React.FC = () => {
  const [gameChangerCards, setGameChangerCards] = React.useState<Partial<MTGCard>[]>([]);
  const [loadingCards, setLoadingCards] = React.useState(false);
  const [errorCards, setErrorCards] = React.useState<string | null>(null);

  // Fetch all cards with game_changer = true from your backend API
  React.useEffect(() => {
    setLoadingCards(true);
    setErrorCards(null);
    const fetchWithAuth = useAuthStore.getState().fetchWithAuth;
    fetchWithAuth('/api/cards?game_changer=true')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch game changer cards');
        return res.json();
      })
      .then(data => {
        setGameChangerCards(data.cards || []);
      })
      .catch(() => setErrorCards('Failed to load game changer cards.'))
      .finally(() => setLoadingCards(false));
  }, []);

  // Only render CardGrid with game changer cards
  if (loadingCards) {
    return <div className="text-slate-300 py-8 text-center w-full">Loading cards...</div>;
  }
  if (errorCards) {
    return <div className="text-red-400 py-8 text-center w-full">{errorCards}</div>;
  }
  // Parse image_uris and card_faces if they are strings, and filter out cards missing required fields
  const validCards = gameChangerCards
    .map(card => {
      let parsed = { ...card };
      if (parsed && typeof parsed.image_uris === 'string') {
        try {
          parsed.image_uris = JSON.parse(parsed.image_uris);
        } catch {
          // Ignore JSON parse errors
        }
      }
      if (parsed && typeof parsed.card_faces === 'string') {
        try {
          parsed.card_faces = JSON.parse(parsed.card_faces);
        } catch {
          // Ignore JSON parse errors
        }
      }
      return parsed;
    })
    .filter(
      (card): card is MTGCard =>
        typeof card.id === 'string' && typeof card.name === 'string' && typeof card.set === 'string'
    );
  return <CardGrid cards={validCards} />;
};

export default GameChangers;
