import React, { useEffect, useState } from 'react';
import { useBudgetStore } from '../stores/budgetStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useCategoryStore } from '../stores/categoryStore';

interface Category {
  _id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

interface BudgetCategory extends Category {
  _id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Budget {
  _id?: string;
  category: string | BudgetCategory;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  notes?: string;
}

interface BudgetFormData {
  category: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  notes?: string;
}

const BudgetPage: React.FC = () => {
  const { budgets, isLoading, error, getBudgets, addBudget, updateBudget, deleteBudget } = useBudgetStore();
  const { transactions, getTransactions } = useTransactionStore();
  const { categories, getCategories } = useCategoryStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<BudgetFormData>({
    category: '',
    amount: 0,
    period: 'monthly',
    notes: ''
  });

  useEffect(() => {
    getBudgets();
    getCategories();
    getTransactions();
  }, [getBudgets, getCategories, getTransactions]);

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      getBudgets();
    }
  }, [transactions, getBudgets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      await updateBudget(isEditing, formData);
      setIsEditing(null);
    } else {
      await addBudget(formData);
      setShowAddForm(false);
    }
    setFormData({ category: '', amount: 0, period: 'monthly', notes: '' });
  };

  const handleEdit = (budget: Budget) => {
    setFormData({
      category: typeof budget.category === 'string' ? budget.category : budget.category._id,
      amount: budget.amount,
      period: budget.period,
      notes: budget.notes || ''
    });
    setIsEditing(budget._id || null);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    if (window.confirm('Are you sure you want to delete this budget?')) {
      await deleteBudget(id);
    }
  };

  const calculateSpentAmount = (categoryId: string) => {
    if (!transactions) return 0;
    return transactions
      .filter(t => {
        if (!t || !t.category || typeof t.category !== 'object') return false;
        const tCategory = t.category as { _id: string };
        return tCategory._id === categoryId && t.type === 'expense';
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getCategoryName = (category: string | BudgetCategory) => {
    if (!categories) return 'Unknown Category';
    if (typeof category === 'string') {
      const foundCategory = categories.find(c => c._id === category);
      return foundCategory ? foundCategory.name : 'Unknown Category';
    }
    return category.name || 'Unknown Category';
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Budget Management</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          Add Budget
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <div className="mt-1 flex gap-2">
                <select
                  id="categorySelect"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select a category or type below</option>
                  {categories && categories
                    .filter(c => c && c.type === 'expense')
                    .map((category) => (
                      category && category._id ? (
                        <option key={category._id} value={category._id}>
                          {category.name || 'Unnamed Category'}
                        </option>
                      ) : null
                    ))}
                </select>
                <input
                  type="text"
                  id="customCategory"
                  placeholder="Or type custom category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount
              </label>
              <input
                type="number"
                id="amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label htmlFor="period" className="block text-sm font-medium text-gray-700">
                Period
              </label>
              <select
                id="period"
                value={formData.period}
                onChange={(e) => setFormData({ ...formData, period: e.target.value as 'weekly' | 'monthly' | 'yearly' })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setIsEditing(null);
                  setFormData({ category: '', amount: 0, period: 'monthly', notes: '' });
                }}
                className="bg-white text-gray-700 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                {isEditing ? 'Update' : 'Add'} Budget
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets && budgets.map((budget) => {
          if (!budget || !budget.category) return null;

          try {
            const categoryId = typeof budget.category === 'string' 
              ? budget.category 
              : (budget.category as BudgetCategory)._id;

            if (!categoryId) return null;

            const spentAmount = calculateSpentAmount(categoryId);
            const remainingAmount = budget.amount - spentAmount;
            const percentageUsed = (spentAmount / budget.amount) * 100;

            return (
              <div key={budget._id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{getCategoryName(budget.category)}</h2>
                    <p className="text-sm text-gray-500 capitalize">{budget.period}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(budget._id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Budget</span>
                    <span className="font-medium">${budget.amount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Spent</span>
                    <span className="font-medium">${spentAmount.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Remaining</span>
                    <span className={`font-medium ${remainingAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${remainingAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${
                          percentageUsed >= 90
                            ? 'bg-red-600'
                            : percentageUsed >= 75
                            ? 'bg-yellow-600'
                            : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-right">
                      {percentageUsed.toFixed(1)}% used
                    </p>
                  </div>

                  {budget.notes && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">{budget.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          } catch (error) {
            console.error('Error rendering budget:', error);
            return null;
          }
        })}
      </div>
    </div>
  );
};

export default BudgetPage; 