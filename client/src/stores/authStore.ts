import create from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

interface User {
  _id: string;
  name: string;
  email: string;
  currency: string;
  monthlyIncome: number;
  savingsGoal: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  clearError: () => void;
}

// API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login user
      login: async (email, password) => {
        try {
          set({ isLoading: true, error: null });

          const res = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
          }, {
            withCredentials: true
          });

          if (res.data.success) {
            set({
              token: res.data.token,
              isAuthenticated: true,
              isLoading: false
            });

            // Load user data immediately after login
            await get().loadUser();
          }
        } catch (err: any) {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: err.response?.data?.message || 'Login failed'
          });
        }
      },

      // Register user
      register: async (name, email, password) => {
        try {
          set({ isLoading: true, error: null });

          const res = await axios.post(`${API_URL}/auth/register`, {
            name,
            email,
            password
          }, {
            withCredentials: true
          });

          if (res.data.success && res.data.token) {
            set({
              token: res.data.token,
              isAuthenticated: true,
              isLoading: false
            });

            // Load user data
            await get().loadUser();
          }
        } catch (err: any) {
          set({
            isLoading: false,
            error: err.response?.data?.message || 'Registration failed'
          });
        }
      },

      // Logout user
      logout: async () => {
        try {
          await axios.get(`${API_URL}/auth/logout`, {
            withCredentials: true
          });
        } catch (err) {
          console.error('Logout error:', err);
        }
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      },

      // Load user data
      loadUser: async () => {
        try {
          set({ isLoading: true });

          const res = await axios.get(`${API_URL}/auth/me`, {
            withCredentials: true
          });

          if (res.data.success) {
            set({
              user: res.data.data,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          }
        } catch (err) {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Authentication failed'
          });
          throw err; // Propagate the error
        }
      },

      // Update user data
      updateUser: async (userData) => {
        try {
          set({ isLoading: true, error: null });

          const res = await axios.put(`${API_URL}/users/me`, userData, {
            withCredentials: true
          });

          if (res.data.success) {
            set({
              user: { ...get().user, ...res.data.data } as User,
              isLoading: false
            });
          }
        } catch (err: any) {
          set({
            isLoading: false,
            error: err.response?.data?.message || 'Update failed'
          });
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token })
    }
  )
); 