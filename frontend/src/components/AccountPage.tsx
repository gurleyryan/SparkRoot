
"use client";
import React from "react";
import ProfileSettings from "./ProfileSettings";
import PlaymatSelector from "./PlaymatSelector";
import UserSettingsPanel from "./UserSettingsPanel";
import Navigation from "./Navigation";
import { useAuthStore } from "../store/authStore";

export default function AccountPage() {
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
      <div className="max-w-2xl mx-auto p-8 mt-12 bg-black rounded-xl border border-mtg-blue relative">
        <h2 className="text-3xl font-bold mb-6 text-mtg-white">Account</h2>
        <ProfileSettings />
        <div className="mt-8">
          <PlaymatSelector />
        </div>
        <UserSettingsPanel />
      </div>
    </div>
  );
}
