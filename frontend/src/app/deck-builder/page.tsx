"use client";
import DeckBuilder from "@/components/DeckBuilder";
import Navigation from "@/components/Navigation";
import CardGrid from "@/components/CardGrid";
import GameChangers from "@/components/GameChangers";
import { useAuthStore } from "@/store/authStore";
import React, { useState } from "react";

export default function DeckBuilderPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // CardGrid state
  const [cardGridType, setCardGridType] = useState<null | 'deck' | 'gamechangers'>(null);
  const [deckCards, setDeckCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Handler for DeckBuilder to call when deck is generated
  const handleDeckGenerated = (cards: any[]) => {
    setDeckCards(cards);
    setCardGridType('deck');
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
  };

  return (
    <div className="min-h-screen">
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />
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
              <button className="btn-secondary px-3 py-1 rounded border font-semibold" onClick={handleClearGrid}>Back to Deck Builder</button>
            </div>
            <CardGrid cards={deckCards} />
          </>
        )}
        {cardGridType === 'gamechangers' && (
          <GameChangers onClose={handleClearGrid} />
        )}
        {cardGridType === null && (
          <div className="text-slate-400 text-center w-full">Use the buttons above to generate a deck or view Game Changer cards.</div>
        )}
      </div>
    </div>
  );
}
