import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';
import { ApiClient } from '../lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  rehydrateUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          const loginResp = await apiClient.login(credentials);
          const { access_token } = loginResp as { access_token: string; token_type: string };
          if (!access_token) {
            throw new Error('No access_token in login response');
          }
          // Get user profile with the new token
          const profileClient = new ApiClient(access_token);
          const userProfile = await profileClient.getProfile() as User;
          set({
            user: userProfile,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          // Remove any legacy 'auth_token' from localStorage
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
          });
          throw new Error('Login failed');
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
