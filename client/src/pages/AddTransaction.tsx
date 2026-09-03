import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactionStore } from '../stores/transactionStore';
import { useCategoryStore } from '../stores/categoryStore';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface TransactionInput {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
}

export const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const { addTransaction, getTransactions, error, clearError } = useTransactionStore();
  const { categories, getCategories } = useCategoryStore();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [isOther, setIsOther] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getCategories();
  }, [getCategories]);

  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    setCategory('');
    setIsOther(false);
    setCustomCategory('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setLocalError('Please enter a valid amount greater than 0');
      return;
    }

    const chosenCategory = isOther ? customCategory.trim() : category;
    if (!chosenCategory) {
      setLocalError('Please select or specify a category');
      return;
    }

    try {
      setIsSubmitting(true);
      const transactionData: TransactionInput = {
        description: description.trim(),
        amount: parsedAmount,
        type,
        category: chosenCategory,
        date
      };
      await addTransaction(transactionData);
      await getTransactions();
      navigate('/transactions');
    } catch (err: any) {
      console.error('Failed to add transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter((cat) => cat.type === type);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/transactions')}
        className="flex items-center gap-2 text-xs font-medium text-[#737373] hover:text-[#0A0A0A] transition-colors"
      >
        <ArrowLeftIcon className="w-3.5 h-3.5" />
        <span>Back to Transactions</span>
      </button>

      {/* Header & Segmented Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
            Add Transaction
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            Record a new financial entry in your ledger
          </p>
        </div>

        {/* Clean Segmented Control */}
        <div className="inline-flex rounded-lg bg-[#F4F4F2] p-1 border border-[#E5E5E3] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              type === 'expense'
                ? 'bg-white text-[#DC2626] shadow-sm'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              type === 'income'
                ? 'bg-white text-[#16A34A] shadow-sm'
                : 'text-[#737373] hover:text-[#0A0A0A]'
            }`}
          >
            Income
          </button>
        </div>
      </div>

      {(error || localError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs">
          {error || localError}
        </div>
      )}

      {/* Minimalist White Form Card */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-[#E5E5E3] p-6 sm:p-8 rounded-2xl shadow-sm">
        {/* Category */}
        <div>
          <label htmlFor="categorySelect" className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
            Category
          </label>
          <select
            id="categorySelect"
            value={isOther ? '__other__' : category}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__other__') {
                setIsOther(true);
                setCategory('');
              } else {
                setIsOther(false);
                setCategory(val);
              }
            }}
            className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            required={!isOther}
          >
            <option value="">Select a {type} category</option>
            {filteredCategories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
            <option value="__other__">Other (Custom Category)…</option>
          </select>

          {isOther && (
            <div className="mt-2.5">
              <input
                type="text"
                placeholder="e.g. Side Hustle, Consulting, Gym"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A]"
                required
              />
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
            Description
          </label>
          <input
            type="text"
            id="description"
            placeholder="e.g. Grocery shopping at Trader Joe's"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A]"
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
            Amount
          </label>
          <input
            type="number"
            id="amount"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] tabular-nums placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A]"
            required
            min="0.01"
            step="0.01"
          />
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
            Date
          </label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            required
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E5E3]">
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 rounded-lg bg-white border border-[#E5E5E3] text-xs font-medium text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F9F9F8] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-[#0A0A0A] hover:bg-[#262626] text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddTransaction;