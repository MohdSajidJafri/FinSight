const Transaction = require('../models/Transaction');
const Prediction = require('../models/Prediction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');

/**
 * Generate expense predictions for a user
 * @param {string} userId - The user ID
 * @param {string} period - The prediction period (daily, weekly, monthly, yearly)
 * @returns {Promise<Array>} - Array of predictions
 */
exports.generateExpensePredictions = async (userId, period = 'monthly', options = {}) => {
  try {
    // Get user's expense categories
    const categories = await Category.find({ user: userId, type: 'expense' });
    
    // Get historical transactions for training data
    const transactions = await Transaction.find({
      user: userId,
      type: 'expense',
      date: { $gte: getHistoricalStartDate(period) }
    }).populate('category');

    // Get active budgets as a fallback signal when there is little/no history
    const budgets = await Budget.find({ user: userId, isActive: true });
    const budgetsByCategoryId = {};
    budgets.forEach((b) => {
      const key = typeof b.category === 'string' ? b.category : (b.category && b.category.toString());
      if (!key) return;
      budgetsByCategoryId[key] = b;
    });

    // Group transactions by category (skip string/custom categories)
    const transactionsByCategory = {};
    categories.forEach((category) => {
      const categoryId = category._id.toString();
      transactionsByCategory[category._id] = transactions.filter((t) => {
        if (!t || !t.category) return false;
        if (typeof t.category === 'string') return false;
        if (!t.category._id) return false;
        return t.category._id.toString() === categoryId;
      });
    });

    // Generate predictions for each category
    const predictions = [];
    const now = new Date();
    const predictionStartDate = new Date();
    const predictionEndDate = getPredictionEndDate(predictionStartDate, period);

    for (const category of categories) {
      const categoryId = category._id.toString();
      const categoryTransactions = transactionsByCategory[category._id] || [];
      
      let predictedAmount = 0;
      let confidence = 0.4;

      if (categoryTransactions.length > 0) {
        if (options.model === 'prophet') {
        try {
          const mlPred = await callMlService(categoryTransactions, period, 1);
          if (!mlPred || mlPred.length === 0) continue;
          const amount = mlPred[0].yhat;
          predictedAmount = Math.max(0, amount);
          confidence = 0.7; // Use interval later if needed
          predictions.push({
            user: userId,
            category: category._id,
            type: 'expense',
            period,
            predictedAmount,
            confidence,
            startDate: predictionStartDate,
            endDate: predictionEndDate,
            factors: [ { name: 'prophet', weight: 1 } ],
            model: 'prophet',
            createdAt: now
          });
          continue;
        } catch (e) {
          // Fallback to heuristic below
        }
      }

        const regression = linearRegressionPredict(categoryTransactions, period);
        predictedAmount = regression.amount;
        confidence = calculateConfidence(categoryTransactions);
      } else {
        // No transactions yet for this category: fall back to budget amount if available
        const budget = budgetsByCategoryId[categoryId];
        if (!budget) {
          // Nothing to base a prediction on
          continue;
        }
        predictedAmount = budget.amount;
        confidence = 0.4;
      }

      // Create prediction object
      predictions.push({
        user: userId,
        category: category._id,
        type: 'expense',
        period,
        predictedAmount,
        confidence,
        startDate: predictionStartDate,
        endDate: predictionEndDate,
        factors: [
          {
            name: 'historical_average',
            weight: 0.6
          },
          {
            name: 'trend',
            weight: 0.3
          },
          {
            name: 'seasonality',
            weight: 0.1
          }
        ],
        model: 'linear-regression',
        createdAt: now
      });
    }

    // Save predictions to database
    if (predictions.length > 0) {
      await Prediction.insertMany(predictions);
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
 * @returns {Promise<Object>} - Savings prediction
 */
exports.generateSavingsPrediction = async (userId, period = 'monthly', options = {}) => {
  try {
    // Get historical income and expense data
    const startDate = getHistoricalStartDate(period);
    
    const [incomeData, expenseData] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            user: userId,
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
            user: userId,
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
      ])
    ]);

    // Calculate historical savings
    const savingsData = [];
    const months = {};

    // Process income data
    incomeData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      if (!months[key]) {
        months[key] = { income: 0, expense: 0 };
      }
      months[key].income = item.total;
    });

    // Process expense data
    expenseData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      if (!months[key]) {
        months[key] = { income: 0, expense: 0 };
      }
      months[key].expense = item.total;
    });

    // Calculate savings for each month
    Object.keys(months).forEach(key => {
      const { income, expense } = months[key];
      savingsData.push({
        period: key,
        savings: income - expense,
        savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0
      });
    });

    let predictedSavings;
    if (options.model === 'prophet') {
      try {
        const series = savingsData.map((d) => {
          const [y, m] = d.period.split('-').map(Number);
          return { date: new Date(y, m - 1, 1), value: d.savings };
        });
        const mlPred = await callMlService(series, period, 1);
        predictedSavings = { amount: mlPred && mlPred[0] ? mlPred[0].yhat : 0, confidence: 0.7 };
      } catch (e) {
        predictedSavings = predictSavings(savingsData, period);
      }
    } else {
      predictedSavings = predictSavings(savingsData, period);
    }
    const now = new Date();
    const predictionStartDate = new Date();
    const predictionEndDate = getPredictionEndDate(predictionStartDate, period);

    // Create and save prediction
    const savingsPrediction = await Prediction.create({
      user: userId,
      type: 'savings',
      period,
      predictedAmount: predictedSavings.amount,
      confidence: predictedSavings.confidence,
      startDate: predictionStartDate,
      endDate: predictionEndDate,
      factors: [
        {
          name: 'historical_savings_rate',
          weight: 0.7
        },
        {
          name: 'income_trend',
          weight: 0.2
        },
        {
          name: 'expense_trend',
          weight: 0.1
        }
      ],
      model: 'time-series-analysis'
    });

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
    const query = { user: userId };
    
    if (type) {
      query.type = type;
    }
    
    if (period) {
      query.period = period;
    }
    
    // Get the most recent predictions
    const predictions = await Prediction.find(query)
      .populate('category', 'name icon color')
      .sort({ createdAt: -1 })
      .limit(20);
    
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
  const copy = (d) => new Date(d.getTime());
  const monthsAgo = (n) => {
    const d = copy(now);
    d.setMonth(d.getMonth() - n);
    return d;
  };
  const yearsAgo = (n) => {
    const d = copy(now);
    d.setFullYear(d.getFullYear() - n);
    return d;
  };

  switch (period) {
    case 'daily':
      return monthsAgo(1); // 1 month of daily data
    case 'weekly':
      return monthsAgo(3); // 3 months of weekly data
    case 'monthly':
      return monthsAgo(12); // 12 months of monthly data
    case 'yearly':
      return yearsAgo(3); // 3 years of yearly data
    default:
      return yearsAgo(1);
  }
}

