"use client";
import { useState } from 'react';
import type { MTGCard } from '@/types/index';
import Link from 'next/link';
import { useModalStore } from '../store/modalStore';
import CollectionUpload from '@/components/CollectionUpload';
import CollectionGrid from '@/components/CollectionGrid';
import DeckBuilder from '@/components/DeckBuilder';
import CardGrid from '@/components/CardGrid';
import GameChangers from '@/components/GameChangers';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuthStore } from '@/store/authStore';
import Image from 'next/image';



export default function HomePage() {
  const { collections } = useCollectionStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // DeckBuilder dashboard state
  const [cardGridType, setCardGridType] = useState<string | null>(null);
  const [deckCards, setDeckCards] = useState<MTGCard[]>([]);
  const [loading] = useState(false);

  // Handler for DeckBuilder to call when deck is generated
  function handleDeckGenerated(cards: MTGCard[]) {
    setCardGridType('deck');
    setDeckCards(cards);
  }

  // Handler to show Game Changers
  function handleShowGameChangers() {
    setCardGridType('gamechangers');
    setDeckCards([]);
  }

  // Handler to hide Game Changers
  function handleHideGameChangers() {
    setCardGridType(null);
    setDeckCards([]);
  }

  // Handler to clear CardGrid
  function handleClearGrid() {
    setCardGridType(null);
    setDeckCards([]);
  }

  function setShowAuthModal(show: boolean) {
    useModalStore.getState().setShowAuthModal(show);
  }

  return (
    <div className="container mx-auto min-h-screen">
      {/* Hero Section */}
      <div className="sleeve-morphism rounded-xl p-8 mx-auto mb-12 border shadow-xl text-center" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
        <Image src="/logo.png" alt="SparkRoot Logo" className="mx-auto mb-4 h-64 w-64" width={640} height={640} />
        <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-mtg font-bold text-mtg-white mb-4 drop-shadow-lg break-words text-balance w-full leading-tight min-w-0 max-w-full overflow-hidden" style={{letterSpacing:'0.02em', lineHeight:'1.1', overflowWrap:'anywhere'}}>
          SparkRoot
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 font-mtg-display">
          Manage your Magic: The Gathering collection with advanced filtering,
          real-time pricing, and powerful deck building tools
        </p>
        {!isAuthenticated && (
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic font-mtg-mono font-semibold py-3 px-8 rounded-lg transition-colors shadow cursor-pointer"
          ><i className="ms ms-planeswalker text-mtg-red mr-2"></i>
            Create Account or Sign In
          </button>
        )}
      </div>

      {/* Main Content */}
      {!isAuthenticated ? (
        <div className="text-center py-12">
          <div className="sleeve-morphism rounded-xl p-8 max-w-2xl mx-auto border" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
            <h2 className="text-2xl font-mtg text-mtg-white mb-4">Welcome to SparkRoot</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Link href="/collection" className="group text-center transition-colors">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ms ms-counter-lore ms-2x text-mtg-red group-hover:text-rarity-uncommon"></i>
                </div>
                <h3 className="font-semibold font-mtg-display text-mtg-white group-hover:text-rarity-uncommon">Collection</h3>
                <p className="text-rarity-uncommon font-mtg-body text-sm">Upload and organize your cards with ease</p>
              </Link>
              <Link href="/deck-builder" className="group text-center transition-colors">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ms ms-commander ms-2x text-rarity-mythic group-hover:text-rarity-uncommon"></i>
                </div>
                <h3 className="font-semibold font-mtg-display text-mtg-white group-hover:text-rarity-uncommon">Deck Builder</h3>
                <p className="text-rarity-uncommon font-mtg-body text-sm">Generate optimized Commander decks</p>
              </Link>
              <Link href="/pricing" className="group text-center transition-colors">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="ms ms-counter-gold ms-2x text-rarity-rare group-hover:text-rarity-uncommon"></i>
                </div>
                <h3 className="font-semibold font-mtg-display text-mtg-white group-hover:text-rarity-uncommon">Pricing</h3>
                <p className="text-rarity-uncommon font-mtg-body text-sm">Track card values and collection worth</p>
              </Link>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic font-mtg-mono font-semibold py-3 px-8 rounded-lg transition-colors cursor-pointer"
            ><i className="ms ms-ability-flash text-mtg-blue mr-2"></i>

              Get Started
            </button>
          </div>
        </div>
      ) : collections.length === 0 ? (
        <CollectionUpload />
      ) : (
        <div>
          {/* Bracket Deck Builder */}
          <div className="mb-8">
            <h2 className="text-2xl font-mtg-display font-bold text-mtg-white mb-2">Deck Builder</h2>
            <p className="font-mtg-body text-rarity-uncommon mb-4">Manage your decks.</p>
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
                <GameChangers />
              )}
              {cardGridType === null && (
                <div className="text-slate-400 text-center w-full">Use the buttons above to generate a deck or view Game Changer cards.</div>
              )}
            </div>
          </div>
          <CollectionGrid />
        </div>
      )}
    </div>
  );
}
