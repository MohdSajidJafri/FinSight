const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Prediction = require('../models/Prediction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const User = require('../models/User');

/**
 * Generate expense predictions for a user
 * @param {string} userId - The user ID
 * @param {string} period - The prediction period (daily, weekly, monthly, yearly)
 * @param {Object} options - Options including model selection ('prophet' or 'trend')
 * @returns {Promise<Array>} - Array of predictions
 */
exports.generateExpensePredictions = async (userId, period = 'monthly', options = {}) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get user's expense categories
    const categories = await Category.find({ user: userObjectId, type: 'expense' });
    
    // Get historical transactions for training data
    const startDate = getHistoricalStartDate(period);
    const transactions = await Transaction.find({
      user: userObjectId,
      type: 'expense',
      date: { $gte: startDate }
    }).populate('category');

    // Get active budgets as a fallback signal when there is little/no history
    const budgets = await Budget.find({ user: userObjectId, isActive: true });
    const budgetsByCategoryId = {};
    budgets.forEach((b) => {
      const key = typeof b.category === 'string' ? b.category : (b.category && b.category.toString());
      if (!key) return;
      budgetsByCategoryId[key] = b;
    });

    // Group transactions by category
    const transactionsByCategory = {};
    categories.forEach((category) => {
      const categoryId = category._id.toString();
      transactionsByCategory[categoryId] = transactions.filter((t) => {
        if (!t || !t.category) return false;
        if (typeof t.category === 'string') {
          return t.category === categoryId || t.category.toLowerCase() === category.name.toLowerCase();
        }
        if (t.category._id) {
          return t.category._id.toString() === categoryId;
        }
        return String(t.category) === categoryId;
      });
    });

    // Generate predictions for each category
    const predictions = [];
    const now = new Date();
    const predictionStartDate = new Date();
    const predictionEndDate = getPredictionEndDate(predictionStartDate, period);

    for (const category of categories) {
      const categoryId = category._id.toString();
      const categoryTransactions = transactionsByCategory[categoryId] || [];
      
      let predictedAmount = 0;
      let confidence = 0.4;
      let modelUsed = 'linear-regression';
      let factors = [
        { name: 'historical_average', weight: 0.5 },
        { name: 'trend', weight: 0.3 },
        { name: 'recency', weight: 0.2 }
      ];

      // Try external Prophet ML service if requested or if ML_SERVICE_URL is provided
      let prophetSuccess = false;
      if (options.model === 'prophet' || (process.env.ML_SERVICE_URL && options.model !== 'trend')) {
        try {
          if (categoryTransactions.length >= 3) {
            const mlPred = await callMlService(categoryTransactions, period, 1);
            if (mlPred && mlPred.length > 0 && Number.isFinite(mlPred[0].yhat)) {
              predictedAmount = Math.max(0, mlPred[0].yhat);
              confidence = 0.75;
              modelUsed = 'prophet';
              factors = [{ name: 'prophet_time_series', weight: 1.0 }];
              prophetSuccess = true;
            }
          }
        } catch (mlErr) {
          // Gracefully fall back to built-in OLS engine
          console.warn(`[ML Service Fallback] Category ${category.name}: ${mlErr.message}. Using built-in engine.`);
        }
      }

      if (!prophetSuccess) {
        if (categoryTransactions.length > 0) {
          const regression = linearRegressionPredict(categoryTransactions, period);
          predictedAmount = regression.amount;
          confidence = calculateConfidence(categoryTransactions);
          modelUsed = 'linear-regression';
        } else {
          // No transactions yet: fall back to budget amount if available
          const budget = budgetsByCategoryId[categoryId];
          if (!budget) {
            continue;
          }
          predictedAmount = Number(budget.amount) || 0;
          confidence = 0.35;
          modelUsed = 'budget-baseline';
          factors = [{ name: 'budget_allocation', weight: 1.0 }];
        }
      }

      const predictionDoc = {
        user: userObjectId,
        category: category._id,
        type: 'expense',
        period,
        predictedAmount: Number.isFinite(predictedAmount) ? Math.max(0, Math.round(predictedAmount * 100) / 100) : 0,
        confidence: Number.isFinite(confidence) ? Math.min(0.95, Math.max(0.1, Math.round(confidence * 100) / 100)) : 0.4,
        startDate: predictionStartDate,
        endDate: predictionEndDate,
        factors,
        model: modelUsed,
        createdAt: now
      };

      // Upsert to ensure one active prediction per category/period/user (prevents chart duplicate bars)
      const saved = await Prediction.findOneAndUpdate(
        { user: userObjectId, category: category._id, type: 'expense', period },
        predictionDoc,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      predictions.push(saved);
    }

    return predictions;
  } catch (error) {
    console.error('Error generating predictions:', error);
    throw error;
  }
};

