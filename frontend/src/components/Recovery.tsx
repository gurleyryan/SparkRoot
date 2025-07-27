"use client";
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useToast } from "./ToastProvider";

export default function Recovery({ onSuccess }: { onSuccess?: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const showToast = useToast();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      setError(error.message);
      showToast(error.message, "error");
    } else {
      showToast("Password reset successful! Please log in.", "success");
      if (onSuccess) onSuccess();
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-mtg text-mtg-white mb-4">Reset Your Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-rarity-uncommon mb-2 font-mtg-body">New Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-rarity-uncommon mb-2 font-mtg-body">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full bg-rarity-common border border-rarity-uncommon rounded-lg px-4 py-3 text-mtg-white focus:border-mtg-blue focus:outline-none"
            required
          />
        </div>
        {error && (
          <div className="bg-mtg-black border border-mtg-red text-mtg-red px-4 py-3 rounded-lg">{error}</div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-rarity-rare hover:bg-rarity-mythic text-rarity-common hover:text-rarity-uncommon disabled:bg-rarity-common font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isLoading ? "Please wait..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}
