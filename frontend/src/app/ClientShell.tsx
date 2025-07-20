"use client";
import React from 'react';

const AuthHydrator = require('../components/AuthHydrator').default;
const PlaymatHydrator = require('../components/PlaymatHydrator').default;
const ToastProvider = require('../components/ToastProvider').ToastProvider;
const Navigation = require('../components/Navigation').default;
const AuthModal = require('../components/AuthModal').default;
const SpeedInsights = require('@vercel/speed-insights/next').SpeedInsights;
const Analytics = require('@vercel/analytics/next').Analytics;
const { useAuthStore } = require('../store/authStore');
const { useModalStore } = require('../store/modalStore');
// If useModalStore is not exported from authStore, use the local definition:
// const { create } = require('zustand');
// const useModalStore = create((set) => ({ showAuthModal: false, setShowAuthModal: (show) => set({ showAuthModal: show }) }));

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s: any) => s.isAuthenticated);
  const user = useAuthStore((s: any) => s.user);
  const logout = useAuthStore((s: any) => s.logout);
  const showAuthModal = useModalStore((s: any) => s.showAuthModal);
  const setShowAuthModal = useModalStore((s: any) => s.setShowAuthModal);

  return (
    <ToastProvider>
      <AuthHydrator />
      <PlaymatHydrator />
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />
      {children}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
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