// Call external ML service (Prophet) to forecast
async function callMlService(transactionsOrSeries, period, horizon) {
  const fetch = require('node-fetch');
  const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  // Normalize input to series of {date, value} for ML API
  const series = transactionsOrSeries.map((t) => ({
    date: t.date != null ? t.date : t.ds,
    value: (t.amount != null ? t.amount : t.value) ?? 0
  }));

  const timeoutMs = 2500;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const res = await fetch(`${ML_URL}/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ series, period, horizon }),
    ...(controller ? { signal: controller.signal } : {})
  });
  if (timeout) clearTimeout(timeout);
  if (!res.ok) {
    throw new Error(`ML service error: ${res.status}`);
  }
  return await res.json();
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
 * Simple linear regression prediction
 * @param {Array} transactions - Array of transactions
 * @param {string} period - The prediction period
 * @returns {Object} - Prediction result
 */
function linearRegressionPredict(transactions, period) {
  // Sort transactions by date
  transactions.sort((a, b) => a.date - b.date);
  
  // Calculate average amount
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const avgAmount = totalAmount / transactions.length;
  
  // Calculate trend
  let trend = 0;
  if (transactions.length > 1) {
    // Simple trend calculation based on first and last transaction
    const firstTransaction = transactions[0];
    const lastTransaction = transactions[transactions.length - 1];
    const timeDiff = lastTransaction.date - firstTransaction.date;
    const amountDiff = lastTransaction.amount - firstTransaction.amount;
    
    // Normalize trend based on period
    const daysInPeriod = getPeriodDays(period);
    trend = (amountDiff / timeDiff) * (daysInPeriod * 24 * 60 * 60 * 1000);
  }
  
  // Apply seasonality factor (simplified)
  const seasonalityFactor = 1.0; // Could be enhanced with more sophisticated analysis
  
  // Calculate predicted amount
  const predictedAmount = (avgAmount + trend) * seasonalityFactor;
  
  return {
    amount: Math.max(0, predictedAmount), // Ensure non-negative amount
    avgAmount,
    trend
  };
}

/**
 * Calculate confidence score based on data variance and sample size
 * @param {Array} transactions - Array of transactions
 * @returns {number} - Confidence score between 0 and 1
 */
function calculateConfidence(transactions) {
  if (transactions.length < 3) {
    return 0.3; // Low confidence for small samples
  }
  
  // Calculate mean
  const mean = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
  
  // Calculate variance
  const variance = transactions.reduce((sum, t) => sum + Math.pow(t.amount - mean, 2), 0) / transactions.length;
  
  // Calculate coefficient of variation (normalized variance)
  const cv = Math.sqrt(variance) / mean;
  
  // Calculate sample size factor (more samples = higher confidence)
  const sampleSizeFactor = Math.min(1, transactions.length / 10);
  
  // Calculate recency factor (more recent data = higher confidence)
  const now = new Date();
  const mostRecentDate = new Date(Math.max(...transactions.map(t => t.date)));
  const daysSinceLastTransaction = (now - mostRecentDate) / (24 * 60 * 60 * 1000);
  const recencyFactor = Math.max(0, 1 - (daysSinceLastTransaction / 30)); // Decay over 30 days
  
  // Calculate overall confidence
  const varianceConfidence = Math.max(0, 1 - Math.min(1, cv));
  const confidence = (varianceConfidence * 0.6) + (sampleSizeFactor * 0.3) + (recencyFactor * 0.1);
  
  return Math.min(0.95, confidence); // Cap at 0.95 to acknowledge inherent uncertainty
}

/**
 * Predict savings based on historical data
 * @param {Array} savingsData - Array of historical savings data
 * @param {string} period - The prediction period
 * @returns {Object} - Prediction result
 */
function predictSavings(savingsData, period) {
  if (savingsData.length < 3) {
    // Not enough data, use simple average
    const avgSavings = savingsData.reduce((sum, data) => sum + data.savings, 0) / savingsData.length;
    return {
      amount: Math.max(0, avgSavings),
      confidence: 0.4
    };
  }
  
  // Calculate weighted average (more recent data has higher weight)
  let weightedSum = 0;
  let weightSum = 0;
  
  savingsData.forEach((data, index) => {
    const weight = index + 1; // Linear weight increase
    weightedSum += data.savings * weight;
    weightSum += weight;
  });
  
  const weightedAvg = weightedSum / weightSum;
  
  // Calculate trend
  const recentSavings = savingsData.slice(-3); // Last 3 periods
  const trend = recentSavings.reduce((sum, data, i, arr) => {
    if (i === 0) return sum;
    return sum + (data.savings - arr[i-1].savings);
  }, 0) / (recentSavings.length - 1);
  
  // Calculate predicted amount
  const predictedAmount = weightedAvg + trend;
  
  // Calculate confidence
  const variance = savingsData.reduce((sum, data) => sum + Math.pow(data.savings - weightedAvg, 2), 0) / savingsData.length;
  const cv = Math.sqrt(variance) / Math.abs(weightedAvg);
  const confidence = Math.max(0.3, Math.min(0.9, 1 - Math.min(1, cv)));
  
  return {
    amount: Math.max(0, predictedAmount),
    confidence
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