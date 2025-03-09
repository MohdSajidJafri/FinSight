const express = require('express');
const { check } = require('express-validator');
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats
} = require('../controllers/transactions');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Get transaction statistics
router.get('/stats', getTransactionStats);

// Get all transactions and create a transaction
router
  .route('/')
  .get(getTransactions)
  .post(
    [
      check('amount', 'Amount is required').not().isEmpty(),
      check('amount', 'Amount must be a number').isNumeric(),
      check('type', 'Type is required').not().isEmpty(),
      check('type', 'Type must be either income or expense').isIn(['income', 'expense']),
      check('category', 'Category is required').not().isEmpty()
    ],
    createTransaction
  );

// Get, update and delete a transaction
router
  .route('/:id')
  .get(getTransaction)
  .put(
    [
      check('amount', 'Amount must be a number').optional().isNumeric(),
      check('type', 'Type must be either income or expense').optional().isIn(['income', 'expense'])
    ],
    updateTransaction
  )
  .delete(deleteTransaction);

module.exports = router; 