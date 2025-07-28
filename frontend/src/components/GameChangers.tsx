"use client";

import React from "react";
import CardGrid from "./CardGrid";
import type { MTGCard } from '@/types/index';

// Extend MTGCard for Scryfall fields used in this component
type MTGCardExtended = MTGCard & {
  set_icon_svg_uri?: string;
  card_faces?: any; // You can replace 'any' with a more specific type if available
};

const GameChangers: React.FC = () => {
  const [gameChangerCards, setGameChangerCards] = React.useState<Partial<MTGCardExtended>[]>([]);
  const [loadingCards, setLoadingCards] = React.useState(false);
  const [errorCards, setErrorCards] = React.useState<string | null>(null);

  // Fetch all cards with game_changer = true from your backend API
  React.useEffect(() => {
    setLoadingCards(true);
    setErrorCards(null);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cards?game_changer=true`)
      .then(res => res.json())
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
        } catch {}
      }
      if (parsed && typeof parsed.card_faces === 'string') {
        try {
          parsed.card_faces = JSON.parse(parsed.card_faces);
        } catch {}
      }
      return parsed;
    })
    .filter(
      (card): card is import("./Card").MTGCardWithFaces =>
        typeof card.id === 'string' && typeof card.name === 'string' && typeof card.set === 'string'
    );
  return <CardGrid cards={validCards} />;
};

export default GameChangers;
