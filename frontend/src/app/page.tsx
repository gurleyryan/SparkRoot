'use client';

export const dynamic = "force-dynamic";

import { useState } from 'react';
import CollectionUpload from '@/components/CollectionUpload';
import CollectionGrid from '@/components/CollectionGrid';
import AuthModal from '@/components/AuthModal';
import Navigation from '@/components/Navigation';
import DeckBuilder from '@/components/DeckBuilder';
import { useCollectionStore } from '@/store/collectionStore';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { collections } = useCollectionStore();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen">
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="sleeve-morphism rounded-xl p-8 mb-12 border border-rarity-uncommon shadow-xl text-center" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
          <img src="/logo.svg" alt="MTG Deck Optimizer Logo" className="mx-auto mb-6 w-32 h-32" />
          <h1 className="text-6xl font-mtg font-bold text-mtg-white mb-4 drop-shadow-lg">
            MTG Deck Optimizer
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
              Create Account / Sign In
            </button>
          )}
        </div>

        {/* Main Content */}
        {!isAuthenticated ? (
          <div className="text-center py-12">
            <div className="sleeve-morphism rounded-xl p-8 max-w-2xl mx-auto border border-rarity-uncommon" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
              <h2 className="text-2xl font-mtg text-mtg-white mb-4">Welcome to MTG Deck Optimizer</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <a href="/collection" className="group text-center transition-colors">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="ms ms-counter-lore ms-2x text-mtg-red group-hover:text-rarity-uncommon"></i>
                  </div>
                  <h3 className="font-semibold font-mtg-display text-mtg-white group-hover:text-rarity-uncommon">Collection</h3>
                  <p className="text-rarity-uncommon font-mtg-body text-sm">Upload and organize your cards with ease</p>
                </a>
                <a href="/deck-builder" className="group text-center transition-colors">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="ms ms-commander ms-2x text-rarity-mythic group-hover:text-rarity-uncommon"></i>
                  </div>
                  <h3 className="font-semibold font-mtg-display text-mtg-white group-hover:text-rarity-uncommon">Deck Builder</h3>
                  <p className="text-rarity-uncommon font-mtg-body text-sm">Generate optimized Commander decks</p>
                </a>
                <a href="/pricing" className="group text-center transition-colors">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="ms ms-counter-gold ms-2x text-rarity-rare group-hover:text-rarity-uncommon"></i>
                  </div>
                  <h3 className="font-semibold font-mtg-display text-mtg-white group-hover:text-rarity-uncommon">Pricing</h3>
                  <p className="text-rarity-uncommon font-mtg-body text-sm">Track card values and collection worth</p>
                </a>
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
              <h2 className="text-2xl font-mtg-display font-bold text-mtg-white mb-2">Commander Bracket Deck Builder</h2>
              <p className="font-mtg-body text-rarity-uncommon mb-4">Select your bracket and generate a deck with bracket rules enforced.</p>
              <DeckBuilder />
            </div>
            {/* Collection Grid */}
            <CollectionGrid />
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
