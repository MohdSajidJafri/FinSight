const express = require('express');
const { check } = require('express-validator');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categories');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Get all categories and create category
router.route('/')
  .get(getCategories)
  .post([
    check('name', 'Name is required').not().isEmpty(),
    check('type', 'Type must be either income or expense').isIn(['income', 'expense'])
  ], createCategory);

// Get, update and delete category
router.route('/:id')
  .get(getCategory)
  .put([
    check('name', 'Name is required').optional().not().isEmpty(),
    check('type', 'Type must be either income or expense').optional().isIn(['income', 'expense'])
  ], updateCategory)
  .delete(deleteCategory);

module.exports = router; 