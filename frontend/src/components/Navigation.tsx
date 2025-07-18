'use client';

import type { User } from '@/types';

interface NavigationProps {
  isAuthenticated: boolean;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

import React, { useState } from 'react';

export default function Navigation({ isAuthenticated, user, onLogin, onLogout }: NavigationProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAdmin = user && user.email && user.email.endsWith('@admin.com');
  return (
    <>
      {/* Skip to content link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only absolute left-2 top-2 bg-mtg-blue text-white px-4 py-2 rounded z-50" tabIndex={0}>
        Skip to main content
      </a>
      <nav className="sleeve-morphism border-b-2 shadow-lg sticky top-0 z-50" style={{backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)"}} aria-label="Main navigation">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-3 group" aria-label="Go to home page">
              <img src="/logo.svg" alt="MTG Deck Optimizer Logo" className="w-8 h-8 group-hover:scale-105 transition-transform" />
              <span className="text-5xl font-mtg text-mtg-white drop-shadow-lg tracking-wide group-hover:text-amber-400 transition-colors">
                MTG Deck Optimizer
              </span>
            </a>

            {/* Hamburger for mobile */}
            <button
              className="md:hidden flex items-center px-3 py-2 border rounded text-mtg-white border-mtg-blue focus:outline-none"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Navigation Links (desktop) */}
            <div className="hidden md:flex items-center space-x-6" role="menubar" aria-label="Main menu">
              <a href="/collection" className="group flex items-center transition-colors font-mtg-mono">
                <i className="ms ms-counter-lore ms-2x mr-2 text-mtg-red group-hover:!text-rarity-uncommon"></i>
                <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Collection</span>
              </a>
              <a href="/deck-builder" className="group flex items-center transition-colors font-mtg-mono">
                <i className="ms ms-commander ms-2x mr-2 text-rarity-mythic group-hover:!text-rarity-uncommon"></i>
                <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Deck Builder</span>
              </a>
              <a href="/pricing" className="group flex items-center transition-colors font-mtg-mono">
                <i className="ms ms-counter-gold ms-2x mr-2 text-rarity-rare group-hover:!text-rarity-uncommon"></i>
                <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Pricing</span>
              </a>
              <a href="/settings" className="group flex items-center transition-colors font-mtg-mono">
                <i className="ms ms-cog ms-2x mr-2 text-mtg-blue group-hover:!text-rarity-uncommon"></i>
                <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Settings</span>
              </a>
              <a href="/help" className="group flex items-center transition-colors font-mtg-mono">
                <i className="ms ms-question ms-2x mr-2 text-mtg-green group-hover:!text-rarity-uncommon"></i>
                <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Help</span>
              </a>
            {isAdmin && (
              <a href="/admin" className="group flex items-center transition-colors font-mtg-mono">
                <i className="ms ms-crown ms-2x mr-2 text-rarity-mythic group-hover:!text-rarity-uncommon"></i>
                <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Admin</span>
              </a>
            )}
          </div>

          {/* User Actions (desktop) */}
          <div className="hidden md:flex items-center space-x-4">
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
                ><i className="ms ms-b text-mtg-black mr-2"></i>
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic px-6 py-2 rounded-lg transition-colors font-mtg-mono"
              ><i className="ms ms-w text-mtg-white mr-2"></i>
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 md:hidden" onClick={() => setDrawerOpen(false)}>
          <div
            id="mobile-nav-drawer"
            className="absolute top-0 left-0 w-64 h-full bg-mtg-black shadow-xl p-6 flex flex-col gap-6"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
          >
            <button
              className="self-end mb-4 text-mtg-white hover:text-mtg-blue"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {(() => {
              const { usePathname } = require("next/navigation");
              const pathname = usePathname();
              const navLinks = [
                { href: "/collection", label: "Collection", icon: "ms-counter-lore", iconColor: "text-mtg-red" },
                { href: "/deck-builder", label: "Deck Builder", icon: "ms-commander", iconColor: "text-rarity-mythic" },
                { href: "/pricing", label: "Pricing", icon: "ms-counter-gold", iconColor: "text-rarity-rare" },
                { href: "/settings", label: "Settings", icon: "ms-cog", iconColor: "text-mtg-blue" },
                { href: "/help", label: "Help", icon: "ms-question", iconColor: "text-mtg-green" },
              ];
              return (
                <>
                  {navLinks.map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      className={`group flex items-center transition-colors font-mtg-mono py-2 ${pathname === link.href ? "bg-mtg-blue/30 text-rarity-uncommon" : ""}`}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <i className={`ms ms-2x mr-2 ${link.icon} ${link.iconColor} group-hover:!text-rarity-uncommon`}></i>
                      <span className="text-rarity-rare group-hover:!text-rarity-uncommon">{link.label}</span>
                    </a>
                  ))}
                  {isAdmin && (
                    <a
                      href="/admin"
                      className={`group flex items-center transition-colors font-mtg-mono py-2 ${pathname === "/admin" ? "bg-mtg-blue/30 text-rarity-uncommon" : ""}`}
                      onClick={() => setDrawerOpen(false)}
                    >
                      <i className="ms ms-crown ms-2x mr-2 text-rarity-mythic group-hover:!text-rarity-uncommon"></i>
                      <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Admin</span>
                    </a>
                  )}
                </>
              );
            })()}
            <div className="border-t border-mtg-blue my-4" />
            {isAuthenticated ? (
              <>
                <a
                  href="/account"
                  className="text-rarity-uncommon font-mtg-display hover:text-rarity-mythic transition-colors underline cursor-pointer py-2"
                  title="Account settings"
                  onClick={() => setDrawerOpen(false)}
                >
                  Welcome, {user?.username || 'User'}
                </a>
                <button
                  onClick={() => { setDrawerOpen(false); onLogout(); }}
                  className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic text-mtg-white px-4 py-2 rounded-lg transition-colors font-mtg-mono mt-2"
                ><i className="ms ms-b text-mtg-black mr-2"></i>
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => { setDrawerOpen(false); onLogin(); }}
                className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic px-6 py-2 rounded-lg transition-colors font-mtg-mono mt-2"
              ><i className="ms ms-w text-mtg-white mr-2"></i>
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
    </>
  );
}
