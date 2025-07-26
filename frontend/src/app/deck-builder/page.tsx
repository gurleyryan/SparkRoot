"use client";
import type { MTGCard } from "@/types/index";
import type { Deck as DeckBase } from "@/types";
import DeckBuilder from "@/components/DeckBuilder";
import CardGrid from "@/components/CardGrid";
import GameChangers from "@/components/GameChangers";
import React, { useState } from "react";

export default function DeckBuilderPage() {
  // CardGrid state
  const [cardGridType, setCardGridType] = useState<null | 'deck' | 'gamechangers'>(null);
  const [deckCards, setDeckCards] = useState<MTGCard[]>([]);
  const [deckDetailId, setDeckDetailId] = useState<string | null>(null);
  const [generatedDeck, setGeneratedDeck] = useState<DeckBase & { analysis?: any } | null>(null);
  const [loading] = useState(false);

  // Handler for DeckBuilder to call when deck is generated
  // Accepts the full deck object (with analysis) if available, else falls back to cards array
  const handleDeckGenerated = (deckOrCards: any) => {
    // If the argument is an array, fallback to old behavior
    if (Array.isArray(deckOrCards)) {
      setDeckCards(deckOrCards);
      setGeneratedDeck(null);
      setCardGridType('deck');
      if (deckOrCards.length > 0 && (deckOrCards as any)[0]?.deck_id) {
        setDeckDetailId((deckOrCards as any)[0].deck_id);
      } else {
        setDeckDetailId(null);
      }
      return;
    }
    // Otherwise, treat as deck object
    setGeneratedDeck(deckOrCards);
    setDeckCards(deckOrCards?.cards || []);
    setCardGridType('deck');
    if (deckOrCards?.id) {
      setDeckDetailId(deckOrCards.id);
    } else {
      setDeckDetailId(null);
    }
  };

  // Handler for DeckBuilder to call when Game Changers is requested

  // Toggle Game Changers open/close
  const handleShowGameChangers = () => {
    setCardGridType((prev) => (prev === 'gamechangers' ? null : 'gamechangers'));
  };

  const handleHideGameChangers = () => {
    setCardGridType(null);
  };

  // Handler to clear CardGrid
  const handleClearGrid = () => {
    setCardGridType(null);
    setDeckCards([]);
    setDeckDetailId(null);
    setGeneratedDeck(null);
  };

  return (
    <div className="min-h-screen">
      <DeckBuilder
        onDeckGenerated={handleDeckGenerated}
        onShowGameChangers={handleShowGameChangers}
        onHideGameChangers={handleHideGameChangers}
        loading={loading}
      />
      <div className="w-full flex flex-col items-center gap-4 mt-8 min-h-[200px]">
        {cardGridType === 'deck' && deckCards.length > 0 && (
          <>
            <div className="flex w-full justify-between items-center max-w-6xl mx-auto mb-2 px-2 sm:px-0">
              <div className="font-bold text-amber-400 text-lg">Generated Deck</div>
              <button className="btn-secondary px-3 py-1 rounded border font-semibold" onClick={handleClearGrid}>Exile Deck</button>
            </div>
            {/* DeckDetail panel appears above CardGrid if deckDetailId or generatedDeck is present */}
            {(deckDetailId || generatedDeck) && (
              <div className="w-full max-w-6xl mx-auto mb-4">
                {deckDetailId
                  ? React.createElement(require('@/components/DeckDetail').default, { deckId: deckDetailId })
                  : React.createElement(require('@/components/DeckDetail').default, { deck: generatedDeck })}
              </div>
            )}
            <CardGrid cards={deckCards} />
          </>
        )}
        {cardGridType === 'gamechangers' && (
          <GameChangers />
        )}
        {cardGridType === null && (
          <div className="text-slate-400 text-center w-full">Use the buttons above to generate a deck or view Game Changer cards.</div>
        )}
      </div>
    </div>
  );
}
