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
    <div className="min-h-screen bg-mtg-black">
      <Navigation 
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="sleeve-morphism rounded-xl p-8 mb-12 border border-mtg-blue shadow-xl text-center">
          <h1 className="text-6xl font-mtg font-bold text-mtg-white mb-4 drop-shadow-lg">
            MTG Deck Optimizer
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 font-mtg-body">
            Manage your Magic: The Gathering collection with advanced filtering, 
            real-time pricing, and powerful deck building tools
          </p>
          {!isAuthenticated && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-mtg-blue hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow"
            >
              Create Account / Sign In
            </button>
          )}
        </div>

        {/* Main Content */}
        {!isAuthenticated ? (
          <div className="text-center py-12">
            <div className="bg-gblack rounded-xl p-8 max-w-2xl mx-auto border border-gray-700">
              <h2 className="text-2xl font-mtg text-mtg-white mb-4">Welcome to MTG Deck Optimizer</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-mtg-blue rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="font-semibold text-mtg-white">Collection Management</h3>
                  <p className="text-gray-400 text-sm">Upload and organize your cards with ease</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-mtg-green rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">💰</span>
                  </div>
                  <h3 className="font-semibold text-mtg-white">Real-time Pricing</h3>
                  <p className="text-gray-400 text-sm">Track card values and collection worth</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-mtg-red rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">⚔️</span>
                  </div>
                  <h3 className="font-semibold text-mtg-white">Deck Building</h3>
                  <p className="text-gray-400 text-sm">Generate optimized Commander decks</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-rarity-mythic hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
              >
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
              <h2 className="text-2xl font-bold text-mtg-white mb-2">Commander Bracket Deck Builder</h2>
              <p className="text-slate-400 mb-4">Select your bracket and generate a deck with bracket rules enforced.</p>
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
