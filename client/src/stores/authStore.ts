import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

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
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
}

// Using shared axios instance configured in services/api

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
          
          console.log(`Attempting login to: /auth/login`);
          
          const response = await api.post('/auth/login', { email, password });
          
          console.log('Login response:', response.data);
          
          if (response.data.success && response.data.token) {
            // Store token in localStorage
            localStorage.setItem('auth-token', response.data.token);
            
            set({
              token: response.data.token,
              isAuthenticated: true,
              isLoading: false
            });
            
            // Load user data
            await get().loadUser();
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          console.error('Login error:', error.response?.data || error.message);
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.response?.data?.message || 'Login failed. Please check your credentials.'
          });
          throw error;
        }
      },

      // Register user
      register: async (name, email, password) => {
        try {
          set({ isLoading: true, error: null });
          
          console.log(`Attempting registration to: /auth/register`);
          
          const response = await api.post('/auth/register', { name, email, password });
          
          console.log('Registration response:', response.data);
          
          if (response.data.success && response.data.token) {
            // Store token in localStorage
            localStorage.setItem('auth-token', response.data.token);
            
            set({
              token: response.data.token,
              isAuthenticated: true,
              isLoading: false
            });
            
            // Load user data
            await get().loadUser();
          } else {
            throw new Error('Registration failed');
          }
        } catch (err: any) {
          console.error('Registration error:', err.response?.data || err.message);
          set({
            isLoading: false,
            error: err.response?.data?.message || 'Registration failed. Please try again.'
          });
          throw err;
        }
      },

      // Logout user
      logout: () => {
        // Remove token from localStorage
        localStorage.removeItem('auth-token');
        
        // Try to call logout endpoint (but don't wait for it)
        api.get('/auth/logout')
          .catch(err => console.error('Logout error:', err));
        
        // Reset state
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
        const token = localStorage.getItem('auth-token');
        
        if (!token) {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
          return;
        }
        
        try {
          set({ isLoading: true });
          
          const response = await api.get('/auth/me');
          
          if (response.data.success && response.data.data) {
            set({
              user: response.data.data,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } else {
            throw new Error('Failed to load user data');
          }
        } catch (err: any) {
          console.error('Load user error:', err.response?.data || err.message);
          
          // Remove token from localStorage
          localStorage.removeItem('auth-token');
          
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Authentication failed. Please login again.'
          });
        }
      },

      // Update user data
      updateUser: async (userData) => {
        const token = localStorage.getItem('auth-token');
        
        if (!token) {
          set({ error: 'Authentication required' });
          return;
        }
        
        try {
          set({ isLoading: true, error: null });
          
          const response = await api.put('/auth/me', userData);
          
          if (response.data.success && response.data.data) {
            set({
              user: { ...get().user, ...response.data.data } as User,
              isLoading: false
            });
          } else {
            throw new Error('Failed to update user data');
          }
        } catch (err: any) {
          console.error('Update user error:', err.response?.data || err.message);
          set({
            isLoading: false,
            error: err.response?.data?.message || 'Update failed. Please try again.'
          });
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Change password
      changePassword: async (currentPassword: string, newPassword: string) => {
        try {
          set({ isLoading: true, error: null });
          const response = await api.post('/users/password', { currentPassword, newPassword });
          if (!response.data?.success) {
            throw new Error('Password change failed');
          }
          set({ isLoading: false });
        } catch (err: any) {
          set({
            isLoading: false,
            error: err.response?.data?.message || 'Password change failed. Please try again.'
          });
          throw err;
        }
      }
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({ token: state.token }),
    }
  )
); 