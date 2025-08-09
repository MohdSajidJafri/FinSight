import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactionStore } from '../stores/transactionStore';
import { useCategoryStore } from '../stores/categoryStore';

interface TransactionInput {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string; // ID or custom category string
  date: string;
}

const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const { addTransaction, getTransactions, error, clearError } = useTransactionStore();
  const { categories, getCategories } = useCategoryStore();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  // Only expense transactions are allowed
  const type: 'income' | 'expense' = 'expense';
  const [category, setCategory] = useState('');
  const [isOther, setIsOther] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    getCategories();
  }, [getCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    try {
      const chosenCategory = isOther ? customCategory.trim() : category;
      if (!chosenCategory) {
        setLocalError('Please select a category or enter a custom category');
        return;
      }
      const transactionData: TransactionInput = {
        description,
        amount: parseFloat(amount),
        type,
        category: chosenCategory,
        date
      };
      await addTransaction(transactionData);
      await getTransactions(); // Refresh transactions data
      navigate('/transactions');
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const filteredCategories = categories.filter(cat => cat.type === 'expense');

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add Expense</h1>

      {(error || localError) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error || localError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <div className="mt-1">
            <select
              id="categorySelect"
              value={isOther ? '__other__' : category}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__other__') {
                  setIsOther(true);
                  setCategory('');
                } else {
                  setIsOther(false);
                  setCategory(value);
                }
              }}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Select a category</option>
              {filteredCategories.map((cat) => (
                <option key={cat._id} value={cat._id} style={{ color: cat.color }}>
                  {cat.name}
                </option>
              ))}
              <option value="__other__">Other…</option>
            </select>
          </div>
          {isOther && (
            <div className="mt-2">
              <label htmlFor="customCategory" className="block text-sm font-medium text-gray-700">
                Enter custom category
              </label>
              <input
                type="text"
                id="customCategory"
                placeholder="e.g., Gift, Repair, etc."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <input
            type="text"
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
            min="0"
            step="0.01"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="bg-white text-gray-700 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Add Transaction
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTransaction; 