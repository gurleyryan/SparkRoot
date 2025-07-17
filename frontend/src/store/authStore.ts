import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';
import { ApiClient } from '../lib/api';

import type { UserSettings } from '@/types';
interface AuthState {
  user: User | null;
  // Removed: token (now handled via HttpOnly cookie)
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  playmat_texture: string | null;
  userSettings: UserSettings | null;
  // Actions
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  rehydrateUser: () => Promise<void>;
  setPlaymatTexture: (texture: string) => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },
      user: null,
      // Removed: token
      isAuthenticated: false,
      isLoading: false,
      error: null,
      playmat_texture: null,
      userSettings: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          await apiClient.login(credentials);
          // After login, backend sets HttpOnly cookie. Fetch user profile.
          const profileClient = new ApiClient();
          const userProfile = await profileClient.getProfile() as User;
          // Fetch user settings
          let userSettings: UserSettings | null = null;
          try {
            const settingsResp = await profileClient.getSettings() as { success: boolean; settings?: UserSettings };
            if (settingsResp && settingsResp.success && settingsResp.settings) {
              userSettings = settingsResp.settings;
            }
          } catch {
            // Handle error silently
          }
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
            } catch {
              // Error fetching playmat textures
            }
            if (mats.length > 0) {
              playmat_texture = mats[Math.floor(Math.random() * mats.length)];
              // Persist to backend
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
            // Removed: token
            playmat_texture: null,
            userSettings: null,
          });
          throw new Error('Login failed');
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
        } catch {
          // Error updating playmat texture
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
          // Removed: token
          isAuthenticated: false,
          error: null,
        });
        // No localStorage cleanup needed
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
          set({ isLoading: true });
          try {
            const apiClient = new ApiClient();
            const userProfile = await apiClient.getProfile() as User;
            set({ user: userProfile, isAuthenticated: true, isLoading: false });
          } catch {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state: AuthState) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        playmat_texture: state.playmat_texture,
        userSettings: state.userSettings,
      }),
      migrate: (persistedState: unknown) => {
        // No localStorage cleanup needed
        return persistedState as Partial<AuthState>;
      }
    }
  )
);
