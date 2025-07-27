import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserSettings } from '@/types';
import { ApiClient } from '../lib/api';
import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(rememberMe: boolean) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: rememberMe ? localStorage : sessionStorage,
        persistSession: true,
      },
    }
  );
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
  login: (
    credentials: { email: string; password: string },
    rememberMe?: boolean
  ) => Promise<void>;
  setPlaymatTexture: (texture: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; full_name?: string }) => Promise<{ data: any; error: any } | undefined>;
  logout: (auto?: boolean) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  rehydrateUser: () => Promise<void>;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  setHydrating: (hydrating: boolean) => void;
  setAutoLoggedOut: (val: boolean) => void;
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
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : undefined);
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
      login: async (credentials, rememberMe = true) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = getSupabaseClient(rememberMe);
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });
          if (error || !data.session) {
            set({ error: error?.message || 'Login failed.', isLoading: false });
            throw new Error(error?.message || 'Login failed.');
          }
          const jwt = data.session.access_token;
          // Optionally fetch user profile from backend using this JWT
          if (!data.user) {
            set({ error: 'User data missing after login.', isLoading: false });
            throw new Error('User data missing after login.');
          }
          set({
            user: {
              ...data.user,
              id: data.user?.id ?? '',
              email: data.user?.email ?? '',
            },
            isAuthenticated: true,
            accessToken: jwt,
            isLoading: false,
            error: null,
          });
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : undefined);
            const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
            const resp = await fetch(`${baseUrl}/api/auth/me`, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (resp.ok) {
              const user = await resp.json();
              set({ user });
            }
          } catch {
            // ignore, fallback to Supabase user
          }
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
          const supabase = getSupabaseClient(true);
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
            return { data, error };
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
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : undefined);
              const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
              const resp = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { Authorization: `Bearer ${jwt}` },
              });
              if (resp.ok) {
                const user = await resp.json();
                set({ user });
              }
            } catch {
              // ignore, fallback to Supabase user
            }
          }
          set({ isLoading: false });
          return { data, error };
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
          const supabase = getSupabaseClient(true); // or false, doesn't matter for signOut
          await supabase.auth.signOut();
        } catch {}
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
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : undefined);
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
      fetchWithAuth: async (input, init = {}) => {
        const { accessToken } = get();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : undefined);
        const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
        let url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        const headers = {
          ...(init.headers || {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        };
        return fetch(url, { ...init, headers });
      },
      setHydrating: (hydrating) => set({ hydrating }),
      setAutoLoggedOut: (val) => set({ autoLoggedOut: val }),
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