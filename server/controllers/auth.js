const User = require('../models/User');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { seedDefaultCategories } = require('../seed/defaultCategories');

const isDev = process.env.NODE_ENV !== 'production';

function logError(context, err) {
  console.error(`[AUTH:${context}]`, err.message);
  console.error('[STACK]', err.stack);
  if (err.name) console.error('[NAME]', err.name);
  if (err.code) console.error('[CODE]', err.code);
}

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, monthlyIncome, savingsGoal, currency } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    user = await User.create({
      name,
      email,
      password,
      ...(monthlyIncome !== undefined && { monthlyIncome: Number(monthlyIncome) }),
      ...(savingsGoal !== undefined && { savingsGoal: Number(savingsGoal) }),
      ...(currency && { currency })
    });

    // Seed default categories for new user
    await seedDefaultCategories(user._id);

    sendTokenResponse(user, 201, res);
  } catch (err) {
    logError('register', err);
    res.status(500).json({
      success: false,
      message: isDev ? err.message : 'Server error',
      ...(isDev && { errorName: err.name, errorCode: err.code })
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    logError('login', err);
    res.status(500).json({
      success: false,
      message: isDev ? err.message : 'Server error',
      ...(isDev && { errorName: err.name })
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    logError('getMe', err);
    res.status(500).json({
      success: false,
      message: isDev ? err.message : 'Server error'
    });
  }
};

// @desc    Update current logged in user
// @route   PUT /api/auth/me
// @access  Private
exports.updateMe = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const allowedFields = ['name', 'email', 'currency', 'monthlyIncome', 'savingsGoal'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
      select: '-password'
    });

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    logError('updateMe', err);
    res.status(500).json({
      success: false,
      message: isDev ? err.message : 'Server error'
    });
  }
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  const options = {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
    options.sameSite = 'none';
  }

  res.cookie('token', 'none', options);

  res.status(200).json({
    success: true,
    data: {}
  });
};

// @desc    Guest / Demo login to bypass manual authentication
// @route   POST /api/auth/guest
// @access  Public
exports.guestLogin = async (req, res) => {
  try {
    const guestEmail = 'guest@finsight.local';
    let user = await User.findOne({ email: guestEmail });

    if (!user) {
      user = await User.create({
        name: 'Demo Guest',
        email: guestEmail,
        password: 'GuestDemoPassword123!',
        monthlyIncome: 5500,
        savingsGoal: 1200,
        currency: 'USD'
      });
      await seedDefaultCategories(user._id);

      // Seed initial transactions and budgets for rich initial view
      const Category = require('../models/Category');
      const Transaction = require('../models/Transaction');
      const Budget = require('../models/Budget');

      const cats = await Category.find({ user: user._id });
      const foodCat = cats.find(c => c.name.toLowerCase().includes('food') || c.name.toLowerCase().includes('dining')) || cats[0];
      const rentCat = cats.find(c => c.name.toLowerCase().includes('rent') || c.name.toLowerCase().includes('housing')) || cats[1];
      const entertainmentCat = cats.find(c => c.name.toLowerCase().includes('entertainment')) || cats[2];

      const now = new Date();
      if (foodCat) {
        await Transaction.create([
          { user: user._id, description: 'Grocery Store Run', amount: 95.40, type: 'expense', category: foodCat._id, date: new Date(now.getFullYear(), now.getMonth(), 5) },
          { user: user._id, description: 'Coffee & Breakfast', amount: 14.50, type: 'expense', category: foodCat._id, date: new Date(now.getFullYear(), now.getMonth(), 8) }
        ]);
        await Budget.create({ user: user._id, category: foodCat._id, amount: 450, period: 'monthly' });
      }
      if (rentCat) {
        await Transaction.create({ user: user._id, description: 'Monthly Apartment Rent', amount: 1400, type: 'expense', category: rentCat._id, date: new Date(now.getFullYear(), now.getMonth(), 1) });
        await Budget.create({ user: user._id, category: rentCat._id, amount: 1500, period: 'monthly' });
      }
      if (entertainmentCat) {
        await Transaction.create({ user: user._id, description: 'Streaming Services', amount: 25.00, type: 'expense', category: entertainmentCat._id, date: new Date(now.getFullYear(), now.getMonth(), 12) });
        await Budget.create({ user: user._id, category: entertainmentCat._id, amount: 100, period: 'monthly' });
      }
      // Add a salary income transaction
      await Transaction.create({ user: user._id, description: 'Bi-weekly Direct Deposit', amount: 2750, type: 'income', category: 'Salary', date: new Date(now.getFullYear(), now.getMonth(), 1) });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    logError('guestLogin', err);
    res.status(500).json({
      success: false,
      message: 'Unable to start guest session'
    });
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30;
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
    options.sameSite = 'none';
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        monthlyIncome: user.monthlyIncome || 0,
        savingsGoal: user.savingsGoal || 0,
        currency: user.currency || 'USD'
      }
    });
}; 