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

// API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configure axios defaults
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

          console.log('Attempting login to:', `${API_URL}/auth/login`);
          const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
          }, {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json'
            }
          });

          console.log('Login response:', response.data);

          if (response.data.success) {
            set({
              token: response.data.token,
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false
            });

            // Store token in localStorage
            localStorage.setItem('token', response.data.token);

            // Load user data immediately after login
            await get().loadUser();
          }
        } catch (error: any) {
          console.error('Login error:', error.response?.data || error.message);
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error.response?.data?.message || 'Login failed'
          });
          throw error;
        }
      },

      // Register user
      register: async (name, email, password) => {
        try {
          set({ isLoading: true, error: null });

          console.log('Attempting registration to:', `${API_URL}/auth/register`);
          const res = await axios.post(`${API_URL}/auth/register`, {
            name,
            email,
            password
          }, {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json'
            }
          });

          console.log('Registration response:', res.data);

          if (res.data.success && res.data.token) {
            // Store token in localStorage
            localStorage.setItem('token', res.data.token);
            
            set({
              token: res.data.token,
              isAuthenticated: true,
              isLoading: false
            });

            // Load user data
            await get().loadUser();
          }
        } catch (err: any) {
          console.error('Registration error:', err.response?.data || err.message);
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
        
        // Remove token from localStorage
        localStorage.removeItem('token');
        
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

          // Get token from localStorage
          const token = localStorage.getItem('token');
          
          if (!token) {
            throw new Error('No token found');
          }

          const res = await axios.get(`${API_URL}/auth/me`, {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${token}`
            }
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
          console.error('Load user error:', err);
          // Remove token from localStorage
          localStorage.removeItem('token');
          
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

          const token = localStorage.getItem('token');
          
          const res = await axios.put(`${API_URL}/users/me`, userData, {
            withCredentials: true,
            headers: {
              Authorization: `Bearer ${token}`
            }
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
      getStorage: () => localStorage,
    }
  )
); 