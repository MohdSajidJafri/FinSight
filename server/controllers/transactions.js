const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Category = require('../models/Category');

const CATEGORY_FIELDS = 'name icon color type';

async function resolveAndNormalizeCategoriesForUser(userId, records, getCategoryValue) {
  const candidateIds = new Set();

  records.forEach((r) => {
    const v = getCategoryValue(r);
    if (typeof v === 'string' && mongoose.Types.ObjectId.isValid(v)) {
      candidateIds.add(v);
    } else if (v && typeof v === 'object' && mongoose.Types.ObjectId.isValid(v)) {
      candidateIds.add(v.toString());
    }
  });

  if (candidateIds.size === 0) {
    return { categoryById: new Map(), idsToCast: new Set() };
  }

  const categories = await Category.find({
    user: userId,
    _id: { $in: Array.from(candidateIds) }
  }).select(CATEGORY_FIELDS);

  const categoryById = new Map(categories.map((c) => [c._id.toString(), c]));
  return { categoryById, idsToCast: new Set(categoryById.keys()) };
}

// @desc    Get all transactions for a user
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id })
      .sort({ date: -1 });

    const { categoryById, idsToCast } = await resolveAndNormalizeCategoriesForUser(
      req.user.id,
      transactions,
      (t) => t.category
    );

    // Cast legacy string ObjectId categories to real ObjectIds (one-time normalization)
    const ops = [];
    transactions.forEach((t) => {
      if (typeof t.category === 'string' && idsToCast.has(t.category)) {
        ops.push({
          updateOne: {
            filter: { _id: t._id, user: req.user.id },
            update: { $set: { category: new mongoose.Types.ObjectId(t.category) } }
          }
        });
      }
    });
    if (ops.length > 0) {
      await Transaction.bulkWrite(ops, { ordered: false });
    }

    const formattedTransactions = transactions.map((t) => {
      const tx = t.toObject();
      const raw = tx.category;

      // If already populated object with name, keep it
      if (raw && typeof raw === 'object' && raw.name) {
        return tx;
      }

      const id = typeof raw === 'string'
        ? raw
        : raw && mongoose.Types.ObjectId.isValid(raw)
          ? raw.toString()
          : null;

      const resolved = id ? categoryById.get(id) : null;
      if (resolved) {
        tx.category = {
          _id: resolved._id,
          name: resolved.name,
          icon: resolved.icon,
          color: resolved.color,
          type: resolved.type
        };
      } else if (typeof raw === 'string') {
        // Custom category string
        tx.category = { _id: raw, name: raw, type: tx.type };
      }

      return tx;
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
        message: 'Not authorized to access this transaction'
      });
    }

    const { categoryById } = await resolveAndNormalizeCategoriesForUser(
      req.user.id,
      [transaction],
      (t) => t.category
    );
    const tx = transaction.toObject();
    const raw = tx.category;
    const id = typeof raw === 'string'
      ? raw
      : raw && mongoose.Types.ObjectId.isValid(raw)
        ? raw.toString()
        : null;
    const resolved = id ? categoryById.get(id) : null;
    if (resolved) {
      tx.category = { _id: resolved._id, name: resolved.name, icon: resolved.icon, color: resolved.color, type: resolved.type };
    } else if (typeof raw === 'string') {
      tx.category = { _id: raw, name: raw, type: tx.type };
    }

    res.status(200).json({
      success: true,
      data: tx
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

    // If category is a real Category ID, cast to ObjectId for consistent storage
    if (typeof req.body.category === 'string' && mongoose.Types.ObjectId.isValid(req.body.category)) {
      const existingCategory = await Category.findOne({ _id: req.body.category, user: req.user.id }).select(CATEGORY_FIELDS);
      if (existingCategory) {
        req.body.category = existingCategory._id;
      }
    }

    // Create the transaction
    const transaction = await Transaction.create(req.body);

    const tx = transaction.toObject();
    const raw = tx.category;
    const id = raw && mongoose.Types.ObjectId.isValid(raw) ? raw.toString() : null;
    const resolved = id ? await Category.findOne({ _id: id, user: req.user.id }).select(CATEGORY_FIELDS) : null;
    if (resolved) {
      tx.category = { _id: resolved._id, name: resolved.name, icon: resolved.icon, color: resolved.color, type: resolved.type };
    } else if (typeof raw === 'string') {
      tx.category = { _id: raw, name: raw, type: tx.type };
    }

    res.status(201).json({
      success: true,
      data: tx
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

    // If category is a real Category ID, cast to ObjectId for consistent storage
    if (typeof req.body.category === 'string' && mongoose.Types.ObjectId.isValid(req.body.category)) {
      const existingCategory = await Category.findOne({ _id: req.body.category, user: req.user.id }).select('_id');
      if (existingCategory) {
        req.body.category = existingCategory._id;
      }
    }

    transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    const formatted = transaction.toObject();
    const raw = formatted.category;
    const id = typeof raw === 'string'
      ? raw
      : raw && mongoose.Types.ObjectId.isValid(raw)
        ? raw.toString()
        : null;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      const resolved = await Category.findOne({ _id: id, user: req.user.id }).select(CATEGORY_FIELDS);
      if (resolved) {
        formatted.category = { _id: resolved._id, name: resolved.name, icon: resolved.icon, color: resolved.color, type: resolved.type };
      } else if (typeof raw === 'string') {
        formatted.category = { _id: raw, name: raw, type: formatted.type };
      }
    } else if (typeof raw === 'string') {
      formatted.category = { _id: raw, name: raw, type: formatted.type };
    }

    res.status(200).json({
      success: true,
      data: formatted
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

    // Mongoose v7: use deleteOne instead of remove
    await transaction.deleteOne();

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