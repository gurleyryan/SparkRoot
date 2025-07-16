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
        console.log('authStore login called with:', credentials);
        set({ isLoading: true, error: null });
        try {
          const apiClient = new ApiClient();
          const loginResp = await apiClient.login(credentials);
          console.log('authStore login response:', loginResp);
          const { access_token } = loginResp as { access_token: string; token_type: string };
          if (!access_token) {
            throw new Error('No access_token in login response');
          }
          // Get user profile with the new token
          const profileClient = new ApiClient(access_token);
          const userProfile = await profileClient.getProfile() as User;
          console.log('authStore userProfile:', userProfile);
          set({
            user: userProfile,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          if (typeof window !== 'undefined') {
            console.log('auth-storage in localStorage after login:', localStorage.getItem('auth-storage'));
          }
        } catch (e) {
          console.error('authStore login failed:', e);
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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
