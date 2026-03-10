const Budget = require('../models/Budget');
const mongoose = require('mongoose');
const Category = require('../models/Category');

const CATEGORY_FIELDS = 'name type icon color';

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

// @desc    Get all budgets for a user
// @route   GET /api/budgets
// @access  Private
exports.getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find({ user: req.user.id });

    const { categoryById, idsToCast } = await resolveAndNormalizeCategoriesForUser(
      req.user.id,
      budgets,
      (b) => b.category
    );

    // Cast legacy string ObjectId categories to real ObjectIds (one-time normalization)
    const ops = [];
    budgets.forEach((b) => {
      if (typeof b.category === 'string' && idsToCast.has(b.category)) {
        ops.push({
          updateOne: {
            filter: { _id: b._id, user: req.user.id },
            update: { $set: { category: new mongoose.Types.ObjectId(b.category) } }
          }
        });
      }
    });
    if (ops.length > 0) {
      await Budget.bulkWrite(ops, { ordered: false });
    }

    const formattedBudgets = budgets.map((b) => {
      const budget = b.toObject();
      const raw = budget.category;

      // Keep populated objects
      if (raw && typeof raw === 'object' && raw.name) {
        return budget;
      }

      const id = typeof raw === 'string'
        ? raw
        : raw && mongoose.Types.ObjectId.isValid(raw)
          ? raw.toString()
          : null;

      const resolved = id ? categoryById.get(id) : null;
      if (resolved) {
        budget.category = { _id: resolved._id, name: resolved.name, icon: resolved.icon, color: resolved.color, type: resolved.type };
      } else if (typeof raw === 'string') {
        budget.category = { _id: raw, name: raw, type: 'expense' };
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

    const { categoryById } = await resolveAndNormalizeCategoriesForUser(
      req.user.id,
      [budget],
      (b) => b.category
    );

    const formatted = budget.toObject();
    const raw = formatted.category;
    const id = typeof raw === 'string'
      ? raw
      : raw && mongoose.Types.ObjectId.isValid(raw)
        ? raw.toString()
        : null;
    const resolved = id ? categoryById.get(id) : null;
    if (resolved) {
      formatted.category = { _id: resolved._id, name: resolved.name, icon: resolved.icon, color: resolved.color, type: resolved.type };
    } else if (typeof raw === 'string') {
      formatted.category = { _id: raw, name: raw, type: 'expense' };
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

// @desc    Create new budget
// @route   POST /api/budgets
// @access  Private
exports.createBudget = async (req, res) => {
  try {
    // Add user to request body
    req.body.user = req.user.id;

    // If category is a real Category ID, cast to ObjectId for consistent storage
    if (typeof req.body.category === 'string' && mongoose.Types.ObjectId.isValid(req.body.category)) {
      const existingCategory = await Category.findOne({ _id: req.body.category, user: req.user.id }).select(CATEGORY_FIELDS);
      if (existingCategory) {
        req.body.category = existingCategory._id;
      }
    }

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

    const formatted = budget.toObject();
    const raw = formatted.category;
    const id = raw && mongoose.Types.ObjectId.isValid(raw) ? raw.toString() : null;
    const resolved = id ? await Category.findOne({ _id: id, user: req.user.id }).select(CATEGORY_FIELDS) : null;
    if (resolved) {
      formatted.category = { _id: resolved._id, name: resolved.name, icon: resolved.icon, color: resolved.color, type: resolved.type };
    } else if (typeof raw === 'string') {
      formatted.category = { _id: raw, name: raw, type: 'expense' };
    }

    res.status(201).json({
      success: true,
      data: formatted
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

    // If category is a real Category ID, cast to ObjectId for consistent storage
    if (typeof req.body.category === 'string' && mongoose.Types.ObjectId.isValid(req.body.category)) {
      const existingCategory = await Category.findOne({ _id: req.body.category, user: req.user.id }).select('_id');
      if (existingCategory) {
        req.body.category = existingCategory._id;
      }
    }

    budget = await Budget.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    const formatted = budget.toObject();
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
        formatted.category = { _id: raw, name: raw, type: 'expense' };
      }
    } else if (typeof raw === 'string') {
      formatted.category = { _id: raw, name: raw, type: 'expense' };
    }

    res.status(200).json({
      success: true,
      data: formatted
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