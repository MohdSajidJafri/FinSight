import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useBudgetStore } from '../stores/budgetStore';
import { formatCurrency } from '../lib/currency';
import {
  UserCircleIcon,
  KeyIcon,
  AdjustmentsHorizontalIcon,
  ReceiptPercentIcon,
  ChartPieIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

export const Settings: React.FC = () => {
  const { user, updateUser, changePassword, isLoading, error, clearError } = useAuthStore();
  const { transactions, getTransactions } = useTransactionStore();
  const { budgets, getBudgets } = useBudgetStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [savingsGoal, setSavingsGoal] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    getTransactions();
    getBudgets();
  }, [getTransactions, getBudgets]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setCurrency(user.currency || 'USD');
      setMonthlyIncome(user.monthlyIncome != null ? String(user.monthlyIncome) : '');
      setSavingsGoal(user.savingsGoal != null ? String(user.savingsGoal) : '');
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    clearError();
    try {
      const payload: any = {
        name,
        email,
        currency,
        monthlyIncome: monthlyIncome === '' ? undefined : Number(monthlyIncome),
        savingsGoal: savingsGoal === '' ? undefined : Number(savingsGoal)
      };
      await updateUser(payload);
      setProfileMessage('Profile updated successfully');
    } catch (err) {
      // Error handled by store
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    clearError();
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New password and confirmation do not match');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      // Error handled by store
    }
  };

  const initials = useMemo(() => {
    if (!name) return 'DG';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  const memberDate = useMemo(() => {
    if (!user?.createdAt) return null;
    try {
      return new Date(user.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return null;
    }
  }, [user?.createdAt]);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">Settings</h1>
        <p className="text-xs sm:text-sm text-[#737373] mt-0.5">
          Manage your account profile, preferences, and security credentials.
        </p>
      </div>

      {/* 2. Main Two-Column Structure */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Navigation Tabs */}
        <div className="space-y-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left ${
              activeTab === 'profile'
                ? 'bg-[#F4F4F2] text-[#0A0A0A] font-semibold'
                : 'text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F9F9F8]'
            }`}
          >
            <UserCircleIcon className="w-4 h-4 stroke-[1.75]" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left ${
              activeTab === 'security'
                ? 'bg-[#F4F4F2] text-[#0A0A0A] font-semibold'
                : 'text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F9F9F8]'
            }`}
          >
            <KeyIcon className="w-4 h-4 stroke-[1.75]" />
            <span>Security</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors text-left ${
              activeTab === 'preferences'
                ? 'bg-[#F4F4F2] text-[#0A0A0A] font-semibold'
                : 'text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F9F9F8]'
            }`}
          >
            <AdjustmentsHorizontalIcon className="w-4 h-4 stroke-[1.75]" />
            <span>Preferences</span>
          </button>
        </div>

        {/* Right Content Panels */}
        <div className="md:col-span-3">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Form (2/3) */}
              <div className="lg:col-span-2 bg-white border border-[#E5E5E3] rounded-2xl p-6 sm:p-7 shadow-sm">
                <h2 className="text-sm font-bold text-[#0A0A0A] mb-1">Profile Information</h2>
                <p className="text-xs text-[#737373] mb-5">
                  Update your personal account details and currency base
                </p>

                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                    {error}
                  </div>
                )}
                {profileMessage && (
                  <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                    {profileMessage}
                  </div>
                )}

                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="currency"
                      className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                    >
                      Base Currency
                    </label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    >
                      <option value="USD">USD - US Dollar ($)</option>
                      <option value="EUR">EUR - Euro (€)</option>
                      <option value="GBP">GBP - British Pound (£)</option>
                      <option value="INR">INR - Indian Rupee (₹)</option>
                      <option value="JPY">JPY - Japanese Yen (¥)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="monthlyIncome"
                        className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                      >
                        Monthly Income ({currency})
                      </label>
                      <input
                        type="number"
                        id="monthlyIncome"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        placeholder="5500"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="savingsGoal"
                        className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                      >
                        Savings Goal ({currency}/mo)
                      </label>
                      <input
                        type="number"
                        id="savingsGoal"
                        value={savingsGoal}
                        onChange={(e) => setSavingsGoal(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        placeholder="1200"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-[#0A0A0A] hover:bg-[#262626] text-white font-semibold rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Profile Summary Card (1/3) */}
              <div className="bg-white border border-[#E5E5E3] rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <h2 className="text-sm font-bold text-[#0A0A0A] mb-4">Profile Summary</h2>

                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="w-11 h-11 rounded-full bg-[#F4F4F2] border border-[#E5E5E3] text-[#0A0A0A] font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0A0A0A] truncate">{name || 'User'}</p>
                      {memberDate ? (
                        <p className="text-[11px] text-[#737373] truncate">Member since {memberDate}</p>
                      ) : (
                        <p className="text-[11px] text-[#737373] truncate">{email}</p>
                      )}
                    </div>
                  </div>

                  {/* Real Metrics Only (No fabricated stats) */}
                  <div className="space-y-3 pt-4 border-t border-[#E5E5E3]">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#737373]">
                        <ReceiptPercentIcon className="w-4 h-4 text-[#0A0A0A]" />
                        <span>Total Transactions</span>
                      </div>
                      <span className="font-bold text-[#0A0A0A] tabular-nums">{transactions.length}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#737373]">
                        <ChartPieIcon className="w-4 h-4 text-[#0A0A0A]" />
                        <span>Active Budgets</span>
                      </div>
                      <span className="font-bold text-[#0A0A0A] tabular-nums">{budgets.length}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[#737373]">
                        <CurrencyDollarIcon className="w-4 h-4 text-[#0A0A0A]" />
                        <span>Savings Target</span>
                      </div>
                      <span className="font-bold text-[#16A34A] tabular-nums">
                        {savingsGoal ? formatCurrency(Number(savingsGoal), currency) : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-[#E5E5E3]">
                  <span className="text-[11px] text-[#737373] block">
                    Account Status: <span className="text-[#16A34A] font-semibold">Active & Secured</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="bg-white border border-[#E5E5E3] rounded-2xl p-6 sm:p-8 max-w-xl shadow-sm">
              <h2 className="text-sm font-bold text-[#0A0A0A] mb-1">Security Credentials</h2>
              <p className="text-xs text-[#737373] mb-5">
                Change your password to keep your financial account safe
              </p>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {error}
                </div>
              )}
              {passwordMessage && (
                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                  {passwordMessage}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                  >
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold text-[#0A0A0A] mb-1.5 uppercase tracking-wider"
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E5E3] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    required
                    minLength={6}
                  />
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-[#0A0A0A] hover:bg-[#262626] text-white font-semibold rounded-lg text-xs transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && (
            <div className="bg-white border border-[#E5E5E3] rounded-2xl p-6 sm:p-8 max-w-xl shadow-sm space-y-6">
              <div>
                <h2 className="text-sm font-bold text-[#0A0A0A] mb-1">Display Preferences</h2>
                <p className="text-xs text-[#737373]">
                  Configure your dashboard display formatting
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E3]">
                  <div>
                    <p className="text-xs font-semibold text-[#0A0A0A]">Editorial Aesthetic</p>
                    <p className="text-[11px] text-[#737373]">
                      Minimalist Monochrome Fintech (Active)
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-[#E5E5E3] text-[#0A0A0A] px-2.5 py-1 rounded-md">
                    Enabled
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E3]">
                  <div>
                    <p className="text-xs font-semibold text-[#0A0A0A]">Tabular Numerals</p>
                    <p className="text-[11px] text-[#737373]">
                      Display all financial figures with aligned monospace metrics
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white border border-[#E5E5E3] text-[#0A0A0A] px-2.5 py-1 rounded-md">
                    Standard
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;