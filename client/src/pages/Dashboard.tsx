import React, { useEffect, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';
import { useTransactionStore } from '../stores/transactionStore';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../lib/currency';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
);

interface TransactionStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  categoryTotals: { [key: string]: { amount: number; name: string } };
  predictions: {
    estimatedIncome: number;
    estimatedExpenses: number;
    trend: 'up' | 'down' | 'stable';
    percentageChange: number;
  };
}

const Dashboard: React.FC = () => {
  const { transactions, getTransactions, isLoading } = useTransactionStore();
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';
  const [stats, setStats] = useState<TransactionStats>({
    totalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    savingsRate: 0,
    categoryTotals: {},
    predictions: {
      estimatedIncome: 0,
      estimatedExpenses: 0,
      trend: 'stable',
      percentageChange: 0
    }
  });
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const predictionChartRef = useRef<HTMLCanvasElement>(null);
  const predictionChartInstance = useRef<ChartJS | null>(null);
  const dailyTrendChartRef = useRef<HTMLCanvasElement>(null);
  const dailyTrendChartInstance = useRef<ChartJS | null>(null);

  useEffect(() => {
    getTransactions();
  }, [getTransactions]);

  useEffect(() => {
    if (transactions.length >= 0) {
      // Calculate statistics
      const newStats = transactions.reduce((acc, transaction) => {
        const amount = transaction.amount;
        // Only track expenses; income is sourced from user profile (monthlyIncome)
        if (transaction.type === 'expense') {
          acc.totalExpenses += amount;
          // Add to category totals
          if (transaction.category && transaction.category._id) {
            const categoryId = transaction.category._id;
            if (!acc.categoryTotals[categoryId]) {
              acc.categoryTotals[categoryId] = {
                amount: 0,
                name: transaction.category.name || 'Uncategorized'
              };
            }
            acc.categoryTotals[categoryId].amount += amount;
          }
        }
        return acc;
      }, {
        totalBalance: 0,
        totalIncome: 0,
        totalExpenses: 0,
        savingsRate: 0,
        categoryTotals: {} as { [key: string]: { amount: number; name: string } },
        predictions: {
          estimatedIncome: 0,
          estimatedExpenses: 0,
          trend: 'stable' as 'up' | 'down' | 'stable',
          percentageChange: 0
        }
      });

      // Use monthly income from user profile as the income baseline
      const monthlyIncome = user?.monthlyIncome || 0;
      newStats.totalIncome = monthlyIncome;
      newStats.totalBalance = monthlyIncome - newStats.totalExpenses;
      newStats.savingsRate = monthlyIncome > 0
        ? ((monthlyIncome - newStats.totalExpenses) / monthlyIncome) * 100
        : 0;

      // Calculate predictions
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      const lastMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= lastMonth && transactionDate < now;
      });
      const twoMonthsAgoTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= twoMonthsAgo && transactionDate < lastMonth;
      });

      const lastMonthIncome = monthlyIncome;
      const lastMonthExpenses = lastMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const twoMonthsAgoIncome = monthlyIncome;
      const twoMonthsAgoExpenses = twoMonthsAgoTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate trend and percentage change based on expenses
      let expenseChange = 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      
      // If we have data from both months
      if (twoMonthsAgoExpenses > 0 || lastMonthExpenses > 0) {
        if (twoMonthsAgoExpenses === 0) {
          // If no expenses two months ago but expenses last month
          expenseChange = 100;
          trend = 'up';
        } else if (lastMonthExpenses === 0) {
          // If expenses two months ago but no expenses last month
          expenseChange = -100;
          trend = 'down';
        } else {
          // Normal case with expenses in both months
          expenseChange = ((lastMonthExpenses - twoMonthsAgoExpenses) / twoMonthsAgoExpenses) * 100;
          expenseChange = Math.min(Math.max(expenseChange, -100), 100);
          trend = expenseChange > 5 ? 'up' : expenseChange < -5 ? 'down' : 'stable';
        }
      }

      // Calculate predictions with safeguards
      const baseIncome = monthlyIncome;
      const baseExpenses = lastMonthExpenses || twoMonthsAgoExpenses || 0;
      
      // Adjust trend factor based on data availability
      const trendFactor = trend === 'up' ? 1.1 : trend === 'down' ? 0.9 : 1;
      
      newStats.predictions = {
        estimatedIncome: Math.max(baseIncome, 0),
        estimatedExpenses: Math.max(baseExpenses * trendFactor, 0),
        trend,
        percentageChange: Math.abs(expenseChange)
      };

      setStats(newStats);

      // Create or update prediction chart
      if (predictionChartRef.current) {
        if (predictionChartInstance.current) {
          predictionChartInstance.current.destroy();
        }

        const ctx = predictionChartRef.current.getContext('2d');
        if (ctx) {
          const months = ['Two Months Ago', 'Last Month', 'Next Month (Predicted)'];
          
          predictionChartInstance.current = new ChartJS(ctx, {
            type: 'line',
            data: {
              labels: months,
              datasets: [
                {
                  label: 'Income',
                  data: [twoMonthsAgoIncome, lastMonthIncome, newStats.predictions.estimatedIncome],
                  borderColor: '#10B981',
                  backgroundColor: '#10B98133',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 4,
                  pointHoverRadius: 6
                },
                {
                  label: 'Expenses',
                  data: [twoMonthsAgoExpenses, lastMonthExpenses, newStats.predictions.estimatedExpenses],
                  borderColor: '#EF4444',
                  backgroundColor: '#EF444433',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 4,
                  pointHoverRadius: 6
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    usePointStyle: true,
                    padding: 15,
                    boxWidth: 8
                  }
                },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  callbacks: {
                    label: function(context) {
                      let label = context.dataset.label || '';
                      if (label) {
                        label += ': ';
                      }
                      if (context.parsed.y !== null) {
                        label += formatCurrency(Number(context.parsed.y), currency);
                      }
                      return label;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => {
                      if (typeof value === 'number') {
                        return formatCurrency(value, currency, 0);
                      }
                      return '';
                    }
                  }
                }
              }
            }
          });
        }
      }

      // Create or update category doughnut chart
      if (chartRef.current) {
        if (chartInstance.current) {
          chartInstance.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          const categoryData = Object.values(newStats.categoryTotals).filter(cat => cat.amount > 0);
          const labels = categoryData.map(cat => cat.name);
          const values = categoryData.map(cat => cat.amount);

          chartInstance.current = new ChartJS(ctx, {
            type: 'doughnut',
            data: {
              labels,
              datasets: [{
                data: values,
                backgroundColor: [
                  '#3B82F6', // blue
                  '#EF4444', // red
                  '#10B981', // green
                  '#F59E0B', // yellow
                  '#6366F1', // indigo
                  '#8B5CF6', // purple
                  '#EC4899', // pink
                ]
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: {
                  position: 'bottom',
                  display: true,
                  labels: {
                    boxWidth: 12,
                    padding: 15,
                    usePointStyle: true
                  }
                }
              },
              layout: {
                padding: {
                  top: 10,
                  bottom: 10
                }
              }
            }
          });
        }
      }

      // Create or update daily expense trend chart (last 14 days)
      if (dailyTrendChartRef.current) {
        if (dailyTrendChartInstance.current) {
          dailyTrendChartInstance.current.destroy();
        }

        const ctx = dailyTrendChartRef.current.getContext('2d');
        if (ctx) {
          const days = 14;
          const today = new Date();
          const start = new Date(today);
          start.setDate(start.getDate() - (days - 1));

          const dailyTotals: { [date: string]: number } = {};
          transactions
            .filter((t) => t.type === 'expense')
            .forEach((t) => {
              const d = new Date(t.date);
              if (d < start || d > today) return;
              const key = d.toISOString().slice(0, 10);
              dailyTotals[key] = (dailyTotals[key] || 0) + t.amount;
            });

          const labels: string[] = [];
          const values: number[] = [];
          for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            labels.push(
              d.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              })
            );
            values.push(dailyTotals[key] || 0);
          }

          dailyTrendChartInstance.current = new ChartJS(ctx, {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'Daily Expenses',
                  data: values,
                  borderColor: '#6366F1',
                  backgroundColor: '#6366F11a',
                  tension: 0.4,
                  fill: true,
                  pointRadius: 3,
                  pointHoverRadius: 5
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) =>
                      formatCurrency(
                        typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0,
                        currency
                      )
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) =>
                      typeof value === 'number'
                        ? formatCurrency(value as number, currency, 0)
                        : ''
                  }
                }
              }
            }
          });
        }
      }
    }
  }, [transactions, currency, user?.monthlyIncome]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your spending, budgets, and upcoming trends.
          </p>
        </div>
        <Link
          to="/transactions/add"
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Add Transaction
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Total Balance</p>
          <p className={`mt-2 text-2xl font-semibold ${stats.totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(stats.totalBalance, currency)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Income − expenses this month.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Planned Monthly Income</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {formatCurrency(stats.totalIncome, currency)}
          </p>
          <p className="mt-1 text-xs text-gray-500">From your profile settings.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Total Expenses (This Month)</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">
            {formatCurrency(stats.totalExpenses, currency)}
          </p>
          <p className="mt-1 text-xs text-gray-500">All expense transactions this month.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Savings Rate</p>
            <p className="mt-2 text-2xl font-semibold text-sky-700">
              {Number.isFinite(stats.savingsRate) ? stats.savingsRate.toFixed(1) : '0.0'}%
            </p>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${stats.savingsRate >= 20 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, stats.savingsRate))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Aim for at least <span className="font-medium">20%</span> savings rate.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Monthly Predictions</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm text-gray-500 mb-1">Estimated Income</h3>
                <p className="text-xl font-semibold text-green-600">
                  {formatCurrency(stats.predictions.estimatedIncome, currency)}
                {stats.predictions.estimatedIncome === 0 && (
                  <span className="text-sm text-gray-500 ml-2">(No past income data)</span>
                )}
              </p>
            </div>
            <div>
              <h3 className="text-sm text-gray-500 mb-1">Estimated Expenses</h3>
              <div className="flex items-center gap-2">
                <p className="text-xl font-semibold text-red-600">
                  {formatCurrency(stats.predictions.estimatedExpenses, currency)}
                  {stats.predictions.estimatedExpenses === 0 && (
                    <span className="text-sm text-gray-500 ml-2">(No past expense data)</span>
                  )}
                </p>
                {stats.predictions.trend !== 'stable' && stats.predictions.estimatedExpenses > 0 && (
                  <span className={`text-sm ${stats.predictions.trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                    {stats.predictions.trend === 'up' ? '↑' : '↓'} {stats.predictions.percentageChange.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-medium">Trend Analysis:</p>
              <p>{getTrendMessage(stats.predictions)}</p>
            </div>
          </div>
          <div className="relative aspect-[2/1] w-full">
            <canvas ref={predictionChartRef}></canvas>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          * Predictions use your profile monthly income and current month's expenses and trend.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
            <Link
              to="/transactions"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {transactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction._id}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{transaction.description}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(transaction.date).toLocaleDateString()} • {transaction.category?.name || 'Uncategorized'}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Expense by Category</h2>
          <div className="relative aspect-square w-full max-w-[300px] mx-auto">
            <canvas ref={chartRef}></canvas>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Spend (Last 14 Days)</h2>
          <div className="relative w-full" style={{ minHeight: 260 }}>
            <canvas ref={dailyTrendChartRef}></canvas>
          </div>
        </div>
      </div>
    </div>
  );
};

const getTrendMessage = (predictions: TransactionStats['predictions']) => {
  if (predictions.estimatedExpenses === 0 && predictions.estimatedIncome === 0) {
    return "Add some transactions to see spending predictions.";
  }
  
  if (predictions.trend === 'up') {
    return `Your spending is trending upward by ${predictions.percentageChange.toFixed(1)}% compared to last month.`;
  } else if (predictions.trend === 'down') {
    return `Your spending is trending downward by ${predictions.percentageChange.toFixed(1)}% compared to last month.`;
  }
  return "Your spending pattern is stable compared to last month.";
};

export default Dashboard; 