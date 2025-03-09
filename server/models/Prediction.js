const mongoose = require('mongoose');

const PredictionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  type: {
    type: String,
    enum: ['expense', 'income', 'savings'],
    required: true
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    required: true
  },
  predictedAmount: {
    type: Number,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  actualAmount: {
    type: Number,
    default: null
  },
  factors: [{
    name: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      required: true
    }
  }],
  model: {
    type: String,
    required: true,
    default: 'linear-regression'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create index for faster queries
PredictionSchema.index({ user: 1, type: 1 });
PredictionSchema.index({ user: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Prediction', PredictionSchema); 