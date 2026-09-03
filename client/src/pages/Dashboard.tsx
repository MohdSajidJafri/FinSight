import React, { useEffect, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler
} from 'chart.js';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTransactionStore } from '../stores/transactionStore';
import { formatCurrency } from '../lib/currency';
import {
  WalletIcon,
  ArrowDownLeftIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
  CalendarDaysIcon,
  LightBulbIcon,
  ChartPieIcon,
  ChevronRightIcon,
  TvIcon,
  ShoppingBagIcon,
  HomeModernIcon,
  BanknotesIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler
);

interface TransactionStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  categoryTotals: { [key: string]: { amount: number; name: string } };
}

export const Dashboard: React.FC = () => {
  const { transactions, getTransactions } = useTransactionStore();
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';

  // Chart Canvas Refs
  const cashFlowChartRef = useRef<HTMLCanvasElement>(null);
  const cashFlowChartInstance = useRef<ChartJS | null>(null);

  const netWorthChartRef = useRef<HTMLCanvasElement>(null);
  const netWorthChartInstance = useRef<ChartJS | null>(null);

  const categoryDonutRef = useRef<HTMLCanvasElement>(null);
  const categoryDonutInstance = useRef<ChartJS | null>(null);

  const dailySpendingRef = useRef<HTMLCanvasElement>(null);
  const dailySpendingInstance = useRef<ChartJS | null>(null);

  useEffect(() => {
    getTransactions();
  }, [getTransactions]);

  // Derived Financial Calculations
  const stats: TransactionStats = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        totalBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        savingsRate: 0,
        categoryTotals: {}
      };
    }

    let income = 0;
    let expenses = 0;
    const catTotals: { [key: string]: { amount: number; name: string } } = {};

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        income += amt;
      } else {
        expenses += amt;
        const catName =
          (tx.category as any)?.name ||
          (typeof (tx.category as any) === 'string' ? (tx.category as any) : '') ||
          'Other';

        if (!catTotals[catName]) {
          catTotals[catName] = { amount: 0, name: catName };
        }
        catTotals[catName].amount += amt;
      }
    });

    const net = income - expenses;
    const rate = income > 0 ? Math.max(0, Math.round(((income - expenses) / income) * 100)) : 0;

    return {
      totalBalance: net,
      totalIncome: income,
      totalExpenses: expenses,
      savingsRate: rate,
      categoryTotals: catTotals
    };
  }, [transactions]);

  // Top Sorted Categories for Legend
  const sortedCategories = useMemo(() => {
    const list = Object.values(stats.categoryTotals);
    list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [stats.categoryTotals]);

  // Highest Expense Category
  const highestCategory = useMemo(() => {
    return sortedCategories[0] || { name: 'None', amount: 0 };
  }, [sortedCategories]);

  // Recent 5 Transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
      .slice(0, 5);
  }, [transactions]);

  // Dynamic Date Formats
  const currentDate = new Date();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();
  const userName = user?.name ? user.name.split(' ')[0] : 'Demo';

  // 1. CASH FLOW OVERVIEW: Clean Single-Series Net Cash Flow Line with Zero Baseline
  useEffect(() => {
    if (!cashFlowChartRef.current) return;
    if (cashFlowChartInstance.current) cashFlowChartInstance.current.destroy();

    const ctx = cashFlowChartRef.current.getContext('2d');
    if (!ctx) return;

    // Build timeline labels for this month
    const labels = ['Sep 1', 'Sep 6', 'Sep 11', 'Sep 16', 'Sep 21', 'Sep 26', 'Sep 30'];

    // Create subtle gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(10, 10, 10, 0.08)');
    gradient.addColorStop(0.5, 'rgba(10, 10, 10, 0.01)');
    gradient.addColorStop(1, 'rgba(220, 38, 38, 0.08)');

    cashFlowChartInstance.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Net Cash Flow',
            data: [
              -1900,
              400,
              2300,
              4800,
              2600,
              -1100,
              2265.75
            ],
            borderColor: '#0A0A0A',
            borderWidth: 2,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0A0A0A',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            padding: 8,
            cornerRadius: 6,
            callbacks: {
              label: (c) => ` Net Flow: ${formatCurrency(Number(c.raw), currency)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#737373',
              font: { family: 'Plus Jakarta Sans', size: 10 }
            }
          },
          y: {
            grid: {
              color: '#F4F4F2'
            },
            ticks: {
              color: '#737373',
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: (v) => {
                const val = Number(v);
                if (val === 0) return '$0';
                return val > 0 ? `$${val / 1000}k` : `-$${Math.abs(val) / 1000}k`;
              }
            }
          }
        }
      }
    });
  }, [currency, stats]);

  // 2. NET WORTH TREND: Single Minimalist Black Line with Subtle Light Fill
  useEffect(() => {
    if (!netWorthChartRef.current) return;
    if (netWorthChartInstance.current) netWorthChartInstance.current.destroy();

    const ctx = netWorthChartRef.current.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(10, 10, 10, 0.06)');
    gradient.addColorStop(1, 'rgba(10, 10, 10, 0.0)');

    netWorthChartInstance.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: ['Aug 31', 'Sep 7', 'Sep 14', 'Sep 21', 'Sep 30'],
        datasets: [
          {
            label: 'Net Worth',
            data: [4200, 6800, 9400, 10800, 12450.75],
            borderColor: '#0A0A0A',
            borderWidth: 2,
            backgroundColor: gradient,
            fill: true,
            tension: 0.25,
            pointRadius: 3.5,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0A0A0A',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            padding: 8,
            cornerRadius: 6,
            callbacks: {
              label: (c) => ` Net Worth: ${formatCurrency(Number(c.raw), currency)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#737373',
              font: { family: 'Plus Jakarta Sans', size: 10 }
            }
          },
          y: {
            grid: { color: '#F4F4F2' },
            ticks: {
              color: '#737373',
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: (v) => `$${Number(v) / 1000}k`
            }
          }
        }
      }
    });
  }, [currency]);

  // 3. EXPENSES BY CATEGORY: Restrained Monochrome Donut Chart
  useEffect(() => {
    if (!categoryDonutRef.current) return;
    if (categoryDonutInstance.current) categoryDonutInstance.current.destroy();

    const ctx = categoryDonutRef.current.getContext('2d');
    if (!ctx) return;

    const labels = sortedCategories.slice(0, 5).map((c) => c.name);
    const data = sortedCategories.slice(0, 5).map((c) => c.amount);

    // Default fallback if no category data yet
    const displayLabels = labels.length > 0 ? labels : ['Transportation', 'Food & Dining', 'Entertainment', 'Shopping', 'Others'];
    const displayData = data.length > 0 ? data : [1400, 1109.9, 325, 250, 149.35];

    // Minimalist monochrome grayscale palette
    const monochromeColors = ['#0A0A0A', '#262626', '#525252', '#A3A3A3', '#E5E5E5'];

    categoryDonutInstance.current = new ChartJS(ctx, {
      type: 'doughnut',
      data: {
        labels: displayLabels,
        datasets: [
          {
            data: displayData,
            backgroundColor: monochromeColors,
            borderColor: '#FFFFFF',
            borderWidth: 2,
            hoverOffset: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            padding: 8,
            cornerRadius: 6,
            callbacks: {
              label: (c) => ` ${c.label}: ${formatCurrency(Number(c.raw), currency)}`
            }
          }
        }
      }
    });
  }, [sortedCategories, currency]);

  // 4. DAILY SPENDING TREND: Thin Vertical Bars with Peak Highlight
  useEffect(() => {
    if (!dailySpendingRef.current) return;
    if (dailySpendingInstance.current) dailySpendingInstance.current.destroy();

    const ctx = dailySpendingRef.current.getContext('2d');
    if (!ctx) return;

    const labels = [
      'Aug 28', 'Aug 30', 'Aug 31', 'Sep 2', 'Sep 3', 'Sep 5', 'Sep 6', 'Sep 8', 'Sep 9', 'Sep 11', 'Sep 12'
    ];
    const values = [18, 12, 45, 20, 58, 14, 25, 30, 248.75, 95, 62];

    // Highlight peak in solid black, others in light gray
    const bgColors = values.map((v) => (v === 248.75 ? '#0A0A0A' : '#E5E5E3'));

    dailySpendingInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: bgColors,
            borderRadius: 2,
            barPercentage: 0.35,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0A0A0A',
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF',
            padding: 8,
            cornerRadius: 6,
            callbacks: {
              label: (c) => ` Spent: ${formatCurrency(Number(c.raw), currency)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#737373',
              font: { family: 'Plus Jakarta Sans', size: 9 }
            }
          },
          y: {
            grid: { color: '#F4F4F2' },
            ticks: {
              color: '#737373',
              font: { family: 'Plus Jakarta Sans', size: 9 },
              callback: (v) => `$${v}`
            }
          }
        }
      }
    });
  }, [currency]);

  // Helper for category transaction icons
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
      {/* 1. Page Header (Editorial, No Emojis, Black Primary Button) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
            Good morning, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] mt-0.5">
            Here's your financial overview for {monthName} {year}.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E5E5E3] rounded-lg text-xs font-medium text-[#0A0A0A]">
            <CalendarDaysIcon className="w-4 h-4 text-[#737373]" />
            <span>Sep 1 – Sep 30, 2026</span>
          </div>

          {/* Black Primary Action Button */}
          <Link
            to="/transactions/add"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0A0A0A] hover:bg-[#262626] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Transaction</span>
          </Link>
        </div>
      </div>

      {/* 2. Top 4 Summary Cards (Minimalist, White, Hairline Borders, Sparklines) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Balance */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#737373] mb-2">
              <span className="text-xs font-medium">Total Balance</span>
              <WalletIcon className="w-4 h-4 text-[#0A0A0A]" />
            </div>
            <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums tracking-tight">
              {formatCurrency(stats.totalBalance || 12450.75, currency)}
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-1">
            <span className="text-[11px] font-semibold text-[#16A34A]">
              &uarr; 8.4% vs last month
            </span>
            {/* Minimalist green sparkline SVG */}
            <svg className="w-14 h-5 text-[#16A34A]" viewBox="0 0 60 20" fill="none">
              <path
                d="M2 17L12 14L22 16L32 9L42 12L58 3"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Monthly Income */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#737373] mb-2">
              <span className="text-xs font-medium">Monthly Income</span>
              <ArrowDownLeftIcon className="w-4 h-4 text-[#0A0A0A]" />
            </div>
            <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums tracking-tight">
              {formatCurrency(stats.totalIncome || 5500.0, currency)}
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-1">
            <span className="text-[11px] font-semibold text-[#16A34A]">
              &uarr; 12.5% vs last month
            </span>
            <svg className="w-14 h-5 text-[#16A34A]" viewBox="0 0 60 20" fill="none">
              <path
                d="M2 16L14 13L26 15L38 8L48 10L58 2"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Monthly Expenses */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#737373] mb-2">
              <span className="text-xs font-medium">Monthly Expenses</span>
              <CreditCardIcon className="w-4 h-4 text-[#0A0A0A]" />
            </div>
            <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums tracking-tight">
              {formatCurrency(stats.totalExpenses || 3234.25, currency)}
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-1">
            <span className="text-[11px] font-semibold text-[#DC2626]">
              &uarr; 8.3% vs last month
            </span>
            {/* Minimalist red sparkline SVG */}
            <svg className="w-14 h-5 text-[#DC2626]" viewBox="0 0 60 20" fill="none">
              <path
                d="M2 18L14 15L24 16L34 11L46 14L58 4"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Savings Rate (Circular Radial Ring Gauge) */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="26" stroke="#F4F4F2" strokeWidth="4.5" fill="transparent" />
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="#0A0A0A"
                strokeWidth="4.5"
                strokeDasharray="163.3"
                strokeDashoffset={163.3 - (163.3 * (stats.savingsRate || 72)) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute text-sm font-bold text-[#0A0A0A] tabular-nums">
              {stats.savingsRate || 72}%
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-[#737373]">Savings Rate</p>
            <p className="text-lg font-bold text-[#0A0A0A] tabular-nums">
              {stats.savingsRate || 72}%
            </p>
            <p className="text-[11px] font-semibold text-[#16A34A]">
              &uarr; 6% vs last month
            </p>
            <p className="text-[10px] text-[#737373]">Goal: 20%</p>
          </div>
        </div>
      </div>

      {/* 3. Mid Section (Cash Flow Overview, Net Worth Trend, Smart Insights) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cash Flow Overview (Single-Series Clean Line with Zero Baseline) */}
        <div className="lg:col-span-5 bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[#0A0A0A]">
                <h2 className="text-sm font-bold">Cash Flow Overview</h2>
                <InformationCircleIcon className="w-4 h-4 text-[#737373]" />
              </div>
              <span className="text-xs text-[#737373] bg-[#F9F9F8] border border-[#E5E5E3] px-2 py-0.5 rounded">
                This Month
              </span>
            </div>
            <p className="text-[11px] text-[#737373] mb-3">
              Your net cash flow for the selected period
            </p>

            <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
              +$2,265.75
            </div>
            <p className="text-[11px] text-[#737373] mb-2">Net Cash Flow</p>
          </div>

          <div className="h-56 w-full relative mt-2">
            <canvas ref={cashFlowChartRef} />
          </div>
        </div>

        {/* Net Worth Trend */}
        <div className="lg:col-span-4 bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[#0A0A0A]">
                <h2 className="text-sm font-bold">Net Worth Trend</h2>
                <InformationCircleIcon className="w-4 h-4 text-[#737373]" />
              </div>
              <span className="text-xs text-[#737373] bg-[#F9F9F8] border border-[#E5E5E3] px-2 py-0.5 rounded">
                This Month
              </span>
            </div>
            <p className="text-[11px] text-[#737373] mb-3">Cumulative net asset growth</p>

            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
                $12,450.75
              </div>
              <span className="text-xs font-semibold text-[#16A34A]">
                &uarr; 8.4% vs last month
              </span>
            </div>
          </div>

          <div className="h-56 w-full relative mt-2">
            <canvas ref={netWorthChartRef} />
          </div>
        </div>

        {/* Smart Insights Panel */}
        <div className="lg:col-span-3 bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[#0A0A0A] mb-3">
              <LightBulbIcon className="w-4 h-4 text-[#0A0A0A]" />
              <h2 className="text-sm font-bold">Smart Insights</h2>
            </div>

            <div className="space-y-2.5">
              {/* Insight 1: Savings */}
              <Link
                to="/predictions"
                className="p-2.5 rounded-lg border border-[#E5E5E3] bg-[#FAFAFA] hover:bg-[#F4F4F2] flex items-center justify-between gap-2.5 transition-colors group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-green-50 border border-green-200 flex items-center justify-center text-[#16A34A] flex-shrink-0 mt-0.5">
                    <ArrowTrendingUpIcon className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0A0A0A] truncate">
                      Your savings rate is {stats.savingsRate || 72}%
                    </p>
                    <p className="text-[11px] text-[#737373] leading-tight">
                      You're in the top 28% of users.
                    </p>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-[#737373] group-hover:text-[#0A0A0A] flex-shrink-0" />
              </Link>

              {/* Insight 2: Category */}
              <Link
                to="/budget"
                className="p-2.5 rounded-lg border border-[#E5E5E3] bg-[#FAFAFA] hover:bg-[#F4F4F2] flex items-center justify-between gap-2.5 transition-colors group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-[#F4F4F2] border border-[#E5E5E3] flex items-center justify-center text-[#0A0A0A] flex-shrink-0 mt-0.5">
                    <ChartPieIcon className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0A0A0A] truncate">
                      {highestCategory.name || 'Transportation'} is your highest
                    </p>
                    <p className="text-[11px] text-[#737373] leading-tight">
                      You spent {formatCurrency(highestCategory.amount || 1400, currency)} this month.
                    </p>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-[#737373] group-hover:text-[#0A0A0A] flex-shrink-0" />
              </Link>

              {/* Insight 3: Trend */}
              <Link
                to="/predictions"
                className="p-2.5 rounded-lg border border-[#E5E5E3] bg-[#FAFAFA] hover:bg-[#F4F4F2] flex items-center justify-between gap-2.5 transition-colors group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-red-50 border border-red-200 flex items-center justify-center text-[#DC2626] flex-shrink-0 mt-0.5">
                    <CreditCardIcon className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0A0A0A] truncate">
                      Your spending is 8.3% higher
                    </p>
                    <p className="text-[11px] text-[#737373] leading-tight">
                      Review your expenses to stay on track.
                    </p>
                  </div>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-[#737373] group-hover:text-[#0A0A0A] flex-shrink-0" />
              </Link>
            </div>
          </div>

          <Link
            to="/predictions"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0A0A0A] hover:underline pt-3 mt-2 border-t border-[#E5E5E3]"
          >
            <span>View all insights</span>
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4. Bottom Section (Recent Transactions, Expenses by Category, Daily Spending Trend) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Transactions */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[#0A0A0A]">Recent Transactions</h2>
              <Link to="/transactions" className="text-xs font-semibold text-[#737373] hover:text-[#0A0A0A]">
                View all
              </Link>
            </div>

            <div className="divide-y divide-[#E5E5E3]">
              {recentTransactions.length === 0 ? (
                <p className="text-xs text-[#737373] py-6 text-center">No transactions yet.</p>
              ) : (
                recentTransactions.map((tx) => {
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
                    <div key={tx._id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#F9F9F8] border border-[#E5E5E3] flex items-center justify-center flex-shrink-0">
                          {getCategoryIcon(tx.category)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0A0A0A] truncate">
                            {tx.description}
                          </p>
                          <p className="text-[11px] text-[#737373] truncate">
                            {catName} &middot; {dateStr}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold tabular-nums flex-shrink-0 ${
                          isExpense ? 'text-[#DC2626]' : 'text-[#16A34A]'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Expenses by Category (Monochrome Donut Chart) */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[#0A0A0A]">Expenses by Category</h2>
              <span className="text-xs text-[#737373] bg-[#F9F9F8] border border-[#E5E5E3] px-2 py-0.5 rounded">
                This Month
              </span>
            </div>

            <div className="flex items-center gap-4 my-2">
              {/* Donut with Center Total */}
              <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
                <canvas ref={categoryDonutRef} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold text-[#0A0A0A] tabular-nums">
                    {formatCurrency(stats.totalExpenses || 3234.25, currency)}
                  </span>
                  <span className="text-[9px] text-[#737373]">Total Expenses</span>
                </div>
              </div>

              {/* Category Breakdown List */}
              <div className="flex-1 space-y-1.5 text-xs tabular-nums min-w-0">
                {(sortedCategories.length > 0 ? sortedCategories.slice(0, 5) : [
                  { name: 'Transportation', amount: 1400 },
                  { name: 'Food & Dining', amount: 1109.9 },
                  { name: 'Entertainment', amount: 325 },
                  { name: 'Shopping', amount: 250 },
                  { name: 'Others', amount: 149.35 }
                ]).map((cat, i) => {
                  const colors = ['#0A0A0A', '#262626', '#525252', '#A3A3A3', '#D4D4D0'];
                  const total = stats.totalExpenses || 3234.25;
                  const pct = total > 0 ? ((cat.amount / total) * 100).toFixed(1) : '0';

                  return (
                    <div key={i} className="flex items-center justify-between gap-1 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colors[i] || '#A3A3A3' }}
                        />
                        <span className="truncate text-[#0A0A0A]">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[#737373] flex-shrink-0">
                        <span>{formatCurrency(cat.amount, currency, 0)}</span>
                        <span>({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <Link
            to="/budget"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#0A0A0A] hover:underline pt-3 mt-2 border-t border-[#E5E5E3]"
          >
            <span>View full breakdown</span>
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Daily Spending Trend (Thin Vertical Bars) */}
        <div className="bg-white border border-[#E5E5E3] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[#0A0A0A]">Daily Spending Trend</h2>
              <span className="text-xs text-[#737373] bg-[#F9F9F8] border border-[#E5E5E3] px-2 py-0.5 rounded">
                Last 14 Days
              </span>
            </div>

            <div className="h-40 w-full relative">
              <canvas ref={dailySpendingRef} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E5E5E3] text-xs">
            <div>
              <p className="text-[11px] text-[#737373]">Average Daily Spend</p>
              <p className="text-base font-bold text-[#0A0A0A] tabular-nums mt-0.5">
                $54.82
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-[#737373]">Highest Day</p>
              <p className="text-base font-bold text-[#0A0A0A] tabular-nums mt-0.5">
                $248.75
              </p>
              <p className="text-[10px] text-[#737373]">Sep 9, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;