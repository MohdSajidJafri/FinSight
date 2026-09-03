const request = require('supertest');
const app = require('../index');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Prediction = require('../models/Prediction');
require('./setup');

describe('ML & Statistical Prediction Engine', () => {
  let authToken = '';
  let userId = '';
  let diningCategory = '';
  let rentCategory = '';

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'ML Test User',
      email: `ml_${Date.now()}@example.com`,
      password: 'Password123!',
      monthlyIncome: 5000,
      savingsGoal: 1000
    });
    authToken = res.body.token;
    userId = res.body.user.id;

    // Create Categories
    const c1 = await Category.create({ user: userId, name: 'Dining Out', type: 'expense' });
    diningCategory = c1._id.toString();

    const c2 = await Category.create({ user: userId, name: 'Rent', type: 'expense' });
    rentCategory = c2._id.toString();

    // Create realistic transaction history spanning months
    const now = new Date();
    await Transaction.create([
      // Income
      { user: userId, description: 'Paycheck 1', amount: 2500, type: 'income', category: 'Salary', date: new Date(now.getFullYear(), now.getMonth() - 2, 1) },
      { user: userId, description: 'Paycheck 2', amount: 2500, type: 'income', category: 'Salary', date: new Date(now.getFullYear(), now.getMonth() - 1, 1) },
      { user: userId, description: 'Paycheck 3', amount: 2500, type: 'income', category: 'Salary', date: new Date(now.getFullYear(), now.getMonth(), 1) },

      // Dining: variable expenses across dates
      { user: userId, description: 'Restaurant 1', amount: 45, type: 'expense', category: diningCategory, date: new Date(now.getFullYear(), now.getMonth() - 2, 5) },
      { user: userId, description: 'Restaurant 2', amount: 55, type: 'expense', category: diningCategory, date: new Date(now.getFullYear(), now.getMonth() - 1, 10) },
      { user: userId, description: 'Restaurant 3', amount: 65, type: 'expense', category: diningCategory, date: new Date(now.getFullYear(), now.getMonth(), 15) },

      // Rent: fixed expense
      { user: userId, description: 'Rent M-2', amount: 1200, type: 'expense', category: rentCategory, date: new Date(now.getFullYear(), now.getMonth() - 2, 1) },
      { user: userId, description: 'Rent M-1', amount: 1200, type: 'expense', category: rentCategory, date: new Date(now.getFullYear(), now.getMonth() - 1, 1) },
      { user: userId, description: 'Rent M0', amount: 1200, type: 'expense', category: rentCategory, date: new Date(now.getFullYear(), now.getMonth(), 1) }
    ]);
  });

  it('POST /api/predictions/expenses should generate expense forecasts with positive finite numbers', async () => {
    const res = await request(app)
      .post('/api/predictions/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ period: 'monthly' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    for (const pred of res.body.data) {
      expect(Number.isFinite(pred.predictedAmount)).toBe(true);
      expect(pred.predictedAmount).toBeGreaterThanOrEqual(0);
      expect(pred.confidence).toBeGreaterThan(0);
      expect(pred.confidence).toBeLessThanOrEqual(1);
      expect(pred.type).toBe('expense');
    }
  });

  it('Repeated calls to /api/predictions/expenses should upsert and not create duplicate records', async () => {
    await request(app)
      .post('/api/predictions/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ period: 'monthly' });

    const totalInDb = await Prediction.countDocuments({ user: userId, type: 'expense', period: 'monthly' });
    // Exactly 2 categories exist (Dining Out and Rent)
    expect(totalInDb).toBe(2);
  });

  it('POST /api/predictions/savings should generate realistic savings forecast without NaN', async () => {
    const res = await request(app)
      .post('/api/predictions/savings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ period: 'monthly' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number.isFinite(res.body.data.predictedAmount)).toBe(true);
    expect(res.body.data.predictedAmount).toBeGreaterThan(0);
    expect(res.body.data.type).toBe('savings');
    expect(res.body.data.confidence).toBeGreaterThan(0);
  });

  it('GET /api/predictions/recommendations should compute monthly averages and insights cleanly', async () => {
    const res = await request(app)
      .get('/api/predictions/recommendations')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.monthlyIncome).toBe(5000);
    expect(Number.isFinite(res.body.data.currentExpenses)).toBe(true);
    expect(Number.isFinite(res.body.data.currentSavingsRate)).toBe(true);
    expect(Array.isArray(res.body.data.categoryExpenses)).toBe(true);
    expect(Array.isArray(res.body.data.recommendations)).toBe(true);
  });

  it('Prediction engine handles transactions on identical dates without division by zero', async () => {
    const sameDate = new Date();
    const c3 = await Category.create({ user: userId, name: 'Books', type: 'expense' });
    // Add multiple transactions on the exact same millisecond
    await Transaction.create([
      { user: userId, description: 'Book 1', amount: 20, type: 'expense', category: c3._id, date: sameDate },
      { user: userId, description: 'Book 2', amount: 30, type: 'expense', category: c3._id, date: sameDate }
    ]);

    const res = await request(app)
      .post('/api/predictions/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ period: 'monthly' });

    expect(res.status).toBe(200);
    const bookPred = res.body.data.find((p) => p.category.toString() === c3._id.toString());
    expect(bookPred).toBeDefined();
    expect(Number.isFinite(bookPred.predictedAmount)).toBe(true);
    expect(bookPred.predictedAmount).toBeGreaterThan(0);
  });
});
