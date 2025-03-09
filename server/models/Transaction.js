const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount'],
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Please specify transaction type']
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
  description: {
    type: String,
    trim: true,
    maxlength: [100, 'Description cannot be more than 100 characters']
  },
  date: {
    type: Date,
    default: Date.now
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', null],
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }],
  location: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create index for faster queries
TransactionSchema.index({ user: 1, date: -1 });
TransactionSchema.index({ user: 1, category: 1 });
TransactionSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema); 