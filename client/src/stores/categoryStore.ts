import create from 'zustand';

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

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  getCategories: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await fetch(`${API_URL}/categories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch categories');
      }

      const data = await response.json();
      set({ categories: data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false });
    }
  },

  addCategory: async (category) => {
    try {
      set({ isLoading: true, error: null });
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(category)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add category');
      }

      const data = await response.json();
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
      const response = await fetch(`${API_URL}/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(category)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update category');
      }

      const data = await response.json();
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
      const response = await fetch(`${API_URL}/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete category');
      }

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