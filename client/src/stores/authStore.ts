import { create } from 'zustand';
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

// API URL - remove /api suffix as it's handled by the backend routes
const BASE_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// Configure axios defaults for all requests
axios.defaults.withCredentials = true;

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
          
          console.log(`Attempting login to: ${API_URL}/auth/login`);
          
          const response = await axios.post(
            `${API_URL}/auth/login`, 
            { email, password },
            { 
              headers: { 'Content-Type': 'application/json' },
              withCredentials: true 
            }
          );
          
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
          
          console.log(`Attempting registration to: ${API_URL}/auth/register`);
          
          const response = await axios.post(
            `${API_URL}/auth/register`, 
            { name, email, password },
            { 
              headers: { 'Content-Type': 'application/json' },
              withCredentials: true 
            }
          );
          
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
        axios.get(`${API_URL}/auth/logout`, { withCredentials: true })
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
          
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            withCredentials: true
          });
          
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
          
          const response = await axios.put(`${API_URL}/users/me`, userData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            withCredentials: true
          });
          
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
      }
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({ token: state.token }),
    }
  )
); 