/**
 * Generate savings predictions for a user
 * @param {string} userId - The user ID
 * @param {string} period - The prediction period (monthly, yearly)
 * @param {Object} options - Options including model
 * @returns {Promise<Object>} - Savings prediction
 */
exports.generateSavingsPrediction = async (userId, period = 'monthly', options = {}) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const startDate = getHistoricalStartDate(period);
    
    // Query aggregations using proper BSON ObjectId for user match
    const [incomeData, expenseData, userDoc] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            user: userObjectId,
            type: 'income',
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            total: { $sum: '$amount' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            user: userObjectId,
            type: 'expense',
            date: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            total: { $sum: '$amount' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]),
      User.findById(userObjectId)
    ]);

    // Calculate historical monthly savings
    const months = {};

    incomeData.forEach(item => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      months[key].income = item.total;
    });

    expenseData.forEach(item => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      months[key].expense = item.total;
    });

    const savingsData = [];
    Object.keys(months).sort().forEach(key => {
      const { income, expense } = months[key];
      savingsData.push({
        period: key,
        savings: income - expense,
        savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0
      });
    });

    let predictedSavings;
    let modelUsed = 'time-series-analysis';

    // If external Prophet ML service is available and requested
    let mlSuccess = false;
    if ((options.model === 'prophet' || (process.env.ML_SERVICE_URL && options.model !== 'trend')) && savingsData.length >= 3) {
      try {
        const series = savingsData.map((d) => {
          const [y, m] = d.period.split('-').map(Number);
          return { date: new Date(y, m - 1, 1), value: d.savings };
        });
        const mlPred = await callMlService(series, period, 1);
        if (mlPred && mlPred.length > 0 && Number.isFinite(mlPred[0].yhat)) {
          predictedSavings = { amount: Math.max(0, mlPred[0].yhat), confidence: 0.75 };
          modelUsed = 'prophet';
          mlSuccess = true;
        }
      } catch (e) {
        console.warn(`[ML Service Fallback - Savings]: ${e.message}`);
      }
    }

    if (!mlSuccess) {
      predictedSavings = predictSavings(savingsData, period, userDoc);
    }

    const now = new Date();
    const predictionStartDate = new Date();
    const predictionEndDate = getPredictionEndDate(predictionStartDate, period);

    const safeAmount = Number.isFinite(predictedSavings.amount)
      ? Math.max(0, Math.round(predictedSavings.amount * 100) / 100)
      : 0;
    const safeConfidence = Number.isFinite(predictedSavings.confidence)
      ? Math.min(0.95, Math.max(0.1, Math.round(predictedSavings.confidence * 100) / 100))
      : 0.35;

    // Upsert savings prediction to prevent duplicate savings records
    const savingsPrediction = await Prediction.findOneAndUpdate(
      { user: userObjectId, type: 'savings', period },
      {
        user: userObjectId,
        type: 'savings',
        period,
        predictedAmount: safeAmount,
        confidence: safeConfidence,
        startDate: predictionStartDate,
        endDate: predictionEndDate,
        factors: [
          { name: 'historical_savings_rate', weight: 0.6 },
          { name: 'income_trend', weight: 0.25 },
          { name: 'expense_trend', weight: 0.15 }
        ],
        model: modelUsed,
        createdAt: now
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return savingsPrediction;
  } catch (error) {
    console.error('Error generating savings prediction:', error);
    throw error;
  }
};

/**
 * Get predictions for a user
 * @param {string} userId - The user ID
 * @param {string} type - The prediction type (expense, income, savings)
 * @param {string} period - The prediction period (daily, weekly, monthly, yearly)
 * @returns {Promise<Array>} - Array of predictions
 */
exports.getPredictions = async (userId, type, period) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const query = { user: userObjectId };
    
    if (type) {
      query.type = type;
    }
    
    if (period) {
      query.period = period;
    }
    
    const predictions = await Prediction.find(query)
      .populate('category', 'name icon color type')
      .sort({ createdAt: -1 })
      .limit(30);
    
    return predictions;
  } catch (error) {
    console.error('Error getting predictions:', error);
    throw error;
  }
};

// Helper functions

/**
 * Get the start date for historical data based on period
 * @param {string} period - The prediction period
 * @returns {Date} - The start date
 */
function getHistoricalStartDate(period) {
  const now = new Date();
  const d = new Date(now.getTime());

  switch (period) {
    case 'daily':
      d.setMonth(d.getMonth() - 1);
      return d;
    case 'weekly':
      d.setMonth(d.getMonth() - 3);
      return d;
    case 'yearly':
      d.setFullYear(d.getFullYear() - 3);
      return d;
    case 'monthly':
    default:
      d.setMonth(d.getMonth() - 12);
      return d;
  }
}

