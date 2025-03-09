const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// @desc    Get all transactions for a user
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id })
      .populate('category', 'name icon color')
      .sort({ date: -1 });

    // Format transactions to handle string categories
    const formattedTransactions = transactions.map(t => {
      const transaction = t.toObject();
      if (typeof transaction.category === 'string') {
        transaction.category = {
          name: transaction.category,
          _id: transaction.category,
          type: transaction.type // Set type same as transaction type
        };
      }
      return transaction;
    });

    res.status(200).json({
      success: true,
      data: formattedTransactions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('category', 'name icon color');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Make sure user owns transaction
    if (transaction.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this transaction'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
exports.createTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Add user to request body
    req.body.user = req.user.id;

    // Create the transaction
    const transaction = await Transaction.create(req.body);

    // If category is a reference ID, populate it
    if (mongoose.Types.ObjectId.isValid(transaction.category)) {
      await transaction.populate('category', 'name icon color');
    } else {
      // If category is a string, format it like a category object
      transaction.category = {
        name: transaction.category,
        _id: transaction.category,
        type: transaction.type // Set type same as transaction type
      };
    }

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Make sure user owns transaction
    if (transaction.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update this transaction'
      });
    }

    transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Make sure user owns transaction
    if (transaction.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to delete this transaction'
      });
    }

    await transaction.remove();

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

// @desc    Get transaction statistics
// @route   GET /api/transactions/stats
// @access  Private
exports.getTransactionStats = async (req, res) => {
  try {
    // Get date range from query or default to current month
    const now = new Date();
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate) 
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get total income and expenses
    const [incomeStats, expenseStats, categoryStats] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'income',
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            type: 'expense',
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            user: req.user._id,
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              category: '$category',
              type: '$type'
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id.category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        {
          $unwind: '$categoryInfo'
        },
        {
          $project: {
            _id: 0,
            category: '$_id.category',
            type: '$_id.type',
            categoryName: '$categoryInfo.name',
            categoryIcon: '$categoryInfo.icon',
            categoryColor: '$categoryInfo.color',
            total: 1,
            count: 1
          }
        }
      ])
    ]);

    const totalIncome = incomeStats.length > 0 ? incomeStats[0].total : 0;
    const totalExpenses = expenseStats.length > 0 ? expenseStats[0].total : 0;
    const balance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        income: {
          total: totalIncome,
          count: incomeStats.length > 0 ? incomeStats[0].count : 0
        },
        expenses: {
          total: totalExpenses,
          count: expenseStats.length > 0 ? expenseStats[0].count : 0
        },
        balance,
        savingsRate,
        categoryBreakdown: categoryStats
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 