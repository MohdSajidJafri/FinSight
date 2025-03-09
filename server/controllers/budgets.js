const Budget = require('../models/Budget');
const mongoose = require('mongoose');

// @desc    Get all budgets for a user
// @route   GET /api/budgets
// @access  Private
exports.getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find({ user: req.user.id })
      .populate('category', 'name type icon color');

    // Format budgets to handle string categories
    const formattedBudgets = budgets.map(b => {
      const budget = b.toObject();
      if (typeof budget.category === 'string') {
        budget.category = {
          name: budget.category,
          _id: budget.category,
          type: 'expense' // Default to expense for custom categories
        };
      }
      return budget;
    });

    res.status(200).json({
      success: true,
      count: formattedBudgets.length,
      data: formattedBudgets
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single budget
// @route   GET /api/budgets/:id
// @access  Private
exports.getBudget = async (req, res) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    res.status(200).json({
      success: true,
      data: budget
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new budget
// @route   POST /api/budgets
// @access  Private
exports.createBudget = async (req, res) => {
  try {
    // Add user to request body
    req.body.user = req.user.id;

    // Check if budget already exists for this category and period
    const existingBudget = await Budget.findOne({
      user: req.user.id,
      category: req.body.category,
      period: req.body.period,
      isActive: true
    });

    if (existingBudget) {
      return res.status(400).json({
        success: false,
        message: 'A budget already exists for this category and period'
      });
    }

    const budget = await Budget.create(req.body);

    // If category is a reference ID, populate it
    if (mongoose.Types.ObjectId.isValid(budget.category)) {
      await budget.populate('category', 'name type icon color');
    } else {
      // If category is a string, format it like a category object
      budget.category = {
        name: budget.category,
        _id: budget.category,
        type: 'expense' // Default to expense for custom categories
      };
    }

    res.status(201).json({
      success: true,
      data: budget
    });
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update budget
// @route   PUT /api/budgets/:id
// @access  Private
exports.updateBudget = async (req, res) => {
  try {
    let budget = await Budget.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    // If category or period is being changed, check for existing budget
    if (req.body.category || req.body.period) {
      const existingBudget = await Budget.findOne({
        user: req.user.id,
        category: req.body.category || budget.category,
        period: req.body.period || budget.period,
        isActive: true,
        _id: { $ne: req.params.id }
      });

      if (existingBudget) {
        return res.status(400).json({
          success: false,
          message: 'A budget already exists for this category and period'
        });
      }
    }

    budget = await Budget.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // If category is a reference ID, populate it
    if (mongoose.Types.ObjectId.isValid(budget.category)) {
      await budget.populate('category', 'name type icon color');
    } else {
      // If category is a string, format it like a category object
      budget.category = {
        name: budget.category,
        _id: budget.category,
        type: 'expense' // Default to expense for custom categories
      };
    }

    res.status(200).json({
      success: true,
      data: budget
    });
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete budget
// @route   DELETE /api/budgets/:id
// @access  Private
exports.deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 