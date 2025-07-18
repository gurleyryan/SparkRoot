"use client";
import { useAuthStore } from "@/store/authStore";
import React from "react";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  // Simple admin check: user?.email === 'admin@...' (customize as needed)
  const isAdmin = user && user.email && user.email.endsWith('@admin.com');

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-mtg-white">
        <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-mtg-white">
      <div className="sleeve-morphism p-8 rounded-xl shadow-xl max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-6">Admin Dashboard</h2>
        <p>Admin features coming soon: user management, content moderation, etc.</p>
      </div>
    </div>
  );
}
