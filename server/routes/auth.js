const express = require('express');
const { check } = require('express-validator');
const { register, login, getMe, updateMe, logout } = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Register route with validation
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  register
);

// Login route with validation
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  login
);

// Get current user route (protected)
router.get('/me', protect, getMe);

// Update current user route (protected)
router.put(
  '/me',
  protect,
  [
    check('email', 'Please include a valid email').optional().isEmail(),
    check('name', 'Name cannot be empty').optional().isString().not().isEmpty(),
    check('currency', 'Currency must be a 3-letter code').optional().isString().isLength({ min: 3, max: 3 }),
    check('monthlyIncome', 'monthlyIncome must be a number').optional().isNumeric(),
    check('savingsGoal', 'savingsGoal must be a number').optional().isNumeric()
  ],
  updateMe
);

// Logout route
router.get('/logout', protect, logout);

module.exports = router; 