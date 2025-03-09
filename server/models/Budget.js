const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Please add a category'],
    validate: {
      validator: function(v) {
        return typeof v === 'string' || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'Category must be either a string or a valid category ID'
    }
  },
  amount: {
    type: Number,
    required: [true, 'Please add a budget amount']
  },
  period: {
    type: String,
    enum: ['weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, 'Notes cannot be more than 200 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create index for faster queries
BudgetSchema.index({ user: 1, category: 1 });
BudgetSchema.index({ user: 1, isActive: 1 });

// Virtual for current spending against budget
BudgetSchema.virtual('currentSpending', {
  ref: 'Transaction',
  localField: 'category',
  foreignField: 'category',
  justOne: false,
  match: function() {
    // This will be populated by the controller based on the budget period
    return { user: this.user, type: 'expense' };
  }
});

module.exports = mongoose.model('Budget', BudgetSchema); 