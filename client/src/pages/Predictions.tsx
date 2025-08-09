import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../lib/currency';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

type Period = 'weekly' | 'monthly' | 'yearly';
type PredictionType = 'expense' | 'savings';

interface PopulatedCategory {
  _id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface PredictionItem {
  _id: string;
  type: PredictionType | 'income';
  period: Period | 'daily';
  predictedAmount: number;
  confidence: number; // 0..1
  startDate: string;
  endDate: string;
  category?: PopulatedCategory | null;
}

interface RecommendationCategoryExpense {
  category: PopulatedCategory;
  monthlyAvg: number;
  percentOfIncome: number;
}

interface RecommendationsResponse {
  monthlyIncome: number;
  currentExpenses: number;
  currentSavingsRate: number; // percent (0..100)
  categoryExpenses: RecommendationCategoryExpense[];
  recommendations: Array<{
    type: string;
    message: string;
    category?: PopulatedCategory;
    currentAmount?: number;
    recommendedAmount?: number;
    savingsAmount?: number;
    currentRate?: number;
    targetRate?: number;
  }>;
}

const PERIOD_OPTIONS: Period[] = ['weekly', 'monthly', 'yearly'];
const TYPE_OPTIONS: PredictionType[] = ['expense', 'savings'];

const Predictions: React.FC = () => {
  const { user } = useAuthStore();
  const currency = user?.currency || 'USD';
  const [period, setPeriod] = useState<Period>('monthly');
  const [predType, setPredType] = useState<PredictionType>('expense');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [recs, setRecs] = useState<RecommendationsResponse | null>(null);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartJS | null>(null);

  const token = useMemo(() => localStorage.getItem('auth-token'), []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      let [predRes, recsRes] = await Promise.all([
        api.get('/predictions', { params: { type: predType, period }, headers, withCredentials: true }),
        api.get('/predictions/recommendations', { headers, withCredentials: true })
      ]);

      let preds: PredictionItem[] = predRes.data?.data || [];
      // Auto-generate if none exist for the selected type/period
      if ((!preds || preds.length === 0)) {
        try {
          if (predType === 'expense') {
            await api.post('/predictions/expenses', { period });
          } else if (predType === 'savings') {
            await api.post('/predictions/savings', { period });
          }
          const retry = await api.get('/predictions', { params: { type: predType, period }, headers, withCredentials: true });
          preds = retry.data?.data || [];
        } catch (_) {
          // keep empty; error surfaced below if needed
        }
      }
      setPredictions(preds);
      // Override monthlyIncome in recommendations with user profile monthlyIncome
      const profileIncome = user?.monthlyIncome || 0;
      const recommendations = recsRes.data?.data || null;
      if (recommendations) {
        setRecs({ ...recommendations, monthlyIncome: profileIncome });
      } else {
        setRecs(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load predictions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, predType]);

  // Render/Update bar chart for expense predictions
  useEffect(() => {
    if (predType !== 'expense') {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const expensePreds = predictions.filter(p => p.type === 'expense' && p.category);
    if (!chartRef.current || expensePreds.length === 0) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }

    const labels = expensePreds.map(p => p.category?.name || 'Unknown');
    const values = expensePreds.map(p => p.predictedAmount);
    const colors = expensePreds.map(p => p.category?.color || '#6366F1');

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Predicted Expense',
            data: values,
            backgroundColor: colors.map(c => `${c}66`),
            borderColor: colors,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => formatCurrency(Number(ctx.parsed.y), currency)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => typeof value === 'number'
                ? formatCurrency(value as number, currency, 0)
                : ''
            }
          }
        }
      }
    });
  }, [predType, predictions]);

  const savingsPrediction = useMemo(() => predictions.find(p => p.type === 'savings'), [predictions]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Predictions</h1>
        <div className="flex items-center gap-3">
          <select
            value={predType}
            onChange={(e) => setPredType(e.target.value as PredictionType)}
            className="border border-gray-300 rounded-md py-2 px-3 text-sm"
          >
            {TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="border border-gray-300 rounded-md py-2 px-3 text-sm"
          >
            {PERIOD_OPTIONS.map(p => (
              <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
            disabled={isLoading}
          >
            Refresh
          </button>
          {predType === 'expense' && (
            <button
              onClick={async () => { await api.post('/predictions/expenses', { period }); await fetchData(); }}
              className="bg-gray-100 text-gray-800 px-3 py-2 rounded-md hover:bg-gray-200 text-sm"
              disabled={isLoading}
            >
              Generate Expenses
            </button>
          )}
          {predType === 'savings' && (
            <button
              onClick={async () => { await api.post('/predictions/savings', { period }); await fetchData(); }}
              className="bg-gray-100 text-gray-800 px-3 py-2 rounded-md hover:bg-gray-200 text-sm"
              disabled={isLoading}
            >
              Generate Savings
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="h-40 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{predType === 'expense' ? 'Expense Forecast by Category' : 'Savings Forecast'}</h2>
            </div>

            {predType === 'expense' ? (
              <div className="relative w-full" style={{ minHeight: 320 }}>
                {predictions.filter(p => p.type === 'expense').length === 0 ? (
                  <p className="text-sm text-gray-500">No predictions available. Add more transactions to enable forecasting.</p>
                ) : (
                  <canvas ref={chartRef}></canvas>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {savingsPrediction ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-md bg-green-50 p-4">
                      <p className="text-sm text-green-700">Predicted Savings ({period})</p>
                      <p className="mt-1 text-2xl font-bold text-green-700">{formatCurrency(savingsPrediction.predictedAmount, currency)}</p>
                    </div>
                    <div className="rounded-md bg-blue-50 p-4">
                      <p className="text-sm text-blue-700">Confidence</p>
                      <p className="mt-1 text-2xl font-bold text-blue-700">{Math.round((savingsPrediction.confidence || 0) * 100)}%</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No savings prediction available for this period.</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Budget Recommendations</h2>
            {!recs ? (
              <p className="text-sm text-gray-500">No recommendations available.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-gray-500">Monthly Income</p>
                    <p className="text-base font-semibold">{formatCurrency(recs.monthlyIncome, currency)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-gray-500">Current Expenses</p>
                    <p className="text-base font-semibold">{formatCurrency(recs.currentExpenses, currency)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-gray-500">Savings Rate</p>
                    <p className="text-base font-semibold">{recs.currentSavingsRate.toFixed(1)}%</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Top Expense Categories (avg/month)</h3>
                  {recs.categoryExpenses.length === 0 ? (
                    <p className="text-sm text-gray-500">No expense data found.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 border rounded-md">
                      {recs.categoryExpenses.slice(0, 5).map((c) => (
                        <li key={c.category._id} className="flex items-center justify-between p-3">
                          <span className="text-sm text-gray-700">{c.category.name}</span>
                          <span className="text-sm font-medium">{formatCurrency(c.monthlyAvg, currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h3>
                  {recs.recommendations.length === 0 ? (
                    <p className="text-sm text-gray-500">No recommendations at this time.</p>
                  ) : (
                    <ul className="space-y-2">
                      {recs.recommendations.map((r, idx) => (
                        <li key={idx} className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">{r.message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Predictions;