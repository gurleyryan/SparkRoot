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
        const { id, email, app_metadata, user_metadata, ...rest } = session.user;
        if (!email) {
          logout(true);
          return;
        }
        // Robustly extract username and full_name from metadata
        let username = user_metadata?.username
          || app_metadata?.username
          || user_metadata?.name
          || app_metadata?.name
          || '';
        let full_name = user_metadata?.full_name
          || app_metadata?.full_name
          || user_metadata?.name
          || app_metadata?.name
          || '';
        // Only set Zustand user if username or full_name are present and non-empty
        if (username || full_name) {
          setUser({
            id,
            email,
            username,
            full_name,
            app_metadata,
            user_metadata,
            ...rest
          } as User);
        }
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
