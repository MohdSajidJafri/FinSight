import { create } from 'zustand';
import axios from 'axios';

interface Category {
  _id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface Transaction {
  _id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: Category;
  date: string;
  user: string;
  createdAt: string;
}

interface TransactionInput {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
}

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  addTransaction: (transaction: TransactionInput) => Promise<void>;
  getTransactions: () => Promise<void>;
  clearError: () => void;
}

// API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,

  // Add transaction
  addTransaction: async (transaction) => {
    try {
      set({ isLoading: true, error: null });

      const token = localStorage.getItem('auth-token');
      const res = await axios.post(`${API_URL}/transactions`, transaction, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });

      if (res.data.success) {
        set((state) => ({
          transactions: [...state.transactions, res.data.data],
          isLoading: false
        }));
      }
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || 'Failed to add transaction'
      });
      throw err;
    }
  },

  // Get transactions
  getTransactions: async () => {
    try {
      set({ isLoading: true, error: null });

      const token = localStorage.getItem('auth-token');
      const res = await axios.get(`${API_URL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });

      if (res.data.success) {
        set({
          transactions: res.data.data,
          isLoading: false
        });
      }
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || 'Failed to fetch transactions'
      });
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  }
})); 