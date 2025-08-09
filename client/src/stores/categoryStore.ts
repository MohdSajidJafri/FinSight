import { create } from 'zustand';
import api from '../services/api';

interface Category {
  _id?: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  getCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, '_id'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  clearError: () => void;
}

// Using shared axios instance

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  getCategories: async () => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await api.get('/categories');
      set({ categories: data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  addCategory: async (category) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await api.post('/categories', category);
      set((state) => ({
        categories: [...state.categories, data.data],
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  updateCategory: async (id, category) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await api.put(`/categories/${id}`, category);
      set((state) => ({
        categories: state.categories.map((c) => 
          c._id === id ? { ...c, ...data.data } : c
        ),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  deleteCategory: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await api.delete(`/categories/${id}`);

      set((state) => ({
        categories: state.categories.filter((c) => c._id !== id),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  clearError: () => set({ error: null })
})); 