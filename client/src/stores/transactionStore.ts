import { create } from 'zustand';
import api from '../services/api';

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
  deleteTransaction: (id: string) => Promise<void>;
  clearError: () => void;
}

// API base is configured in the shared axios instance

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,

  // Add transaction
  addTransaction: async (transaction) => {
    try {
      set({ isLoading: true, error: null });

      const res = await api.post('/transactions', transaction);

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

      const res = await api.get('/transactions');

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

  // Delete transaction
  deleteTransaction: async (id: string) => {
    try {
      set({ isLoading: true, error: null });

      await api.delete(`/transactions/${id}`);

      set((state) => ({
        transactions: state.transactions.filter((t) => t._id !== id),
        isLoading: false
      }));
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || 'Failed to delete transaction'
      });
      throw err;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  }
})); 