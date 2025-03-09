const express = require('express');
const {
  generateExpensePredictions,
  generateSavingsPrediction,
  getPredictions,
  getPrediction,
  getBudgetRecommendations
} = require('../controllers/predictions');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);

// Get all predictions
router.get('/', getPredictions);

// Get budget recommendations
router.get('/recommendations', getBudgetRecommendations);

// Generate expense predictions
router.post('/expenses', generateExpensePredictions);

// Generate savings prediction
router.post('/savings', generateSavingsPrediction);

// Get single prediction
router.get('/:id', getPrediction);

module.exports = router; 