import { create } from 'zustand';
import api from '../services/api';

interface Budget {
  _id?: string;
  category: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  notes?: string;
}

interface BudgetState {
  budgets: Budget[];
  isLoading: boolean;
  error: string | null;
  getBudgets: () => Promise<void>;
  addBudget: (budget: Omit<Budget, '_id' | 'isActive'>) => Promise<void>;
  updateBudget: (id: string, budget: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  clearError: () => void;
}

// Requests go through the shared axios instance

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  isLoading: false,
  error: null,

  getBudgets: async () => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await api.get('/budgets');
      set({ budgets: data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  addBudget: async (budget) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await api.post('/budgets', { ...budget, isActive: true });
      set((state) => ({
        budgets: [...state.budgets, data.data],
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  updateBudget: async (id, budget) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await api.put(`/budgets/${id}`, budget);
      set((state) => ({
        budgets: state.budgets.map((b) => 
          b._id === id ? { ...b, ...data.data } : b
        ),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  deleteBudget: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await api.delete(`/budgets/${id}`);

      set((state) => ({
        budgets: state.budgets.filter((b) => b._id !== id),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  clearError: () => set({ error: null })
})); 