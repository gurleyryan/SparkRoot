"use client";
import PricingDashboard from "@/components/PricingDashboard";
import Navigation from "@/components/Navigation";
import { useAuthStore } from "@/store/authStore";
import React from "react";

export default function PricingPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const [, setShowAuthModal] = React.useState(false);
  return (
    <div className="min-h-screen">
      <Navigation
        isAuthenticated={isAuthenticated}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={logout}
      />
      <PricingDashboard />
    </div>
  );
}
