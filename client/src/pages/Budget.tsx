import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { useBudgetStore } from '../stores/budgetStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useCategoryStore } from '../stores/categoryStore';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../lib/currency';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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

export const BudgetPage: React.FC = () => {
  const { budgets, error, getBudgets, addBudget, updateBudget, deleteBudget } = useBudgetStore();
  const { transactions, getTransactions } = useTransactionStore();
  const { categories, getCategories } = useCategoryStore();
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<BudgetFormData>({
    category: '',
    amount: 0,
    period: 'monthly',
    notes: ''
  });
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const budgetVsActualChartRef = useRef<HTMLCanvasElement>(null);
  const budgetVsActualChartInstance = useRef<ChartJS | null>(null);

  useEffect(() => {
    getBudgets();
    getCategories();
    getTransactions();
  }, [getBudgets, getCategories, getTransactions]);

  const getCategoryName = useCallback(
    (category: string | BudgetCategory) => {
      if (!category) return 'Uncategorized';
      if (typeof category === 'string') {
        const foundCategory = categories?.find((c) => c._id === category);
        return foundCategory ? foundCategory.name : category;
      }
      return category.name || 'Uncategorized';
    },
    [categories]
  );

  const calculateSpentAmount = useCallback(
    (
      categoryId: string,
      period: 'weekly' | 'monthly' | 'yearly' = 'monthly',
      categoryName?: string
    ) => {
      if (!transactions || transactions.length === 0) return 0;

      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (period === 'weekly') {
        const day = now.getDay();
        const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.getFullYear(), now.getMonth(), diffToMonday, 0, 0, 0, 0);
        endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      } else if (period === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      return transactions
        .filter((t) => {
          if (!t || t.type !== 'expense') return false;
          const txDate = new Date(t.date || t.createdAt);
          if (txDate < startDate || txDate > endDate) return false;

          const txCatId = typeof t.category === 'object' ? t.category?._id : t.category;
          const txCatName =
            typeof t.category === 'object'
              ? t.category?.name
              : typeof t.category === 'string'
              ? t.category
              : undefined;

          const idMatch = txCatId && categoryId && String(txCatId) === String(categoryId);
          const nameMatch =
            txCatName && categoryName && txCatName.toLowerCase() === categoryName.toLowerCase();

          return Boolean(idMatch || nameMatch);
        })
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    },
    [transactions]
  );

  const totalBudget = useMemo(() => {
    return budgets?.reduce((sum, b) => sum + b.amount, 0) || 0;
  }, [budgets]);

  const totalSpent = useMemo(() => {
    return (
      budgets?.reduce((sum, b) => {
        const catId = typeof b.category === 'string' ? b.category : (b.category as BudgetCategory)?._id;
        return sum + calculateSpentAmount(catId, b.period, getCategoryName(b.category));
      }, 0) || 0
    );
  }, [budgets, calculateSpentAmount, getCategoryName]);

  const totalRemaining = totalBudget - totalSpent;
  const overallProgress =
    totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  // Process enriched categories with spent and percentage
  const enrichedBudgets = useMemo(() => {
    if (!budgets) return [];
    return budgets.map((b) => {
      const catId = typeof b.category === 'string' ? b.category : (b.category as BudgetCategory)?._id;
      const catName = getCategoryName(b.category);
      const spent = calculateSpentAmount(catId, b.period, catName);
      const remaining = b.amount - spent;
      const percentage = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      return { ...b, catName, catId, spent, remaining, percentage };
    });
  }, [budgets, calculateSpentAmount, getCategoryName]);

  // Top over budget / highest utilized
  const topOverBudget = useMemo(() => {
    return [...enrichedBudgets].sort((a, b) => b.percentage - a.percentage).slice(0, 4);
  }, [enrichedBudgets]);

  // Render Budget vs Actual Grouped Bar Chart (Monochrome black & light gray)
  useEffect(() => {
    if (!enrichedBudgets || enrichedBudgets.length === 0) return;

    if (budgetVsActualChartRef.current) {
      if (budgetVsActualChartInstance.current) budgetVsActualChartInstance.current.destroy();
      const ctx = budgetVsActualChartRef.current.getContext('2d');
      if (ctx) {
        const labels = enrichedBudgets.map((b) => b.catName);
        const budgetedData = enrichedBudgets.map((b) => b.amount);
        const actualData = enrichedBudgets.map((b) => b.spent);

        budgetVsActualChartInstance.current = new ChartJS(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Budget',
                data: budgetedData,
                backgroundColor: '#0A0A0A',
                borderRadius: 3,
                barPercentage: 0.5,
                categoryPercentage: 0.65
              },
              {
                label: 'Actual',
                data: actualData,
                backgroundColor: '#A3A3A3',
                borderRadius: 3,
                barPercentage: 0.5,
                categoryPercentage: 0.65
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                align: 'end',
                labels: {
                  color: '#737373',
                  usePointStyle: true,
                  boxWidth: 8,
                  padding: 15,
                  font: { family: 'Plus Jakarta Sans', size: 11 }
                }
              },
              tooltip: {
                backgroundColor: '#0A0A0A',
                titleColor: '#FFFFFF',
                bodyColor: '#FFFFFF',
                padding: 8,
                cornerRadius: 6,
                callbacks: {
                  label: (c) => ` ${c.dataset.label}: ${formatCurrency(Number(c.raw), currency)}`
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#737373', font: { family: 'Plus Jakarta Sans', size: 10 } }
              },
              y: {
                grid: { color: '#F4F4F2' },
                ticks: {
                  color: '#737373',
                  font: { family: 'Plus Jakarta Sans', size: 10 },
                  callback: (v) => formatCurrency(Number(v), currency, 0)
                }
              }
            }
          }
        });
      }
    }
  }, [enrichedBudgets, currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const categoryValue = isCustomCategory ? customCategory.trim() : formData.category;
    if (!categoryValue) return;
    const payload = { ...formData, category: categoryValue };
    if (isEditing) {
      await updateBudget(isEditing, payload);
      setIsEditing(null);
    } else {
      await addBudget(payload);
      setShowAddForm(false);
    }
    setFormData({ category: '', amount: 0, period: 'monthly', notes: '' });
    setIsCustomCategory(false);
    setCustomCategory('');
  };

  const handleEdit = (budget: Budget) => {
    const catId = typeof budget.category === 'string' ? budget.category : budget.category._id;
    const isCustom = !categories?.some((c) => c._id === catId);
    setFormData({
      category: isCustom ? '' : catId,
      amount: budget.amount,
      period: budget.period,
      notes: budget.notes || ''
    });
    setIsCustomCategory(isCustom);
    setCustomCategory(isCustom ? catId : '');
    setIsEditing(budget._id || null);
    setShowAddForm(true);
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (window.confirm('Are you sure you want to delete this budget?')) {
      await deleteBudget(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">Budget</h1>
          <p className="text-xs sm:text-sm text-[#737373] mt-0.5">
            Track how your planned spending compares with reality.
          </p>
        </div>

        <button
          onClick={() => {
            setIsEditing(null);
            setFormData({ category: '', amount: 0, period: 'monthly', notes: '' });
            setIsCustomCategory(false);
            setCustomCategory('');
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#0A0A0A] hover:bg-[#262626] text-white font-semibold rounded-lg text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add Budget</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 2. Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5">
          <p className="text-xs font-medium text-[#737373] mb-1">Total Budgeted</p>
          <p className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
            {formatCurrency(totalBudget, currency)}
          </p>
        </div>

        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5">
          <p className="text-xs font-medium text-[#737373] mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-[#DC2626] tabular-nums">
            {formatCurrency(totalSpent, currency)}
          </p>
        </div>

        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5">
          <p className="text-xs font-medium text-[#737373] mb-1">Total Remaining</p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              totalRemaining >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
            }`}
          >
            {formatCurrency(totalRemaining, currency)}
          </p>
        </div>
      </div>

      {/* 3. Mid Section: Budget Overview (1/3) + Category Budget Cards (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget Overview Card */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-[#0A0A0A]">Budget Overview</h2>
              <span className="text-xs text-[#737373]">This Month</span>
            </div>

            {/* Clean Minimalist Radial Meter */}
            <div className="relative w-44 h-44 mx-auto my-4 flex items-center justify-center">
              <svg className="w-44 h-44 transform -rotate-90">
                <circle cx="88" cy="88" r="72" stroke="#F4F4F2" strokeWidth="12" fill="transparent" />
                <circle
                  cx="88"
                  cy="88"
                  r="72"
                  stroke={overallProgress >= 100 ? '#DC2626' : overallProgress >= 80 ? '#D97706' : '#0A0A0A'}
                  strokeWidth="12"
                  strokeDasharray="452"
                  strokeDashoffset={452 - (452 * Math.min(100, overallProgress)) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-[#0A0A0A] tabular-nums">
                  {formatCurrency(totalBudget, currency, 0)}
                </span>
                <span className="text-[11px] text-[#737373] font-medium">Total Budget</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-[#E5E5E3] text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Spent</span>
              <span className="font-bold text-[#DC2626] tabular-nums">
                {formatCurrency(totalSpent, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Remaining</span>
              <span
                className={`font-bold tabular-nums ${
                  totalRemaining >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                }`}
              >
                {formatCurrency(totalRemaining, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#737373]">Overall Percentage</span>
              <span className="font-bold text-[#0A0A0A] tabular-nums">{overallProgress}%</span>
            </div>
          </div>
        </div>

        {/* Category Budget Cards Grid */}
        <div className="lg:col-span-2">
          {enrichedBudgets.length === 0 ? (
            <div className="h-full bg-white border border-[#E5E5E3] rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-[#F4F4F2] text-[#0A0A0A] flex items-center justify-center mb-3">
                <PlusIcon className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-[#0A0A0A]">No active budgets found</p>
              <p className="text-xs text-[#737373] mt-1 max-w-sm">
                Create category budgets to track and control your spending limits.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrichedBudgets.map((budget) => {
                const isOver = budget.percentage >= 100;
                const isWarning = budget.percentage >= 80 && !isOver;

                return (
                  <div
                    key={budget._id}
                    className="bg-white border border-[#E5E5E3] rounded-xl p-4 flex flex-col justify-between hover:border-[#D4D4D0] transition-colors"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between mb-2.5">
                        <div className="min-w-0 pr-2">
                          <h3 className="text-xs font-bold text-[#0A0A0A] truncate">{budget.catName}</h3>
                          <span className="text-[10px] text-[#737373] uppercase tracking-wider">
                            {budget.period}
                          </span>
                        </div>

                        <span
                          className={`text-xs font-bold tabular-nums ${
                            isOver ? 'text-[#DC2626]' : isWarning ? 'text-[#D97706]' : 'text-[#0A0A0A]'
                          }`}
                        >
                          {budget.percentage}% used
                        </span>
                      </div>

                      {/* Clean Linear Progress Bar */}
                      <div className="h-1.5 w-full bg-[#F4F4F2] rounded-full overflow-hidden my-3">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOver
                              ? 'bg-[#DC2626]'
                              : isWarning
                              ? 'bg-[#D97706]'
                              : 'bg-[#0A0A0A]'
                          }`}
                          style={{ width: `${Math.min(100, budget.percentage)}%` }}
                        />
                      </div>

                      {/* Amounts */}
                      <div className="space-y-1 text-xs tabular-nums mt-2">
                        <div className="flex justify-between text-[#737373]">
                          <span>Budget</span>
                          <span className="font-semibold text-[#0A0A0A]">
                            {formatCurrency(budget.amount, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#737373]">
                          <span>Spent</span>
                          <span className="font-semibold text-[#DC2626]">
                            {formatCurrency(budget.spent, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#737373]">
                          <span>Remaining</span>
                          <span
                            className={`font-semibold ${
                              budget.remaining >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                            }`}
                          >
                            {formatCurrency(budget.remaining, currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-[#E5E5E3]">
                      <button
                        onClick={() => handleEdit(budget)}
                        className="p-1 rounded text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F4F4F2] transition-colors"
                        title="Edit budget"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(budget._id)}
                        className="p-1 rounded text-[#737373] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                        title="Delete budget"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Section: Budget vs Actual (2/3) + Top Over Budget Alerts (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget vs Actual Chart */}
        <div className="lg:col-span-2 bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0A0A0A]">Budget vs Actual</h2>
              <p className="text-xs text-[#737373]">Planned budget limits compared to real outlays</p>
            </div>
          </div>
          <div className="h-64 w-full relative">
            <canvas ref={budgetVsActualChartRef} />
          </div>
        </div>

        {/* Budget Risk / Top Over Budget */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-[#0A0A0A]">Budget Risk</h2>
              <span className="text-xs text-[#737373]">Highest Used</span>
            </div>
            <p className="text-xs text-[#737373] mb-4">
              Categories approaching or exceeding limits
            </p>

            <div className="space-y-4">
              {topOverBudget.length === 0 ? (
                <p className="text-xs text-[#737373] text-center py-6">No budget data available.</p>
              ) : (
                topOverBudget.map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#0A0A0A] truncate">{item.catName}</span>
                      <span
                        className={`font-bold tabular-nums ${
                          item.percentage >= 100 ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                        }`}
                      >
                        {item.percentage}% used
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#F4F4F2] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.percentage >= 100
                            ? 'bg-[#DC2626]'
                            : item.percentage >= 80
                            ? 'bg-[#D97706]'
                            : 'bg-[#0A0A0A]'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Add/Edit Budget Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-[#E5E5E3] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E3]">
              <h3 className="text-base font-bold text-[#0A0A0A]">
                {isEditing ? 'Edit Budget' : 'Add New Budget'}
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 rounded-lg text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F4F4F2]"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
                  Category
                </label>
                <select
                  value={isCustomCategory ? '__other__' : formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__other__') {
                      setIsCustomCategory(true);
                      setFormData({ ...formData, category: '' });
                    } else {
                      setIsCustomCategory(false);
                      setFormData({ ...formData, category: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                  required={!isCustomCategory}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="__other__">Other (Custom Category)…</option>
                </select>

                {isCustomCategory && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="e.g. Travel, Electronics"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A]"
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
                  Budget Amount ({currency})
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs text-[#0A0A0A] tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
                  Period
                </label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Budget context"
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs text-[#0A0A0A] placeholder-[#A1A1AA] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E5E3]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-[#E5E5E3] text-xs font-medium text-[#737373] hover:text-[#0A0A0A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#0A0A0A] hover:bg-[#262626] text-white font-semibold text-xs transition-colors shadow-sm"
                >
                  {isEditing ? 'Update Budget' : 'Create Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetPage;