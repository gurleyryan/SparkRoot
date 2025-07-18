"use client";
import { useAuthStore } from "@/store/authStore";
import Navigation from "@/components/Navigation";
import React from "react";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  // Simple admin check: user?.email === 'admin@...' (customize as needed)
  const isAdmin = user && user.email && user.email.endsWith('@admin.com');

  return (
    <div className="min-h-screen">
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />
      {!isAdmin ? (
        <div className="flex items-center justify-center bg-black text-mtg-white min-h-[80vh]">
          <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-md w-full text-center">
            <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
            <p>You do not have permission to view this page.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center bg-black text-mtg-white min-h-[80vh]">
          <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-2xl w-full">
            <h2 className="text-3xl font-bold mb-6">Admin Dashboard</h2>
            <p>Admin features coming soon: user management, content moderation, etc.</p>
          </div>
        </div>
      )}
    </div>
  );
}
