"use client";
import { useAuthStore } from "@/store/authStore";
import Navigation from "@/components/Navigation";
import React from "react";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  // Use app_metadata.role for admin check
  const isAdmin = user?.app_metadata?.role === 'admin';

  return (
    <div className="min-h-screen bg-black text-mtg-white">
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />
      {!isAdmin ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p>You do not have permission to view this page.</p>
          </div>
        </div>
      ) : (
        <main id="main-content" className="container mx-auto py-10 px-4">
          <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-5xl mx-auto w-full">
            <h2 className="text-4xl font-bold mb-2 text-center text-rarity-mythic drop-shadow-lg">Admin Dashboard</h2>
            <p className="text-lg text-mtg-gray-200 mb-8 text-center">Manage users, decks, collections, and moderate content.</p>

            {/* Entity Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-10">
              {/* Users */}
              <div className="bg-mtg-blue/80 rounded-lg p-5 flex flex-col items-center shadow-md border-2 border-mtg-blue">
                <i className="ms ms-planeswalker ms-3x text-rarity-mythic mb-2"></i>
                <span className="text-2xl font-bold">Users</span>
                <span className="text-3xl font-mtg-mono mt-2">—</span>
                <span className="text-sm text-mtg-gray-300 mt-1">Total</span>
              </div>
              {/* Decks */}
              <div className="bg-mtg-green/80 rounded-lg p-5 flex flex-col items-center shadow-md border-2 border-mtg-green">
                <i className="ms ms-commander ms-3x text-rarity-rare mb-2"></i>
                <span className="text-2xl font-bold">Decks</span>
                <span className="text-3xl font-mtg-mono mt-2">—</span>
                <span className="text-sm text-mtg-gray-300 mt-1">Total</span>
              </div>
              {/* Collections */}
              <div className="bg-mtg-red/80 rounded-lg p-5 flex flex-col items-center shadow-md border-2 border-mtg-red">
                <i className="ms ms-library ms-3x text-rarity-uncommon mb-2"></i>
                <span className="text-2xl font-bold">Collections</span>
                <span className="text-3xl font-mtg-mono mt-2">—</span>
                <span className="text-sm text-mtg-gray-300 mt-1">Total</span>
              </div>
              {/* Moderation */}
              <div className="bg-mtg-black/80 rounded-lg p-5 flex flex-col items-center shadow-md border-2 border-mtg-black">
                <i className="ms ms-ability-dungeon ms-3x text-rarity-mythic mb-2"></i>
                <span className="text-2xl font-bold">Moderation</span>
                <span className="text-3xl font-mtg-mono mt-2">—</span>
                <span className="text-sm text-mtg-gray-300 mt-1">Reports</span>
              </div>
            </div>

            {/* Entity Management Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* User Management */}
              <section className="bg-mtg-blue/30 rounded-lg p-6 shadow-inner border border-mtg-blue">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <i className="ms ms-planeswalker text-rarity-mythic"></i> User Management
                </h3>
                <p className="text-mtg-gray-200 mb-2">View, promote, or ban users. (Coming soon)</p>
                <div className="bg-mtg-black/60 rounded p-4 text-center text-mtg-gray-400 italic">User list and actions will appear here.</div>
              </section>
              {/* Deck Management */}
              <section className="bg-mtg-green/30 rounded-lg p-6 shadow-inner border border-mtg-green">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <i className="ms ms-commander text-rarity-rare"></i> Decks
                </h3>
                <p className="text-mtg-gray-200 mb-2">Review and manage submitted decks. (Coming soon)</p>
                <div className="bg-mtg-black/60 rounded p-4 text-center text-mtg-gray-400 italic">Deck list and actions will appear here.</div>
              </section>
              {/* Collection Management */}
              <section className="bg-mtg-red/30 rounded-lg p-6 shadow-inner border border-mtg-red">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <i className="ms ms-library text-rarity-uncommon"></i> Collections
                </h3>
                <p className="text-mtg-gray-200 mb-2">Audit and manage user collections. (Coming soon)</p>
                <div className="bg-mtg-black/60 rounded p-4 text-center text-mtg-gray-400 italic">Collection list and actions will appear here.</div>
              </section>
              {/* Moderation */}
              <section className="bg-mtg-black/30 rounded-lg p-6 shadow-inner border border-mtg-black">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <i className="ms ms-ability-dungeon text-rarity-mythic"></i> Moderation
                </h3>
                <p className="text-mtg-gray-200 mb-2">Review reports and moderate content. (Coming soon)</p>
                <div className="bg-mtg-black/60 rounded p-4 text-center text-mtg-gray-400 italic">Moderation queue will appear here.</div>
              </section>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
