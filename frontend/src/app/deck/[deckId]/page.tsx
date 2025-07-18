"use client";
import { useParams } from "next/navigation";
import DeckDetail from "@/components/DeckDetail";
import Navigation from "@/components/Navigation";
import { useAuthStore } from "@/store/authStore";
import React from "react";

export default function DeckDetailPage() {
  const params = useParams();
  const deckId = typeof params.deckId === "string" ? params.deckId : Array.isArray(params.deckId) ? params.deckId[0] : "";
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
      <div className="max-w-4xl mx-auto p-8 mt-12 bg-black rounded-xl border border-mtg-blue relative">
        <DeckDetail deckId={deckId} />
      </div>
    </div>
  );
}
