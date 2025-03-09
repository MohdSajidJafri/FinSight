const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: [true, 'Please specify category type']
  },
  icon: {
    type: String,
    default: 'tag'
  },
  color: {
    type: String,
    default: '#3B82F6' // Default blue color
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create index for faster queries
CategorySchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Category', CategorySchema); 