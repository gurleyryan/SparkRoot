import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';
import { ApiClient } from '../lib/api';

import type { UserSettings } from '@/types';
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  playmat_texture: string | null;
  userSettings: UserSettings | null;
  // Actions
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  rehydrateUser: () => Promise<void>;
  setPlaymatTexture: (texture: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      playmat_texture: null,
      userSettings: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          const loginResp = await apiClient.login(credentials);
          const { access_token } = loginResp as { access_token: string; token_type: string };
          if (!access_token) {
            throw new Error('No access_token in login response');
          }
          // Get user profile and settings with the new token
          const profileClient = new ApiClient(access_token);
          const userProfile = await profileClient.getProfile() as User;
          // Fetch user settings
          let userSettings: UserSettings | null = null;
          try {
            const settingsResp = await profileClient.getSettings() as { success: boolean; settings?: UserSettings };
            if (settingsResp && settingsResp.success && settingsResp.settings) {
              userSettings = settingsResp.settings;
            }
          } catch {}
          // Randomize playmat if not set
          let playmat_texture = userSettings?.playmat_texture || null;
          if (!playmat_texture) {
            let mats: string[] = [];
            try {
              const resp = await fetch('/api/playmats');
              const data = await resp.json();
              if (data.success && Array.isArray(data.files)) {
                mats = data.files;
              }
            } catch {}
            if (mats.length > 0) {
              playmat_texture = mats[Math.floor(Math.random() * mats.length)];
              // Persist to backend
              try {
                await profileClient.updateSettings({ ...userSettings, playmat_texture });
              } catch {}
            }
          }
          set({
            user: userProfile,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
            playmat_texture,
            userSettings,
          });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
          }
        } catch (e) {
          set({
            error: 'Login failed',
            isLoading: false,
            isAuthenticated: false,
            user: null,
            token: null,
            playmat_texture: null,
            userSettings: null,
          });
          throw new Error('Login failed');
        }
      },
      setPlaymatTexture: async (texture) => {
        const { token, userSettings } = get();
        set({ playmat_texture: texture });
        if (token) {
          const apiClient = new ApiClient(token);
          try {
            await apiClient.updateSettings({ ...userSettings, playmat_texture: texture });
            set({ 
              userSettings: { 
                ...userSettings, 
                playmat_texture: texture, 
                theme: userSettings?.theme ?? "light", // Ensure theme is always defined
                default_format: userSettings?.default_format ?? "standard", // Provide defaults if needed
                currency: userSettings?.currency ?? "usd",
                card_display: userSettings?.card_display ?? "grid",
                auto_save: userSettings?.auto_save ?? false,
                notifications: {
                  price_alerts: userSettings?.notifications?.price_alerts ?? false,
                  deck_updates: userSettings?.notifications?.deck_updates ?? false,
                  collection_changes: userSettings?.notifications?.collection_changes ?? false,
                }
              } 
            });
          } catch {}
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          await apiClient.register(userData) as User;
          // After successful registration, automatically log in
          await get().login({ 
            email: userData.email, 
            password: userData.password 
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
          token: null,
          isAuthenticated: false,
          error: null,
        });
        // Remove any legacy 'auth_token' from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
      },

      clearError: () => {
        set({ error: null });
      },

      checkAuth: async () => {
        const { token } = get();
        
        if (!token) {
          return;
        }

        set({ isLoading: true });

        try {
          const apiClient = new ApiClient(token);
          const userProfile = await apiClient.getProfile() as User;
          
          set({
            user: userProfile,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token is invalid, clear auth state
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Session expired. Please log in again.',
          });
        }
      },
      rehydrateUser: async () => {
        const { token, user } = get();
        if (token && !user) {
          set({ isLoading: true });
          try {
            const apiClient = new ApiClient(token);
            const userProfile = await apiClient.getProfile() as User;
            set({ user: userProfile, isAuthenticated: true, isLoading: false });
          } catch {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: AuthState) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        playmat_texture: state.playmat_texture,
        userSettings: state.userSettings,
      }),
      migrate: (persistedState: any, version: number) => {
        // Remove any legacy 'auth_token' from localStorage on hydration
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        return persistedState;
      },
    }
  )
);
