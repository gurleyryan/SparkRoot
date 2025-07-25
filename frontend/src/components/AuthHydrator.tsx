"use client";
import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { createClient } from "@supabase/supabase-js";

export default function AuthHydrator() {
  const setHydrating = useAuthStore((s) => s.setHydrating); // Add this to your store
  useEffect(() => {
    setHydrating(true);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const resp = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
            {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }
          );
          if (resp.ok) {
            const user = await resp.json();
            useAuthStore.getState().setUser(user);
            useAuthStore.setState({ accessToken: session.access_token });
          } else if (resp.status === 401 || resp.status === 403) {
            useAuthStore.getState().logout(true); // auto-logout
          }
        } catch {
          useAuthStore.getState().logout();
        }
      } else {
        useAuthStore.getState().logout();
      }
      setHydrating(false);
    });
  }, []);
  return null;
}
