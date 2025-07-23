import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthState, SupportedLanguage } from '../types';
import apiService from '../services/api';

interface AuthStore extends AuthState {
  login: (credentials: { email_or_username: string; password: string }) => Promise<void>;
  logout: () => void;
  register: (userData: { username: string; email: string; password: string; confirm_password: string }) => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  setLanguage: (language: SupportedLanguage) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,

      login: async (credentials) => {
        try {
          const response = await apiService.login(credentials);
          localStorage.setItem('auth_token', response.token);
          set({
            isAuthenticated: true,
            user: response.user,
            token: response.token,
          });
        } catch (error) {
          console.error('Login failed:', error);
          throw error;
        }
      },

      register: async (userData) => {
        try {
          const response = await apiService.register(userData);
          localStorage.setItem('auth_token', response.token);
          set({
            isAuthenticated: true,
            user: response.user,
            token: response.token,
          });
        } catch (error) {
          console.error('Registration failed:', error);
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        set({
          isAuthenticated: false,
          user: null,
          token: null,
        });
        apiService.logout().catch(console.error);
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...updates },
          });
        }
      },

      setLanguage: (language) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            preferences: {
              ...currentUser.preferences,
              language,
              theme: currentUser.preferences?.theme || 'light' as 'light' | 'dark',
            },
          };
          set({ user: updatedUser });
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          try {
            const user = await apiService.getCurrentUser();
            set({
              isAuthenticated: true,
              user,
              token,
            });
          } catch (error: any) {
            console.error('Auth check failed:', error);
            
            // Si le token est invalide (401/403), se déconnecter
            if (error?.response?.status === 401 || error?.response?.status === 403) {
              localStorage.removeItem('auth_token');
              set({
                isAuthenticated: false,
                user: null,
                token: null,
              });
              throw new Error('Session expirée. Veuillez vous reconnecter.');
            }
            
            // Pour les autres erreurs (réseau, serveur), garder connecté temporairement
            // mais sans les infos utilisateur
            set({
              isAuthenticated: true,
              user: null,
              token,
            });
          }
        } else {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
    }
  )
);