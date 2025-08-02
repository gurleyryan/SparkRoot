import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserSettings } from '@/types';
import { ApiClient } from '../lib/api';
import { createClient } from '@/utils/supabase/client';
import { useCollectionStore } from "@/store/collectionStore"; // Import your collection store
import Cookies from 'js-cookie';

export function getSupabaseClient() {
  return createClient();
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  playmat_texture: string | null;
  userSettings: UserSettings | null;
  accessToken: string | null;
  hydrating: boolean;
  autoLoggedOut: boolean;
  setUser: (user: User | null) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (data: { oldPassword: string; newPassword: string }) => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  setPlaymatTexture: (texture: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; full_name?: string }) => Promise<{ data: User | null; error: string | Error | null } | undefined>;
  logout: (auto?: boolean) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  rehydrateUser: () => Promise<void>;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  setHydrating: (hydrating: boolean) => void;
  setAutoLoggedOut: (val: boolean) => void;
  fetchUserAndCollections: () => Promise<void>;
  syncAccessTokenFromCookie: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      playmat_texture: null,
      userSettings: null,
      accessToken: null,
      hydrating: true,
      autoLoggedOut: false,
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },
      updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          const updatedUser = await apiClient.updateProfile(data);
          set({ user: updatedUser as User, isLoading: false });
        } catch (err: unknown) {
          if (err instanceof Error) {
            set({ error: err.message || 'Failed to update profile', isLoading: false });
          } else {
            set({ error: 'Failed to update profile', isLoading: false });
          }
        }
      },
      changePassword: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_API_URL?: string }).NEXT_PUBLIC_API_URL : undefined);
          const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
          const resp = await fetch(`${baseUrl}/api/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!resp.ok) {
            const err = await resp.json();
            set({ error: err.error || 'Failed to update password.' });
            throw new Error(err.error || 'Failed to update password.');
          }
        } catch (err: unknown) {
          if (err instanceof Error) {
            set({ error: err.message || 'Failed to update password.' });
            throw err;
          } else {
            set({ error: 'Failed to update password.' });
            throw new Error('Failed to update password.');
          }
        } finally {
          set({ isLoading: false });
        }
      },
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = createClient();
          const { data, error } = await supabase.auth.signInWithPassword(credentials);
          if (error) {
            set({ error: error.message, isLoading: false });
            return;
          }
          // Always fetch full user profile from API after login
          const jwt = data?.session?.access_token;
          if (jwt) {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_API_URL?: string }).NEXT_PUBLIC_API_URL : undefined);
            const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
            const resp = await fetch(`${baseUrl}/api/auth/me`, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (resp.ok) {
              const user = await resp.json();
              set({ user, isAuthenticated: true, accessToken: jwt, isLoading: false, error: null });
              return;
            }
          }
          // Fallback: set basic user info if API call fails
          set({ isAuthenticated: true, isLoading: false, error: null });
        } catch (err: unknown) {
          if (err instanceof Error) {
            set({ error: err.message || 'Login failed.', isLoading: false });
          } else {
            set({ error: 'Login failed.', isLoading: false });
          }
        }
      },
      setPlaymatTexture: async (texture) => {
        const { userSettings } = get();
        set({ playmat_texture: texture });
        const apiClient = new ApiClient();
        try {
          await apiClient.updateSettings({ ...userSettings, playmat_texture: texture });
          set({
            userSettings: {
              ...userSettings,
              playmat_texture: texture,
              theme: userSettings?.theme ?? 'light',
              default_format: userSettings?.default_format ?? 'standard',
              currency: userSettings?.currency ?? 'usd',
              card_display: userSettings?.card_display ?? 'grid',
              auto_save: userSettings?.auto_save ?? false,
              notifications: {
                price_alerts: userSettings?.notifications?.price_alerts ?? false,
                deck_updates: userSettings?.notifications?.deck_updates ?? false,
                collection_changes: userSettings?.notifications?.collection_changes ?? false,
              },
            },
          });
        } catch {
          // Error updating playmat texture
        }
      },
      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
              data: {
                username: userData.username,
                full_name: userData.full_name,
              },
            },
          });
          // If error, set error and return
          if (error) {
            set({ error: error?.message || 'Registration failed', isLoading: false });
            return { data: null, error: error.message || 'Registration failed' };
          }
          // If session exists, treat as logged in
          if (data && data.session && data.user) {
            const jwt = data.session.access_token;
            set({
              user: {
                ...data.user,
                id: data.user.id ?? '',
                email: data.user.email ?? '',
              },
              isAuthenticated: true,
              accessToken: jwt,
              isLoading: false,
              error: null,
            });
            try {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_API_URL?: string }).NEXT_PUBLIC_API_URL : undefined);
              const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
              const resp = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { Authorization: `Bearer ${jwt}` },
              });
              if (resp.ok) {
                const user = await resp.json();
                set({ user });
                return { data: user, error: null };
              }
            } catch {
              // ignore, fallback to Supabase user
            }
            return { data: { ...data.user, id: data.user.id ?? '', email: data.user.email ?? '' }, error: null };
          }
          set({ isLoading: false });
          return { data: null, error: null };
        } catch (err: unknown) {
          if (err instanceof Error) {
            set({ error: err.message || 'Registration failed', isLoading: false });
            return { data: null, error: err };
          } else {
            set({ error: 'Registration failed', isLoading: false });
            return { data: null, error: 'Registration failed' };
          }
        }
      },
      logout: async (auto = false) => {
        try {
          const supabase = getSupabaseClient(); // or false, doesn't matter for signOut
          await supabase.auth.signOut();
        } catch {
          // Ignore errors during sign out
        }
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          error: null,
          autoLoggedOut: auto,
        });
      },
      clearError: () => {
        set({ error: null });
      },
      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ user: null, isAuthenticated: false });
          return;
        }
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_API_URL?: string }).NEXT_PUBLIC_API_URL : undefined);
          const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
          const resp = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!resp.ok) {
            set({ user: null, isAuthenticated: false });
            return;
          }
          const user = await resp.json();
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
      rehydrateUser: async () => {
        await get().checkAuth();
      },
      syncAccessTokenFromCookie: () => {
        // Replace <project_ref> with your actual Supabase project ref
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split(".supabase.co")[0]?.split("https://")[1] || "";
        const cookieName = `sb-${projectRef}-auth-token`;
        if (cookieName) {
          Cookies.remove(cookieName);
        }
      },

      fetchWithAuth: async (input, init = {}) => {
        const { accessToken, syncAccessTokenFromCookie } = get();
        if (!accessToken) {
          syncAccessTokenFromCookie();
          set({ error: 'Session expired, please log in again.' });
          throw new Error('No access token');
        }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_API_URL?: string }).NEXT_PUBLIC_API_URL : undefined);
        const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
        let url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        const headers = {
          ...(init.headers || {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        };
        const response = await fetch(url, { ...init, headers });
        if (response.status === 401) {
          syncAccessTokenFromCookie();
          set({ error: 'Session expired, please log in again.' });
          throw new Error('Session expired, please log in again.');
        }
        return response;
      },
      setHydrating: (hydrating) => set({ hydrating }),
      setAutoLoggedOut: (val) => set({ autoLoggedOut: val }),
      fetchUserAndCollections: async () => {
        const { accessToken } = get();
        if (!accessToken) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_API_URL?: string }).NEXT_PUBLIC_API_URL : undefined);
        const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
        const [userRes, collectionsRes, inventoryRes] = await Promise.all([
          fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch(`${baseUrl}/api/collections`, { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch(`${baseUrl}/api/inventory`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        ]);
        if (userRes.ok) {
          const user = await userRes.json();
          set({ user, isAuthenticated: true });
        }
        if (collectionsRes.ok) {
          const data = await collectionsRes.json();
          useCollectionStore.getState().setCollections(data.collections || []);
        }
        if (inventoryRes.ok) {
          const data = await inventoryRes.json();
          // Support both {cards: [...]} and {inventory: {cards: [...]}}
          let cards = [];
          if (Array.isArray(data.cards)) {
            cards = data.cards;
          } else if (data.inventory && Array.isArray(data.inventory.cards)) {
            cards = data.inventory.cards;
          }
          useCollectionStore.getState().setUserInventory(cards);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        playmat_texture: state.playmat_texture,
        userSettings: state.userSettings,
        accessToken: state.accessToken,
      }),
    }
  )
);