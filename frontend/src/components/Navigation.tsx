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
    <nav className="sleeve-morphism border-b-2 border-rarity-uncommon shadow-lg sticky top-0 z-50" style={{backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)"}}>
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
            <a href="#" className="text-rarity-rare hover:text-rarity-uncommon transition-colors font-mtg-mono">
              Collection
            </a>
            <a href="#" className="text-rarity-rare hover:text-rarity-uncommon transition-colors font-mtg-mono">
              Deck Builder
            </a>
            <a href="#" className="text-rarity-rare hover:text-rarity-uncommon transition-colors font-mtg-mono">
              Pricing
            </a>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <a
                  href="/account"
                  className="text-rarity-uncommon font-mtg-display hover:text-rarity-mythic transition-colors underline cursor-pointer"
                  title="Account settings"
                >
                  Welcome, {user?.username || 'User'}
                </a>
                <button
                  onClick={onLogout}
                  className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic text-mtg-white px-4 py-2 rounded-lg transition-colors font-mtg-mono"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic px-6 py-2 rounded-lg transition-colors font-mtg-mono"
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