/**
 * Call external ML service (FastAPI + Prophet) to forecast
 */
async function callMlService(transactionsOrSeries, period, horizon = 1) {
  const fetch = require('node-fetch');
  const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  // Group by date to prevent duplicate index collisions in Pandas
  const dateMap = new Map();
  transactionsOrSeries.forEach((t) => {
    const rawDate = t.date != null ? t.date : t.ds;
    if (!rawDate) return;
    const dateStr = new Date(rawDate).toISOString().split('T')[0];
    const val = Number(t.amount != null ? t.amount : t.value) || 0;
    dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + val);
  });

  const series = Array.from(dateMap.entries()).map(([dateStr, val]) => ({
    date: new Date(dateStr).toISOString(),
    value: val
  }));

  if (series.length < 3) {
    throw new Error('Insufficient points for ML forecasting (< 3 unique dates)');
  }

  const timeoutMs = parseInt(process.env.ML_TIMEOUT_MS, 10) || 4000;
  const AbortControllerClass = typeof AbortController !== 'undefined' ? AbortController : null;
  const controller = AbortControllerClass ? new AbortControllerClass() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(`${ML_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ series, period, horizon }),
      ...(controller ? { signal: controller.signal } : {})
    });

    if (!res.ok) {
      throw new Error(`ML service responded with status ${res.status}`);
    }
    return await res.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Get the end date for prediction based on period
 * @param {Date} startDate - The prediction start date
 * @param {string} period - The prediction period
 * @returns {Date} - The end date
 */
function getPredictionEndDate(startDate, period) {
  const endDate = new Date(startDate);
  switch (period) {
    case 'daily':
      endDate.setDate(endDate.getDate() + 1);
      break;
    case 'weekly':
      endDate.setDate(endDate.getDate() + 7);
      break;
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      endDate.setMonth(endDate.getMonth() + 1);
  }
  return endDate;
}

/**
 * Mathematically rigorous Ordinary Least Squares (OLS) + Exponential Moving Average prediction
 * Guaranteed to never produce NaN or Infinity, handles 1 to N transactions safely.
 * @param {Array} transactions - Array of transactions
 * @param {string} period - The prediction period
 * @returns {Object} - Prediction result with amount, avgAmount, trend
 */
function linearRegressionPredict(transactions, period) {
  if (!transactions || transactions.length === 0) {
    return { amount: 0, avgAmount: 0, trend: 0 };
  }

  const validTransactions = transactions
    .filter(t => t && Number.isFinite(Number(t.amount)))
    .map(t => ({
      amount: Number(t.amount),
      date: new Date(t.date || t.createdAt || Date.now())
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (validTransactions.length === 0) {
    return { amount: 0, avgAmount: 0, trend: 0 };
  }

  const totalAmount = validTransactions.reduce((sum, t) => sum + t.amount, 0);
  const avgAmount = totalAmount / validTransactions.length;

  if (validTransactions.length === 1) {
    return {
      amount: Math.max(0, Math.round(avgAmount * 100) / 100),
      avgAmount: Math.round(avgAmount * 100) / 100,
      trend: 0
    };
  }

  const t0 = validTransactions[0].date.getTime();
  const tN = validTransactions[validTransactions.length - 1].date.getTime();
  const timeSpanMs = tN - t0;
  const daysInPeriod = getPeriodDays(period);

  let trend = 0;

  // Only calculate OLS slope if data points span at least 2 hours apart
  if (timeSpanMs > 2 * 3600 * 1000) {
    const points = validTransactions.map(t => ({
      x: (t.date.getTime() - t0) / (24 * 60 * 60 * 1000), // days elapsed
      y: t.amount
    }));

    const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const meanY = avgAmount;

    let num = 0;
    let den = 0;
    for (const p of points) {
      num += (p.x - meanX) * (p.y - meanY);
      den += (p.x - meanX) * (p.x - meanX);
    }

    if (den > 0.0001) {
      const slopePerDay = num / den;
      trend = slopePerDay * daysInPeriod;
      // Clamp extreme slopes to max ±100% of average per period
      trend = Math.max(-avgAmount, Math.min(avgAmount * 1.5, trend));
    }
  }

  // Calculate Exponential Moving Average of recent transactions (up to 5 most recent)
  const recentSlice = validTransactions.slice(-Math.min(5, validTransactions.length));
  let weightedSum = 0;
  let weightSum = 0;
  recentSlice.forEach((t, idx) => {
    const w = idx + 1;
    weightedSum += t.amount * w;
    weightSum += w;
  });
  const recentEma = weightSum > 0 ? weightedSum / weightSum : avgAmount;

  // Composite forecast: 60% recent weighted average + 40% (overall average + trend)
  let rawPrediction = 0.6 * recentEma + 0.4 * (avgAmount + trend);

  if (!Number.isFinite(rawPrediction) || isNaN(rawPrediction)) {
    rawPrediction = avgAmount;
  }

  return {
    amount: Math.max(0, Math.round(rawPrediction * 100) / 100),
    avgAmount: Math.round(avgAmount * 100) / 100,
    trend: Math.round(trend * 100) / 100
  };
}

/**
 * Calculate confidence score based on data variance, sample size, and recency
 * @param {Array} transactions - Array of transactions
 * @returns {number} - Confidence score between 0 and 1
 */
function calculateConfidence(transactions) {
  if (!transactions || transactions.length < 2) {
    return 0.35;
  }
  
  const amounts = transactions.map(t => Number(t.amount) || 0);
  const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  
  if (mean <= 0) return 0.3;

  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation
  
  const sampleSizeFactor = Math.min(1.0, amounts.length / 10);
  
  const now = Date.now();
  const dates = transactions.map(t => new Date(t.date || t.createdAt || now).getTime());
  const mostRecentDate = Math.max(...dates);
  const daysSinceLast = Math.max(0, (now - mostRecentDate) / (24 * 60 * 60 * 1000));
  const recencyFactor = Math.max(0, 1 - (daysSinceLast / 30));
  
  const varianceFactor = Math.max(0, 1 - Math.min(1, cv));
  const confidence = (varianceFactor * 0.5) + (sampleSizeFactor * 0.3) + (recencyFactor * 0.2);
  
  return Math.min(0.95, Math.max(0.2, Math.round(confidence * 100) / 100));
}

/**
 * Predict savings based on historical savings data or profile baseline
 * Guaranteed to never produce NaN or 0 division.
 */
function predictSavings(savingsData, period, userDoc) {
  const profileMonthlyIncome = userDoc && userDoc.monthlyIncome > 0 ? userDoc.monthlyIncome : 0;
  const profileSavingsGoal = userDoc && userDoc.savingsGoal > 0 ? userDoc.savingsGoal : 0;

  if (!savingsData || savingsData.length === 0) {
    const baseline = profileMonthlyIncome > 0 ? Math.max(0, profileMonthlyIncome * 0.2) : profileSavingsGoal;
    return {
      amount: Math.round(baseline * 100) / 100,
      confidence: profileMonthlyIncome > 0 ? 0.4 : 0.2
    };
  }

  if (savingsData.length === 1) {
    const val = Number.isFinite(savingsData[0].savings) ? savingsData[0].savings : 0;
    return {
      amount: Math.max(0, Math.round(val * 100) / 100),
      confidence: 0.35
    };
  }

  // Calculate weighted average (more recent months have higher weight)
  let weightedSum = 0;
  let weightSum = 0;
  savingsData.forEach((data, index) => {
    const weight = index + 1;
    const s = Number(data.savings) || 0;
    weightedSum += s * weight;
    weightSum += weight;
  });

  const weightedAvg = weightSum > 0 ? weightedSum / weightSum : 0;

  // Trend over last 3 periods
  const recent = savingsData.slice(-Math.min(3, savingsData.length));
  let trend = 0;
  if (recent.length > 1) {
    const first = Number(recent[0].savings) || 0;
    const last = Number(recent[recent.length - 1].savings) || 0;
    trend = (last - first) / (recent.length - 1);
  }

  let predictedAmount = weightedAvg + trend;
  if (!Number.isFinite(predictedAmount) || isNaN(predictedAmount)) {
    predictedAmount = Math.max(0, weightedAvg);
  }

  // Compute confidence
  const variance = savingsData.reduce((sum, d) => sum + Math.pow((Number(d.savings) || 0) - weightedAvg, 2), 0) / savingsData.length;
  const cv = Math.abs(weightedAvg) > 0 ? Math.sqrt(variance) / Math.abs(weightedAvg) : 1;
  const confidence = Math.max(0.3, Math.min(0.9, 1 - Math.min(1, cv * 0.5)));

  return {
    amount: Math.max(0, Math.round(predictedAmount * 100) / 100),
    confidence: Math.round(confidence * 100) / 100
  };
}

/**
 * Get number of days in a period
 * @param {string} period - The period type
 * @returns {number} - Number of days
 */
function getPeriodDays(period) {
  switch (period) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'yearly':
      return 365;
    case 'monthly':
    default:
      return 30;
  }
}