import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTransactionStore } from '../stores/transactionStore';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ArrowsRightLeftIcon,
  TvIcon,
  ShoppingBagIcon,
  HomeModernIcon,
  BanknotesIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';

export const Transactions: React.FC = () => {
  const { transactions, getTransactions, deleteTransaction, isLoading, error } = useTransactionStore();
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';

  // Filters and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    getTransactions();
  }, [getTransactions]);

  // Extract unique categories for dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      const name =
        (t.category as any)?.name ||
        (typeof (t.category as any) === 'string' ? (t.category as any) : null);
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [transactions]);

  // Financial summary metrics
  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;
    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') income += amt;
      else expenses += amt;
    });
    return {
      income,
      expenses,
      net: income - expenses
    };
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const catName =
        (tx.category as any)?.name ||
        (typeof (tx.category as any) === 'string' ? (tx.category as any) : '');

      const matchesSearch =
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        catName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || tx.type === typeFilter;
      const matchesCategory =
        categoryFilter === 'all' || catName.toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [transactions, searchTerm, typeFilter, categoryFilter]);

  // Paginated transactions
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(id);
    }
  };

  const getCategoryIcon = (category: any) => {
    const name = typeof category === 'object' ? category?.name?.toLowerCase() || '' : String(category).toLowerCase();
    if (name.includes('stream') || name.includes('entertain') || name.includes('media')) return <TvIcon className="w-4 h-4 text-[#0A0A0A]" />;
    if (name.includes('shop') || name.includes('store') || name.includes('grocer')) return <ShoppingBagIcon className="w-4 h-4 text-[#0A0A0A]" />;
    if (name.includes('rent') || name.includes('house') || name.includes('home')) return <HomeModernIcon className="w-4 h-4 text-[#0A0A0A]" />;
    if (name.includes('salary') || name.includes('income') || name.includes('deposit')) return <BanknotesIcon className="w-4 h-4 text-[#0A0A0A]" />;
    return <CreditCardIcon className="w-4 h-4 text-[#0A0A0A]" />;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Primary Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
            Transactions
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] mt-0.5">
            Your income and expenses in one place.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/transactions/add"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0A0A0A] hover:bg-[#262626] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Transaction</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 2. Top Summary Cards (Editorial Minimalist White) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-medium">Income (This Month)</span>
            <ArrowDownLeftIcon className="w-4 h-4 text-[#16A34A]" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
            {formatCurrency(summary.income, currency)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-medium">Expenses (This Month)</span>
            <ArrowUpRightIcon className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
            {formatCurrency(summary.expenses, currency)}
          </div>
        </div>

        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#737373] mb-2">
            <span className="text-xs font-medium">Net Cash Flow</span>
            <ArrowsRightLeftIcon className="w-4 h-4 text-[#0A0A0A]" />
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              summary.net >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
            }`}
          >
            {summary.net >= 0 ? '+' : ''}
            {formatCurrency(summary.net, currency)}
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white border border-[#E5E5E3] rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[#737373]" />
          <input
            type="text"
            placeholder="Search description or category..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3.5 py-2 bg-[#FAFAFA] border border-[#E5E5E3] rounded-lg text-xs text-[#0A0A0A] placeholder-[#737373] focus:outline-none focus:border-[#0A0A0A]"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Type Filter */}
          <div className="flex items-center rounded-lg bg-[#FAFAFA] p-0.5 border border-[#E5E5E3]">
            <button
              onClick={() => {
                setTypeFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeFilter === 'all'
                  ? 'bg-white text-[#0A0A0A] shadow-sm font-semibold'
                  : 'text-[#737373] hover:text-[#0A0A0A]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setTypeFilter('income');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeFilter === 'income'
                  ? 'bg-white text-[#16A34A] shadow-sm font-semibold'
                  : 'text-[#737373] hover:text-[#0A0A0A]'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => {
                setTypeFilter('expense');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                typeFilter === 'expense'
                  ? 'bg-white text-[#DC2626] shadow-sm font-semibold'
                  : 'text-[#737373] hover:text-[#0A0A0A]'
              }`}
            >
              Expense
            </button>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-[#FAFAFA] border border-[#E5E5E3] rounded-lg text-xs font-medium text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Clean Ledger Table (Editorial, Hairline Separators, Meaningful Icons) */}
      <div className="bg-white border border-[#E5E5E3] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E3] bg-[#FAFAFA] text-[#737373] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-5">Description</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-5 text-right">Amount</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E3]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-[#737373]">
                    Loading financial ledger...
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#737373]">
                    No transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const catName =
                    (tx.category as any)?.name ||
                    (typeof (tx.category as any) === 'string' ? (tx.category as any) : '') ||
                    'General';

                  const dateStr = new Date(tx.date || tx.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <tr key={tx._id} className="hover:bg-[#FAFAFA] transition-colors">
                      {/* Description with Icon */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-[#F9F9F8] border border-[#E5E5E3] flex items-center justify-center flex-shrink-0">
                            {getCategoryIcon(tx.category)}
                          </div>
                          <span className="font-semibold text-[#0A0A0A]">{tx.description}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-[#737373]">
                        {catName}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-[#737373] tabular-nums">
                        {dateStr}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isExpense
                              ? 'bg-red-50 text-[#DC2626] border border-red-200'
                              : 'bg-green-50 text-[#16A34A] border border-green-200'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-5 text-right font-bold tabular-nums">
                        <span className={isExpense ? 'text-[#DC2626]' : 'text-[#16A34A]'}>
                          {isExpense ? '-' : '+'}
                          {formatCurrency(tx.amount, currency)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDelete(tx._id)}
                          className="p-1 rounded text-[#737373] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Delete transaction"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#E5E5E3] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#737373]">
          <div>
            Showing <span className="font-semibold text-[#0A0A0A]">{paginatedTransactions.length}</span> of{' '}
            <span className="font-semibold text-[#0A0A0A]">{filteredTransactions.length}</span> transactions
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded border border-[#E5E5E3] bg-white text-[#0A0A0A] hover:bg-[#F9F9F8] disabled:opacity-40 transition-colors font-medium"
            >
              Previous
            </button>
            <span className="px-2 py-1 text-xs font-medium text-[#737373]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded border border-[#E5E5E3] bg-white text-[#0A0A0A] hover:bg-[#F9F9F8] disabled:opacity-40 transition-colors font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transactions;