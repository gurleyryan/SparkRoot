"use client";
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import AuthModal from '@/components/AuthModal';
import { useModalStore } from '@/store/modalStore';
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

  // Show AuthModal if recovery link is present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('type') === 'recovery' || params.get('recovery') === '1') {
        setShowModal(true);
        setRecoveryState('reset');
      }
    }
  }, []);

  // Automatically show AuthModal when logged out and not hydrating
  useEffect(() => {
    setShowModal(autoLoggedOut);
    if (!autoLoggedOut) setShowAuthModal(false);
  }, [autoLoggedOut, setShowAuthModal]);

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
