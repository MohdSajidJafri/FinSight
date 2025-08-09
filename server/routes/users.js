const express = require('express');
const { check } = require('express-validator');
const { protect } = require('../middleware/auth');
const { getMe, updateMe, changePassword } = require('../controllers/users');

const router = express.Router();

// Protect all routes
router.use(protect);

router.get('/me', getMe);

router.put(
  '/me',
  [
    check('email', 'Please include a valid email').optional().isEmail(),
    check('name', 'Name cannot be empty').optional().isString().not().isEmpty(),
    check('currency', 'Currency must be a valid code').optional().isString().isLength({ min: 3, max: 3 }),
    check('monthlyIncome', 'monthlyIncome must be a number').optional().isNumeric(),
    check('savingsGoal', 'savingsGoal must be a number').optional().isNumeric()
  ],
  updateMe
);

module.exports = router;

// Password change
router.post(
  '/password',
  [
    check('currentPassword', 'Current password is required').isString().isLength({ min: 6 }),
    check('newPassword', 'New password must be at least 6 characters').isString().isLength({ min: 6 })
  ],
  changePassword
);

