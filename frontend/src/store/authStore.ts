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
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },
      updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          const updatedUser = await apiClient.updateProfile(data);
          set({ user: updatedUser as User, isLoading: false });
        } catch (err: any) {
          set({ error: err?.message || 'Failed to update profile', isLoading: false });
        }
      },
      changePassword: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const resp = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
          });
          if (!resp.ok) {
            const err = await resp.json();
            set({ error: err.error || 'Failed to update password.' });
            throw new Error(err.error || 'Failed to update password.');
          }
        } catch (err: any) {
          set({ error: err?.message || 'Failed to update password.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          await apiClient.login(credentials);
          const profileClient = new ApiClient();
          const userProfile = await profileClient.getProfile() as User;
          let userSettings: UserSettings | null = null;
          try {
            const settingsResp = await profileClient.getSettings() as { success: boolean; settings?: UserSettings };
            if (settingsResp && settingsResp.success && settingsResp.settings) {
              userSettings = settingsResp.settings;
            }
          } catch {
            // Handle error silently
          }
          let playmat_texture = userSettings?.playmat_texture || null;
          if (!playmat_texture) {
            let mats: string[] = [];
            try {
              const resp = await fetch('/api/playmats');
              const data = await resp.json();
              if (data.success && Array.isArray(data.files)) {
                mats = data.files;
              }
            } catch {
              // Error fetching playmat textures
            }
            if (mats.length > 0) {
              playmat_texture = mats[Math.floor(Math.random() * mats.length)];
              try {
                await profileClient.updateSettings({ ...userSettings, playmat_texture });
              } catch {
                // Error updating playmat texture
              }
            }
          }
          set({
            user: userProfile,
            isAuthenticated: true,
            isLoading: false,
            playmat_texture,
            userSettings,
          });
        } catch {
          set({
            error: 'Login failed',
            isLoading: false,
            isAuthenticated: false,
            user: null,
            playmat_texture: null,
            userSettings: null,
          });
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
          const apiClient = new ApiClient();
          await apiClient.register(userData) as User;
          await get().login({
            email: userData.email,
            password: userData.password,
          });
        } catch {
          set({
            error: 'Registration failed',
            isLoading: false,
          });
          throw new Error('Registration failed');
        }
      },
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },
      clearError: () => {
        set({ error: null });
      },
      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const apiClient = new ApiClient();
          const userProfile = await apiClient.getProfile() as User;
          set({
            user: userProfile,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Session expired. Please log in again.',
          });
        }
      },
      rehydrateUser: async () => {
        const { user } = get();
        if (!user) {
          await get().checkAuth();
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
      }),
    }
  )
);