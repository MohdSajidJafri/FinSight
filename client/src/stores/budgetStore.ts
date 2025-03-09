import create from 'zustand';

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

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  isLoading: false,
  error: null,

  getBudgets: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await fetch(`${API_URL}/budgets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch budgets');
      }

      const data = await response.json();
      set({ budgets: data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  addBudget: async (budget) => {
    try {
      set({ isLoading: true, error: null });
      const response = await fetch(`${API_URL}/budgets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ ...budget, isActive: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add budget');
      }

      const data = await response.json();
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
      const response = await fetch(`${API_URL}/budgets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(budget)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update budget');
      }

      const data = await response.json();
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
      const response = await fetch(`${API_URL}/budgets/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete budget');
      }

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