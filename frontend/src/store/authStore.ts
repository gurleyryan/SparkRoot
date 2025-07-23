import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserSettings } from '@/types';
import { ApiClient } from '../lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  playmat_texture: string | null;
  userSettings: UserSettings | null;
  accessToken: string | null; // <-- add this
  setUser: (user: User | null) => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (data: { oldPassword: string; newPassword: string }) => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  setPlaymatTexture: (texture: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  rehydrateUser: () => Promise<void>;
  fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>; // <-- add this
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
      accessToken: null, // <-- add this
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
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : undefined);
          const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
          // 1. Login to get access token
          const resp = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
          });
          if (!resp.ok) {
            const err = await resp.json();
            set({ error: err.error || 'Login failed', isLoading: false });
            throw new Error(err.error || 'Login failed');
          }
          const data = await resp.json();
          // 2. Fetch user profile with access token
          const meResp = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${data.access_token}` },
          });
          if (!meResp.ok) {
            set({ error: 'Failed to fetch user profile', isLoading: false });
            throw new Error('Failed to fetch user profile');
          }
          const user = await meResp.json();
          set({
            user,
            isAuthenticated: true,
            accessToken: data.access_token,
            isLoading: false,
            error: null,
          });
        } catch (err: unknown) {
          if (err instanceof Error) {
            set({ error: err.message || 'Login failed', isLoading: false });
          } else {
            set({ error: 'Login failed', isLoading: false });
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
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? (window as any).NEXT_PUBLIC_API_URL : undefined);
          const baseUrl = apiUrl ? apiUrl.replace(/\/$/, '') : '';
          // 1. Register to get access token
          const resp = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          });
          if (!resp.ok) {
            const err = await resp.json();
            set({ error: err.error || 'Registration failed', isLoading: false });
            throw new Error(err.error || 'Registration failed');
          }
          const data = await resp.json();
          // 2. Fetch user profile with access token (same as login)
          const meResp = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${data.access_token}` },
          });
          if (!meResp.ok) {
            set({ error: 'Failed to fetch user profile', isLoading: false });
            throw new Error('Failed to fetch user profile');
          }
          const user = await meResp.json();
          set({
            user,
            isAuthenticated: true,
            accessToken: data.access_token,
            isLoading: false,
            error: null,
          });
        } catch (err: unknown) {
          if (err instanceof Error) {
            set({ error: err.message || 'Registration failed', isLoading: false });
          } else {
            set({ error: 'Registration failed', isLoading: false });
          }
        }
      },
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          error: null,
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
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        playmat_texture: state.playmat_texture,
        userSettings: state.userSettings,
        accessToken: state.accessToken, // <-- add this
      }),
    }
  )
);