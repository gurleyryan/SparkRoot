"use client";
import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import PlaymatSelector from "@/components/PlaymatSelector";

export default function AccountPage() {
  // Remove token from Zustand/localStorage, rely on cookie-based session
  const user = useAuthStore((s) => s.user);
  const userSettings = useAuthStore((s) => s.userSettings);
  // Instead of Zustand isAuthenticated, check session via API
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    async function checkSession() {
      try {
        const resp = await fetch("/api/auth/me", { credentials: "include" });
        if (resp.ok) {
          const userData = await resp.json();
          useAuthStore.getState().setUser(userData);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkSession();
  }, []);
  const [loading, setLoading] = useState(false);

  // Spinner overlay
  function SpinnerOverlay() {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-mtg-blue"></div>
      </div>
    );
  }

  useEffect(() => {
    // Optionally, fetch latest settings on mount
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto p-8 mt-12 bg-black rounded-xl border border-mtg-blue text-center">
        <h2 className="text-2xl font-bold mb-4">Account</h2>
        <p className="text-lg text-gray-300">You must be logged in to view your account settings.</p>
      </div>
    );
  }

  // Form state for editable fields
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    username: user?.username || "",
    email: user?.email || ""
  });
  const [status, setStatus] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [showTOTPModal, setShowTOTPModal] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(true);

  // Handler for input changes
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "username") {
      setUsernameAvailable(true); // Reset on change
    }
  }

  // Real API calls for uniqueness checks
  async function checkUsernameAvailability(username: string) {
    if (!username) return false;
    try {
      const resp = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
      const data = await resp.json();
      return data.available;
    } catch {
      return false;
    }
  }

  async function checkEmailAvailability(email: string) {
    if (!email) return false;
    try {
      const resp = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
      const data = await resp.json();
      return data.available;
    } catch {
      return false;
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    // Username uniqueness check
    if (form.username !== user?.username) {
      const available = await checkUsernameAvailability(form.username);
      setUsernameAvailable(available);
      if (!available) {
        setStatus("Username is already taken.");
        setLoading(false);
        return;
      }
    }
    // Email uniqueness check
    if (form.email !== user?.email) {
      const available = await checkEmailAvailability(form.email);
      if (!available) {
        setStatus("Email is already in use.");
        setLoading(false);
        return;
      }
      setVerifyingEmail(true);
      setShowTOTPModal(true);
      setLoading(false);
      return;
    }
    // Call API to update user settings (full name, username)
    try {
      const resp = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ full_name: form.full_name, username: form.username })
      });
      if (resp.ok) {
        setStatus("Account updated successfully.");
        // Re-fetch user info and update store
        const userResp = await fetch("/api/auth/me", { credentials: "include" });
        if (userResp.ok) {
          const newUser = await userResp.json();
          useAuthStore.getState().setUser(newUser);
        }
      } else {
        setStatus("Failed to update account.");
      }
    } catch {
      setStatus("Network error updating account.");
    }
    setLoading(false);
  }

  // Real TOTP verification and email update
  async function handleTOTPVerify(e: React.FormEvent) {
    e.preventDefault();
    setTotpError("");
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/verify-totp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ code: totpCode })
      });
      if (resp.ok) {
        // Now update email
        const emailResp = await fetch("/api/auth/update-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ new_email: form.email })
        });
        if (emailResp.ok) {
          setShowTOTPModal(false);
          setVerifyingEmail(false);
          setStatus("Email updated successfully.");
          setTotpCode("");
          // Re-fetch user info and update store
          const userResp = await fetch("/api/auth/me", { credentials: "include" });
          if (userResp.ok) {
            const newUser = await userResp.json();
            useAuthStore.getState().setUser(newUser);
          }
        } else {
          setTotpError("Failed to update email after TOTP verification.");
        }
      } else {
        setTotpError("Invalid TOTP code. Please try again.");
      }
    } catch {
      setTotpError("Error verifying TOTP code. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-8 mt-12 bg-black rounded-xl border border-mtg-blue relative">
      {loading && <SpinnerOverlay />}
      <h2 className="text-3xl font-bold mb-6 text-mtg-white">Account Settings</h2>
      <form onSubmit={handleUpdate} className="space-y-6">
        <div>
          <label className="text-lg font-mtg-body text-mtg-white mb-2 block" htmlFor="full_name">Full Name:</label>
          <input
            type="text"
            name="full_name"
            id="full_name"
            value={form.full_name}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded bg-mtg-gray text-mtg-white border border-mtg-blue"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="text-lg font-mtg-body text-mtg-white mb-2 block" htmlFor="username">Username:</label>
          <input
            type="text"
            name="username"
            id="username"
            value={form.username}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded bg-mtg-gray text-mtg-white border ${usernameAvailable ? "border-mtg-blue" : "border-red-500"}`}
            autoComplete="username"
          />
          {!usernameAvailable && (
            <div className="text-red-500 text-sm mt-1">Username is already taken.</div>
          )}
        </div>
        <div>
          <label className="text-lg font-mtg-body text-mtg-white mb-2 block" htmlFor="email">Email:</label>
          <input
            type="email"
            name="email"
            id="email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded bg-mtg-gray text-mtg-white border border-mtg-blue"
            autoComplete="email"
            disabled={verifyingEmail}
          />
          {verifyingEmail && (
            <div className="text-yellow-400 text-sm mt-1">App Authenticator (TOTP) required to change email.</div>
          )}
        </div>
        {/* Phone field removed (not present in User type) */}
        <button
          type="submit"
          className="bg-mtg-blue text-white px-6 py-2 rounded font-bold hover:bg-mtg-blue-dark"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
        {status && (
          <div className="text-center text-mtg-white mt-4">{status}</div>
        )}
      </form>
      <div className="mt-8">
        <PlaymatSelector />
      </div>
      {/* Add more settings controls here as needed */}
      {/* TOTP Modal */}
      {showTOTPModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-mtg-gray p-8 rounded-xl shadow-lg max-w-sm w-full border border-mtg-blue">
            <h3 className="text-xl font-bold mb-4 text-mtg-white">App Authenticator Required</h3>
            <p className="mb-4 text-mtg-white">Enter the 6-digit code from your authenticator app to confirm your email change.</p>
            <form onSubmit={handleTOTPVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                className="w-full px-4 py-2 rounded bg-black text-mtg-white border border-mtg-blue text-center text-xl tracking-widest"
                placeholder="123456"
                autoFocus
              />
              {totpError && <div className="text-red-500 text-sm">{totpError}</div>}
              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
                  onClick={() => { setShowTOTPModal(false); setVerifyingEmail(false); setTotpCode(""); setTotpError(""); }}
                  disabled={loading}
                >Cancel</button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-mtg-blue text-white font-bold hover:bg-mtg-blue-dark"
                  disabled={loading || totpCode.length !== 6}
                >Verify</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
