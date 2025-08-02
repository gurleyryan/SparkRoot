'use client';
import type { User } from '@/types';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from "../store/authStore";

interface NavigationProps {
  isAuthenticated: boolean;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navigation({ isAuthenticated, user, onLogin, onLogout }: NavigationProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAdmin =
    user?.app_metadata?.role === 'admin' ||
    user?.role === 'admin';
  const pathname = usePathname();
  const hydrating = useAuthStore((s) => s.hydrating);

  // Prevent scroll when drawer is open (mobile UX)
  React.useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <>
      {/* Skip to content link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only absolute left-2 top-2 bg-mtg-blue text-white px-4 py-2 rounded z-50" tabIndex={0}>
        Skip to main content
      </a>
      <nav className="container sleeve-morphism mx-auto backdrop-blur-sm border-b-2 shadow-lg sticky top-0 z-50" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }} aria-label="Main navigation">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16 gap-4 md:gap-8">
            {/* Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
              <Link href="/" className="flex items-center group min-w-0" aria-label="Go to home page">
                <Image src="/logo.png" alt="SparkRoot Logo" className="w-12 h-12 md:w-12 md:h-12 sm:w-7 sm:h-7 xs:w-6 xs:h-6 group-hover:scale-105 transition-transform flex-shrink-0" width={32} height={23} />
                <span
                  className="font-mtg text-mtg-white drop-shadow-lg tracking-wide group-hover:text-amber-400 transition-colors font-bold break-words text-balance max-w-full w-full text-left whitespace-nowrap"
                  style={{
                    lineHeight: '1.1',
                    letterSpacing: '0.02em',
                    fontSize: 'clamp(1.5rem, 2.5vw, 3.2rem)',
                  }}
                >
                  SparkRoot
                </span>
              </Link>
            </div>

            {/* Hamburger for mobile */}
            <button
              className="md:hidden flex items-center px-3 py-2 border rounded text-mtg-white border-mtg-rarity-rare focus:outline-none"
              onClick={() => setDrawerOpen((open) => !open)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Nav links + user actions */}
            <div className="hidden md:flex items-center justify-end flex-1 min-w-0 overflow-x-auto">
              <div className="flex items-center space-x-4 md:space-x-6" role="menubar" aria-label="Main menu">
                <Link href="/collection" className="group flex items-center transition-colors font-mtg-mono whitespace-nowrap">
                  <i className="ms ms-counter-lore mr-2 text-mtg-red group-hover:!text-rarity-uncommon" ></i>
                  <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Collection</span>
                </Link>
                <Link href="/deck-builder" className="group flex items-center transition-colors font-mtg-mono whitespace-nowrap">
                  <i className="ms ms-commander mr-2 text-mtg-blue group-hover:!text-rarity-uncommon"></i>
                  <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Deck Builder</span>
                </Link>
                <Link href="/pricing" className="group flex items-center transition-colors font-mtg-mono whitespace-nowrap">
                  <i className="ms ms-counter-gold mr-2 text-rarity-rare group-hover:!text-rarity-uncommon"></i>
                  <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Pricing</span>
                </Link>
                <Link href="/help" className="group flex items-center transition-colors font-mtg-mono whitespace-nowrap">
                  <i className="ms ms-party-wizard mr-2 text-mtg-green group-hover:!text-rarity-uncommon"></i>
                  <span className="text-rarity-rare group-hover:!text-rarity-uncommon">Help</span>
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="group flex items-center transition-colors font-mtg-mono whitespace-nowrap">
                    <i className="ms ms-ability-dungeon mr-2 text-rarity-mythic group-hover:!text-rarity-uncommon"></i>
                    <span className="text-rarity-mythic group-hover:!text-rarity-uncommon">Admin</span>
                  </Link>
                )}
              </div>
              {/* Spacer to keep user actions at a fixed distance from nav links */}
              <div className="hidden md:block" style={{ width: '2rem' }} aria-hidden="true"></div>
              {/* User Actions (desktop) */}
              <div className="flex items-center space-x-4">
                {hydrating ? (
                  <span className="animate-pulse text-slate-400">Loading user...</span>
                ) : isAuthenticated ? (
                  <div className="flex items-center space-x-4">
                    <Link
                      href="/account"
                      className="text-rarity-uncommon font-mtg-mono hover:text-rarity-mythic transition-colors underline cursor-pointer"
                      title="Account"
                    >
                      {user?.username || user?.full_name || user?.email || 'User'}
                    </Link>
                    <button
                      onClick={onLogout}
                      className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic text-mtg-white px-2 py-2 rounded-lg transition-colors font-mtg-mono"
                    ><i className="ms ms-b text-mtg-black mr-2"></i>
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onLogin}
                    className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic px-2 py-2 rounded-lg transition-colors font-mtg-mono w-auto min-w-0"
                    style={{ maxWidth: '160px', width: 'auto', whiteSpace: 'nowrap' }}
                  >
                    <i className="ms ms-w text-mtg-white mr-2"></i>
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer (move outside nav for better event handling) */}
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
              type="button"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Navigation Links */}
            {[
              { href: "/collection", label: "Collection", icon: "ms-counter-lore", iconColor: "text-mtg-red" },
              { href: "/deck-builder", label: "Deck Builder", icon: "ms-commander", iconColor: "text-rarity-mythic" },
              { href: "/pricing", label: "Pricing", icon: "ms-counter-gold", iconColor: "text-rarity-rare" },
              { href: "/help", label: "Help", icon: "ms-party-wizard", iconColor: "text-mtg-green" },
              ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "ms-ability-dungeon", iconColor: "text-rarity-mythic" }] : []),
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`group flex items-center transition-colors font-mtg-mono py-2 ${pathname === link.href ? "bg-mtg-blue/30 text-rarity-uncommon" : ""}`}
                onClick={() => setDrawerOpen(false)}
                prefetch={false}
              >
                <i className={`ms ms-2x mr-2 ${link.icon} ${link.iconColor} group-hover:!text-rarity-uncommon min-w-[2rem]`}></i>
                <span className="text-rarity-rare group-hover:!text-rarity-uncommon truncate block max-w-[70%]">{link.label}</span>
              </Link>
            ))}
            <div className="border-t border-rarity-rare my-4" />
            {/* User Actions (mobile) */}
            <div>
              {hydrating ? (
                <span className="animate-pulse text-slate-400">Loading user...</span>
              ) : isAuthenticated ? (
                <>
                  <Link
                    href="/account"
                    className="text-rarity-uncommon font-mtg-display hover:text-rarity-mythic transition-colors underline cursor-pointer py-2"
                    title="Account"
                    onClick={() => setDrawerOpen(false)}
                  >
                    {user?.username || user?.full_name || user?.email || 'User'}
                  </Link>
                  <button
                    onClick={() => { setDrawerOpen(false); onLogout(); }}
                    className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic text-mtg-white px-4 py-2 rounded-lg transition-colors font-mtg-mono mt-2"
                    type="button"
                  ><i className="ms ms-b text-mtg-black mr-2"></i>
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setDrawerOpen(false); onLogin(); }}
                  className="bg-rarity-common hover:bg-rarity-uncommon text-rarity-uncommon hover:text-rarity-mythic px-4 py-2 rounded-lg transition-colors font-mtg-mono mt-2 w-auto min-w-0"
                  style={{ maxWidth: '160px', width: 'auto', whiteSpace: 'nowrap' }}
                  type="button"
                >
                  <i className="ms ms-w text-mtg-white mr-2"></i>
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
