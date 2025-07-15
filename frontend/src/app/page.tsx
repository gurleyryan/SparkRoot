'use client';

import { useState, useEffect } from 'react';
import CollectionUpload from '@/components/CollectionUpload';
import CollectionGrid from '@/components/CollectionGrid';
import AuthModal from '@/components/AuthModal';
import Navigation from '@/components/Navigation';
import type { MTGCard, User, CollectionStats } from '@/types';

export default function Home() {
  const [collection, setCollection] = useState<MTGCard[]>([]);
  const [collectionStats, setCollectionStats] = useState<CollectionStats | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for existing authentication
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
      // TODO: Validate token and get user info
    }
  }, []);

  const handleCollectionUploaded = (data: MTGCard[]) => {
    setCollection(data);
    // TODO: Calculate stats from data
    // setCollectionStats(calculateStats(data));
  };

  const handleAuth = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    setCollection([]);
    setCollectionStats(null);
  };

  return (
    <div className="min-h-screen bg-mtg-black">
      <Navigation 
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-mtg font-bold text-mtg-white mb-4 drop-shadow-lg">
            MTG Collection Optimizer
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 font-mtg-body">
            Manage your Magic: The Gathering collection with advanced filtering, 
            real-time pricing, and powerful deck building tools
          </p>
          
          {!isAuthenticated && (
            <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto border border-gray-700">
              <h3 className="text-lg font-mtg text-mtg-white mb-3">Get Started</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Create an account to save your collection and access advanced features
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-mtg-blue hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Create Account / Sign In
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        {!isAuthenticated ? (
          <div className="text-center py-12">
            <div className="bg-gray-800 rounded-xl p-8 max-w-2xl mx-auto border border-gray-700">
              <h2 className="text-2xl font-mtg text-mtg-white mb-4">Welcome to MTG Collection Optimizer</h2>
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
        ) : collection.length === 0 ? (
          <CollectionUpload onCollectionUploaded={handleCollectionUploaded} />
        ) : (
          <div>
            {/* Collection Stats */}
            <div className="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-mtg text-rarity-mythic">Collection Overview</h2>
                <button
                  onClick={() => setCollection([])}
                  className="bg-mtg-blue hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Upload New Collection
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center bg-gray-900 rounded-lg p-4">
                  <div className="text-3xl font-bold text-rarity-mythic">{collectionStats?.total_cards}</div>
                  <div className="text-gray-400 font-mtg-body">Total Cards</div>
                </div>
                <div className="text-center bg-gray-900 rounded-lg p-4">
                  <div className="text-3xl font-bold text-rarity-rare">{collectionStats?.unique_cards}</div>
                  <div className="text-gray-400 font-mtg-body">Unique Cards</div>
                </div>
                <div className="text-center bg-gray-900 rounded-lg p-4">
                  <div className="text-3xl font-bold text-mtg-white">{collection.length}</div>
                  <div className="text-gray-400 font-mtg-body">Cards Loaded</div>
                </div>
                <div className="text-center bg-gray-900 rounded-lg p-4">
                  <div className="text-3xl font-bold text-mtg-green">$0.00</div>
                  <div className="text-gray-400 font-mtg-body">Est. Value</div>
                </div>
              </div>
            </div>

            {/* Collection Grid */}
            <CollectionGrid collection={collection} />
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onAuth={handleAuth}
        />
      )}
    </div>
  );
}
