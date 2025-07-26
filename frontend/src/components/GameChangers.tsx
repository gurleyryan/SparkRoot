"use client";

import React from "react";
import CardGrid from "./CardGrid";
import type { MTGCard } from '@/types/index';

// Extend MTGCard for Scryfall fields used in this component
type MTGCardExtended = MTGCard & {
  set_icon_svg_uri?: string;
};

const GameChangers: React.FC = () => {
  const [gameChangerCards, setGameChangerCards] = React.useState<Partial<MTGCardExtended>[]>([]);
  const [loadingCards, setLoadingCards] = React.useState(false);
  const [errorCards, setErrorCards] = React.useState<string | null>(null);

  // Fetch all cards with game_changer = true from your backend API
  React.useEffect(() => {
    if (gameChangerCards.length === 0 && !loadingCards) {
      setLoadingCards(true);
      setErrorCards(null);
      fetch('/api/cards?game_changer=true') // <-- Update this endpoint to match your backend
        .then(res => res.json())
        .then(data => {
          setGameChangerCards(data.cards || []);
        })
        .catch(() => setErrorCards('Failed to load game changer cards.'))
        .finally(() => setLoadingCards(false));
    }
  }, [gameChangerCards.length, loadingCards]);

  // Only render CardGrid with game changer cards
  if (loadingCards) {
    return <div className="text-slate-300 py-8 text-center w-full">Loading cards...</div>;
  }
  if (errorCards) {
    return <div className="text-red-400 py-8 text-center w-full">{errorCards}</div>;
  }
  // Filter out cards missing required fields and cast to MTGCardWithFaces
  const validCards = gameChangerCards.filter(
    (card): card is import("./Card").MTGCardWithFaces =>
      typeof card.id === 'string' && typeof card.name === 'string' && typeof card.set === 'string'
  );
  return <CardGrid cards={validCards} />;
};

export default GameChangers;
