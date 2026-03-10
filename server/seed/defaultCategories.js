const Category = require('../models/Category');

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'utensils', color: '#EF4444' },
  { name: 'Transportation', icon: 'car', color: '#3B82F6' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#8B5CF6' },
  { name: 'Entertainment', icon: 'film', color: '#EC4899' },
  { name: 'Bills & Utilities', icon: 'receipt', color: '#F59E0B' },
  { name: 'Health', icon: 'heart', color: '#10B981' },
  { name: 'Personal Care', icon: 'user', color: '#06B6D4' },
  { name: 'Education', icon: 'academic-cap', color: '#6366F1' },
  { name: 'Subscriptions', icon: 'credit-card', color: '#84CC16' },
  { name: 'Travel', icon: 'globe', color: '#0EA5E9' },
  { name: 'Gifts & Donations', icon: 'gift', color: '#A855F7' },
  { name: 'Other', icon: 'tag', color: '#6B7280' }
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'briefcase', color: '#10B981' },
  { name: 'Freelance', icon: 'computer', color: '#3B82F6' },
  { name: 'Investments', icon: 'chart', color: '#8B5CF6' },
  { name: 'Other Income', icon: 'tag', color: '#6B7280' }
];

/**
 * Seed default categories for a user. Creates expense and income categories.
 * @param {string} userId - MongoDB ObjectId of the user
 * @returns {Promise<Array>} Created categories
 */
async function seedDefaultCategories(userId) {
  const toCreate = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
      name: c.name,
      type: 'expense',
      icon: c.icon,
      color: c.color,
      user: userId,
      isDefault: true
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
      name: c.name,
      type: 'income',
      icon: c.icon,
      color: c.color,
      user: userId,
      isDefault: true
    }))
  ];

  const created = await Category.insertMany(toCreate);
  return created;
}

module.exports = { seedDefaultCategories, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES };
