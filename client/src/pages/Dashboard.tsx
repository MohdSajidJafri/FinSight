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

      // Create or update chart
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
    }
  }, [transactions]);

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
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Total Balance</h2>
          <p className={`text-2xl font-bold ${stats.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats.totalBalance, currency)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Total Income</h2>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalIncome, currency)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Total Expenses</h2>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalExpenses, currency)}</p>
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
          * Predictions are based on your transaction history from the past two months
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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