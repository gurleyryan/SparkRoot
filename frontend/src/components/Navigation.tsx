'use client';

import type { User } from '@/types';

interface NavigationProps {
  isAuthenticated: boolean;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navigation({ isAuthenticated, user, onLogin, onLogout }: NavigationProps) {
  return (
    <nav className="bg-mtg-black sleeve-morphism border-b-2 border-rarity-uncommon shadow-lg sticky top-0 z-50" style={{backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)"}}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="MTG Deck Optimizer Logo" className="w-8 h-8" />
            <span className="text-2xl font-mtg text-mtg-white drop-shadow-lg tracking-wide">
              MTG Deck Optimizer
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <a href="#" className="text-gray-300 hover:text-mtg-white transition-colors font-mtg-body">
              Collection
            </a>
            <a href="#" className="text-gray-300 hover:text-mtg-white transition-colors font-mtg-body">
              Deck Builder
            </a>
            <a href="#" className="text-gray-300 hover:text-mtg-white transition-colors font-mtg-body">
              Pricing
            </a>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <a
                  href="/account"
                  className="text-gray-300 font-mtg-body hover:text-mtg-blue transition-colors underline cursor-pointer"
                  title="Account settings"
                >
                  Welcome, {user?.username || 'User'}
                </a>
                <button
                  onClick={onLogout}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors font-mtg-body"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="bg-mtg-blue hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors font-mtg-body"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
