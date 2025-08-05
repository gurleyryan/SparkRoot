"use client";
import type { MTGCard, Deck } from "@/types/index";
import DeckBuilder from "@/components/DeckBuilder";
import dynamic from "next/dynamic";
import GameChangers from "@/components/GameChangers";
import React, { useState, useEffect } from "react";

const CardGrid = dynamic(() => import('@/components/CardGrid'), {
  ssr: false,
  loading: () => <div>Loading deck...</div>,
});

export default function DeckBuilderPage() {
  // CardGrid state
  const [cardGridType, setCardGridType] = useState<null | 'deck' | 'gamechangers'>(null);
  const [deckCards, setDeckCards] = useState<MTGCard[]>([]);
  const [deckDetailId, setDeckDetailId] = useState<string | null>(null);
  const [generatedDeck, setGeneratedDeck] = useState<Deck & { analysis?: unknown } | null>(null);
  const [loading] = useState(false);

  // Handler for DeckBuilder to call when deck is generated
  function handleDeckGenerated(deck: Deck) {
    setGeneratedDeck(deck);
    setDeckCards(deck.cards || []);
    setCardGridType('deck');
  }

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

  useEffect(() => {
    // Preload CardGrid chunk on mount
    import('@/components/CardGrid');
  }, []);

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
            {console.log("DeckBuilderPage: rendering deckCards", deckCards, "generatedDeck", generatedDeck)}
            <div className="flex w-full justify-between items-center mx-auto mb-2 px-2 sm:px-0">
              <div className="font-bold text-amber-400 text-lg">Generated Deck</div>
              <button className="btn-secondary px-3 py-1 rounded border font-semibold" onClick={handleClearGrid}>Exile Deck</button>
            </div>
            {/* DeckDetail panel appears above CardGrid if deckDetailId or generatedDeck is present */}
            {(deckDetailId || generatedDeck) && (
              <div className="w-full mx-auto mb-4">
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
