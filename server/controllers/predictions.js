const predictionService = require('../services/predictionService');
const Prediction = require('../models/Prediction');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// @desc    Generate expense predictions
// @route   POST /api/predictions/expenses
// @access  Private
exports.generateExpensePredictions = async (req, res) => {
  try {
    const { period } = req.body;
    
    // Generate predictions
    const predictions = await predictionService.generateExpensePredictions(
      req.user.id,
      period || 'monthly'
    );
    
    res.status(200).json({
      success: true,
      count: predictions.length,
      data: predictions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Error generating predictions'
    });
  }
};

// @desc    Generate savings prediction
// @route   POST /api/predictions/savings
// @access  Private
exports.generateSavingsPrediction = async (req, res) => {
  try {
    const { period } = req.body;
    
    // Generate prediction
    const prediction = await predictionService.generateSavingsPrediction(
      req.user.id,
      period || 'monthly'
    );
    
    res.status(200).json({
      success: true,
      data: prediction
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Error generating savings prediction'
    });
  }
};

// @desc    Get predictions
// @route   GET /api/predictions
// @access  Private
exports.getPredictions = async (req, res) => {
  try {
    const { type, period } = req.query;
    
    // Get predictions
    const predictions = await predictionService.getPredictions(
      req.user.id,
      type,
      period
    );
    
    res.status(200).json({
      success: true,
      count: predictions.length,
      data: predictions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Error fetching predictions'
    });
  }
};

// @desc    Get prediction by ID
// @route   GET /api/predictions/:id
// @access  Private
exports.getPrediction = async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id)
      .populate('category', 'name icon color');
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Prediction not found'
      });
    }
    
    // Make sure user owns prediction
    if (prediction.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this prediction'
      });
    }
    
    res.status(200).json({
      success: true,
      data: prediction
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get budget recommendations
// @route   GET /api/predictions/recommendations
// @access  Private
exports.getBudgetRecommendations = async (req, res) => {
  try {
    // Get user's expense categories
    const categories = await Category.find({ 
      user: req.user.id, 
      type: 'expense' 
    });
    
    // Get recent transactions
    const now = new Date();
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    
    const transactions = await Transaction.find({
      user: req.user.id,
      type: 'expense',
      date: { $gte: threeMonthsAgo }
    }).populate('category');
    
    // Get user's monthly income
    const user = await User.findById(req.user.id);
    const monthlyIncome = user.monthlyIncome || 0;
    
    // Calculate average monthly expenses by category
    const categoryExpenses = {};
    categories.forEach(category => {
      const categoryTransactions = transactions.filter(
        t => t.category && t.category._id.toString() === category._id.toString()
      );
      
      // Calculate average monthly expense for this category
      const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
      const monthlyAvg = totalAmount / 3; // 3 months of data
      
      categoryExpenses[category._id] = {
        category: {
          _id: category._id,
          name: category.name,
          icon: category.icon,
          color: category.color
        },
        monthlyAvg,
        percentOfIncome: monthlyIncome > 0 ? (monthlyAvg / monthlyIncome) * 100 : 0
      };
    });
    
    // Generate recommendations
    const recommendations = [];
    const idealSavingsRate = 0.2; // 20% of income
    const currentTotalExpenses = Object.values(categoryExpenses).reduce(
      (sum, cat) => sum + cat.monthlyAvg, 0
    );
    const currentSavingsRate = monthlyIncome > 0 
      ? (monthlyIncome - currentTotalExpenses) / monthlyIncome 
      : 0;
    
    // If savings rate is below ideal, recommend reducing expenses
    if (currentSavingsRate < idealSavingsRate && monthlyIncome > 0) {
      const targetSavings = monthlyIncome * idealSavingsRate;
      const currentSavings = monthlyIncome - currentTotalExpenses;
      const savingsGap = targetSavings - currentSavings;
      
      // Sort categories by expense amount (highest first)
      const sortedCategories = Object.values(categoryExpenses)
        .sort((a, b) => b.monthlyAvg - a.monthlyAvg);
      
      // Recommend reducing top expenses
      for (const catExpense of sortedCategories) {
        if (catExpense.monthlyAvg > 0) {
          const percentOfTotal = catExpense.monthlyAvg / currentTotalExpenses;
          const recommendedReduction = Math.min(
            catExpense.monthlyAvg * 0.1, // Reduce by 10% max
            savingsGap * percentOfTotal // Proportional to category's share of expenses
          );
          
          if (recommendedReduction > 0) {
            recommendations.push({
              type: 'reduce_expense',
              category: catExpense.category,
              currentAmount: catExpense.monthlyAvg,
              recommendedAmount: catExpense.monthlyAvg - recommendedReduction,
              savingsAmount: recommendedReduction,
              message: `Consider reducing ${catExpense.category.name} expenses by $${recommendedReduction.toFixed(2)} per month to improve your savings rate.`
            });
          }
        }
      }
    }
    
    // Add general recommendations
    recommendations.push({
      type: 'savings_rate',
      currentRate: currentSavingsRate * 100,
      targetRate: idealSavingsRate * 100,
      message: `Your current savings rate is ${(currentSavingsRate * 100).toFixed(1)}%. Aim for at least ${(idealSavingsRate * 100).toFixed(0)}% to build financial security.`
    });
    
    if (monthlyIncome === 0) {
      recommendations.push({
        type: 'add_income',
        message: 'Please update your monthly income in your profile to get more accurate budget recommendations.'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        monthlyIncome,
        currentExpenses: currentTotalExpenses,
        currentSavingsRate: currentSavingsRate * 100,
        categoryExpenses: Object.values(categoryExpenses),
        recommendations
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Error generating recommendations'
    });
  }
}; 