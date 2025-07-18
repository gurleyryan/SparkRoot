"use client";
import Settings from "@/components/Settings";
import Navigation from "@/components/Navigation";
import { useAuthStore } from "@/store/authStore";
import React from "react";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  return (
    <div className="min-h-screen">
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />
      <Settings />
    </div>
  );
}
