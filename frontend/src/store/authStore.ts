// Add to global window type for fetch guard
declare global {
  interface Window {
    __hasFetchedUserCollections?: boolean;
  }
}
import { create } from 'zustand';
// Prevent multiple redirects after logout
let hasRedirectedAfterLogout = false;
let hasLoggedOutThisSession = false;
import { persist } from 'zustand/middleware';
import type { User, UserSettings, Collection } from '@/types';
import { ApiClient } from '../lib/api';
import { createClient } from '@/utils/supabase/client';
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
        if (user) {
          user.username = user.username
            || user.user_metadata?.username
            || user.app_metadata?.username
            || user.user_metadata?.name
            || user.app_metadata?.name
            || '';
          user.full_name = user.full_name
            || user.user_metadata?.full_name
            || user.app_metadata?.full_name
            || user.user_metadata?.name
            || user.app_metadata?.name
            || '';
        }
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
              set({ user, isAuthenticated: true, accessToken: jwt, error: null });
              await get().fetchUserAndCollections();
              set({ isLoading: false });
              return;
            } else {
              set({ error: 'Failed to fetch user profile.', isLoading: false });
              return;
            }
          }
          set({ error: 'No access token returned from Supabase.', isLoading: false });
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
        // Prevent infinite repeated logout calls
        if (hasLoggedOutThisSession) {
          // Already logged out this session
          return;
        }
        hasLoggedOutThisSession = true;
        // Dispatch global logout event for all listeners (DeckBuilder, CollectionGrid, etc)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('app-logout'));
        }
        // Clear fetch guard so collections/inventory will reload after next login
        if (typeof window !== 'undefined') {
          window.__hasFetchedUserCollections = false;
        }
        // Supabase signOut (async, non-blocking)
        (async () => {
          // ...your Supabase signOut logic here...
        })();

        // Remove Supabase auth cookie only if it exists (non-blocking)
        setTimeout(() => {
          // ...your cookie removal logic here...
        }, 0);
        // Supabase signOut (async, non-blocking)
        (async () => {
          try {
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
              console.debug('[authStore] Supabase signOut called');
            }
          } catch (err) {
            if (typeof window !== 'undefined') {
              console.debug('[authStore] Supabase signOut error:', err);
            }
            // Ignore errors during sign out
          }
        })();

        // Remove Supabase auth cookie only if it exists (non-blocking)
        setTimeout(() => {
          try {
            const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split(".supabase.co")[0]?.split("https://")[1] || "";
            const cookieName = `sb-${projectRef}-auth-token`;
            const cookies = document.cookie.split('; ');
            if (cookieName && cookies.some(c => c.startsWith(cookieName + '='))) {
              Cookies.remove(cookieName);
            }
          } catch (err) {
            console.debug('[authStore] Cookie removal error:', err);
            // Ignore cookie errors
          }
        }, 0);

        // Defer heavy state reset to avoid blocking main thread
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            try {
              console.debug('[authStore] Calling useCollectionStore.resetAll() after logout');
              const { useCollectionStore } = require('@/store/collectionStore');
              useCollectionStore.getState().resetAll();
            } catch (err) {
              console.debug('[authStore] Error in useCollectionStore.resetAll():', err);
              // Ignore errors
            }
          }, 0);
        }

        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          playmat_texture: null,
          userSettings: null,
          error: null,
          autoLoggedOut: auto,
        });
        // Only redirect if not already on homepage and not already navigating, and only once
        try {
          if (
            typeof window !== 'undefined' &&
            window.location.pathname !== '/' &&
            !window.location.hash &&
            !window.location.search &&
            !hasRedirectedAfterLogout
          ) {
            hasRedirectedAfterLogout = true;
            window.location.replace('/');
            // Reset flag after short debounce (in case of SPA navigation)
            setTimeout(() => { hasRedirectedAfterLogout = false; }, 2000);
          }
        } catch {
          // Ignore navigation errors
        }
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
        const cookies = document.cookie.split('; ');
        if (cookieName) {
          const cookie = cookies.find(c => c.startsWith(cookieName + '='));
          if (cookie) {
            try {
              const value = decodeURIComponent(cookie.split('=')[1]);
              // Supabase stores a JSON string with access_token inside
              const parsed = JSON.parse(value);
              if (parsed && parsed.access_token) {
                set({ accessToken: parsed.access_token });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      },

      fetchWithAuth: async (input, init = {}) => {
        const { accessToken, syncAccessTokenFromCookie, logout } = get();
        let token = accessToken;
        // If no token, try to sync from cookie
        if (!token) {
          syncAccessTokenFromCookie();
          token = get().accessToken;
        }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_API_URL?: string }).NEXT_PUBLIC_API_URL : undefined);
        const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
        let url = typeof input === 'string' && input.startsWith('/') ? `${baseUrl}${input}` : input;
        const headers = {
          ...(init.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
        let response = await fetch(url, { ...init, headers });
        // If 401, try to refresh token from cookie once, then logout if still unauthorized
        if (response.status === 401) {
          syncAccessTokenFromCookie();
          const refreshedToken = get().accessToken;
          if (refreshedToken && refreshedToken !== token) {
            // Try again with refreshed token
            response = await fetch(url, { ...init, headers: { ...headers, Authorization: `Bearer ${refreshedToken}` } });
            if (response.status !== 401) return response;
          }
          // If still unauthorized, log out user and clear session
          logout(true);
          set({ error: 'Session expired, please log in again.' });
          throw new Error('Session expired, please log in again.');
        }
        return response;
      },
      setHydrating: (hydrating) => set({ hydrating }),
      setAutoLoggedOut: (val) => set({ autoLoggedOut: val }),
      fetchUserAndCollections: async () => {
        // Prevent infinite fetch loop: only run once per hydration
        if (typeof window !== 'undefined') {
          if (window.__hasFetchedUserCollections) {
            console.debug('[authStore] fetchUserAndCollections: already fetched for this hydration, skipping');
            return;
          }
          window.__hasFetchedUserCollections = true;
        }
        const { user, accessToken } = get();
        if (!user || !accessToken) {
          if (typeof window !== 'undefined') {
            console.debug('[authStore] fetchUserAndCollections: missing user or accessToken, skipping');
          }
          return;
        }
        set({ isLoading: true, hydrating: true });
        try {
          const apiClient = new ApiClient(accessToken);
          console.debug('[authStore] fetchUserAndCollections: calling getProfile');
          const profilePromise = apiClient.getProfile();
          console.debug('[authStore] fetchUserAndCollections: calling getCollections');
          const collectionsPromise = apiClient.getCollections();
          console.debug('[authStore] fetchUserAndCollections: calling getInventory');
          const inventoryPromise = apiClient.getInventory();
          const [profile, collectionsResult, inventoryResult] = await Promise.all([
            profilePromise,
            collectionsPromise,
            inventoryPromise,
          ]);
          console.debug('[authStore] fetchUserAndCollections: got profile', profile);
          console.debug('[authStore] fetchUserAndCollections: got collections', collectionsResult);
          console.debug('[authStore] fetchUserAndCollections: got inventory', inventoryResult);
          // Defensive: ensure username is present in user object
          let userProfile = profile as User;
          if (userProfile) {
            if (!userProfile.username) {
              if (userProfile.full_name) {
                userProfile.username = userProfile.full_name;
              } else if (userProfile.email) {
                userProfile.username = userProfile.email;
              }
            }
          }
          // Extract arrays from API responses
          // Robustly extract collections array
          let collectionsArray: Collection[] = [];
          if (Array.isArray(collectionsResult)) {
            collectionsArray = collectionsResult;
          } else if (
            collectionsResult &&
            typeof collectionsResult === 'object' &&
            'collections' in collectionsResult &&
            Array.isArray((collectionsResult as { collections?: Collection[] }).collections)
          ) {
            collectionsArray = (collectionsResult as { collections: Collection[] }).collections;
          }
          // Robustly extract inventory array
          let inventoryArray: Collection[] = [];
          if (Array.isArray(inventoryResult)) {
            inventoryArray = inventoryResult as Collection[];
          } else if (inventoryResult && Array.isArray(inventoryResult.inventory)) {
            inventoryArray = inventoryResult.inventory as Collection[];
          }
          // Update Zustand collectionStore with fetched collections and inventory
          const { setCollections, setUserInventory } = require('../store/collectionStore').useCollectionStore.getState();
          setCollections(collectionsArray);
          setUserInventory(inventoryArray);
          // Update user profile/settings in authStore
          set({ user: userProfile, isAuthenticated: !!userProfile });
          // Defensive: also update collections/inventory in Zustand collectionStore (for SSR/hydration edge cases)
          if (typeof window !== 'undefined') {
            try {
              const { useCollectionStore } = require('@/store/collectionStore');
              useCollectionStore.getState().setCollections(collectionsArray);
              useCollectionStore.getState().setUserInventory(inventoryArray);
              // Mark as fetched to prevent duplicate fetches
              window.__hasFetchedUserCollections = true;
            } catch (err) {
              console.debug('[authStore] Error updating collectionStore:', err);
            }
          }
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Failed to fetch user/collections/inventory' });
        } finally {
          set({ isLoading: false, hydrating: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
      // Persist full user object for username/full_name
      // (Zustand persist will store all keys in partialize)
    }
  )
);