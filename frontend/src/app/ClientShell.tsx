"use client";
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import AuthModal from '@/components/AuthModal';
import { useModalStore } from '@/store/modalStore';
import { usePathname, useSearchParams } from 'next/navigation';

const AuthHydrator = require('../components/AuthHydrator').default;
const PlaymatHydrator = require('../components/PlaymatHydrator').default;
const ToastProvider = require('../components/ToastProvider').ToastProvider;
const Navigation = require('../components/Navigation').default;
const SpeedInsights = require('@vercel/speed-insights/next').SpeedInsights;
const Analytics = require('@vercel/analytics/next').Analytics;

// If useModalStore is not exported from authStore, use the local definition:
// const { create } = require('zustand');
// const useModalStore = create((set) => ({ showAuthModal: false, setShowAuthModal: (show) => set({ showAuthModal: show }) }));


export default function ClientShell({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s: { isAuthenticated: boolean }) => s.isAuthenticated);
  const hydrating = useAuthStore((s: { hydrating: boolean }) => s.hydrating);
  const logout = useAuthStore((s: { logout: () => void }) => s.logout);
  const user = useAuthStore((s: { user: any }) => s.user);
  const showAuthModal = useModalStore((s: { showAuthModal: boolean }) => s.showAuthModal);
  const setShowAuthModal = useModalStore((s: { setShowAuthModal: (show: boolean) => void }) => s.setShowAuthModal);
  const [showModal, setShowModal] = useState(false);
  const autoLoggedOut = useAuthStore((s: { autoLoggedOut: boolean }) => s.autoLoggedOut);
  const [recoveryState, setRecoveryState] = useState<'none' | 'reset'>('none');
  const pathname = usePathname();
  const searchParams = useSearchParams();


  // Show AuthModal if recovery link is present in search or hash
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let foundRecovery = false;
      // Check search params (from Next.js router)
      if (searchParams?.get('type') === 'recovery' || searchParams?.get('recovery') === '1') {
        foundRecovery = true;
      }
      // Fallback: Check hash fragment
      if (!foundRecovery && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, '?'));
        if (hashParams.get('type') === 'recovery' || hashParams.get('recovery') === '1') {
          foundRecovery = true;
          // Store a flag so we can detect after hash is cleared
          sessionStorage.setItem('supabase_recovery', '1');
        }
      }
      // If hash is empty, check for the flag
      if (!foundRecovery && !window.location.hash && sessionStorage.getItem('supabase_recovery') === '1') {
        foundRecovery = true;
        // Optionally clear the flag after use
        sessionStorage.removeItem('supabase_recovery');
      }
      if (foundRecovery) {
        setShowModal(true);
        setRecoveryState('reset');
      }
    }
  }, [pathname, searchParams]);

  // Automatically show AuthModal when logged out and not hydrating,
  // but do NOT close modal if in recovery mode
  useEffect(() => {
    // Only auto-show modal for logout if not in recovery mode
    if (recoveryState !== 'reset') {
      setShowModal(autoLoggedOut);
      if (!autoLoggedOut) setShowAuthModal(false);
    }
  }, [autoLoggedOut, setShowAuthModal, recoveryState]);

  return (
    <ToastProvider>
      <AuthHydrator />
      <PlaymatHydrator />
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={() => {
          logout();
          setShowAuthModal(false);
        }}
      />
      {children}
      {(showModal || showAuthModal) && (
        <AuthModal
          onClose={() => {
            setShowModal(false);
            setShowAuthModal(false);
            useAuthStore.getState().setAutoLoggedOut(false);
          }}
          recoveryState={recoveryState}
        />
      )}
      <Analytics />
      <SpeedInsights />
      <footer
        className="bg-mtg-black/50 font-mtg-body w-full text-center text-xs text-mtg-white py-4 mt-8"
        style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb), 0.5)" }}
      >
        Magic: The Gathering® and all related logos, fonts, and trademarks are property of Wizards of the Coast. SparkRoot is an unofficial, fan-made tool with no official affiliation. If Wizards of the Coast ever asks us to make changes to the branding, we’ll comply immediately.
      </footer>
    </ToastProvider>
  );
}
