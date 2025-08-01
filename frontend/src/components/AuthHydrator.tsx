"use client";
import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@/types/index";

// Minimal AuthHydrator: only listen for Supabase auth events for tab sync
export default function AuthHydrator() {
  useEffect(() => {
    // Immediately set hydrating to false since we do not fetch on mount
    useAuthStore.getState().setHydrating(false);
    const supabase = createClient();
    const { setUser, logout, setAutoLoggedOut } = useAuthStore.getState();
    // Listen for auth state changes (login, logout, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        logout(true);
      } else if (session?.user) {
        // Optionally, you could trigger a global fetch here if needed
        const { id, email, ...rest } = session.user;
        if (!email) {
          // If email is missing, do not set user (or handle as needed)
          logout(true);
          return;
        }
        setUser({ id, email, ...rest } as User); // Cast to the specific User type
        useAuthStore.setState({ accessToken: session.access_token });
        setAutoLoggedOut(false);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);
  return null;
}
