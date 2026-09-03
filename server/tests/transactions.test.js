const request = require('supertest');
const app = require('../index');
const User = require('../models/User');
const Category = require('../models/Category');
require('./setup');

describe('Transactions & IDOR Security', () => {
  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let categoryId = '';
  let transactionId = '';

  beforeAll(async () => {
    // Register User 1
    const res1 = await request(app).post('/api/auth/register').send({
      name: 'User One',
      email: `user1_${Date.now()}@example.com`,
      password: 'Password123!'
    });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // Register User 2
    const res2 = await request(app).post('/api/auth/register').send({
      name: 'User Two',
      email: `user2_${Date.now()}@example.com`,
      password: 'Password123!'
    });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;

    // Create a Category for User 1
    const cat = await Category.create({
      user: user1Id,
      name: 'Groceries',
      type: 'expense',
      icon: 'shopping-cart',
      color: '#10B981'
    });
    categoryId = cat._id.toString();
  });

  it('POST /api/transactions should create an expense transaction with category', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        description: 'Supermarket Haul',
        amount: 85.50,
        type: 'expense',
        category: categoryId,
        date: new Date().toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(85.50);
    transactionId = res.body.data._id;
  });

  it('POST /api/transactions should create an income transaction', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        description: 'Biweekly Paycheck',
        amount: 3200,
        type: 'income',
        category: 'Salary',
        date: new Date().toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('income');
    expect(res.body.data.amount).toBe(3200);
  });

  it('POST /api/transactions should support custom category strings', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        description: 'Coffee Beans',
        amount: 18.00,
        type: 'expense',
        category: 'Artisan Coffee',
        date: new Date().toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category.name).toBe('Artisan Coffee');
  });

  it('PUT /api/transactions/:id should prevent IDOR and not allow reassigning user ownership', async () => {
    const res = await request(app)
      .put(`/api/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        amount: 90.00,
        user: user2Id // Attempting to transfer ownership
      });

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(90.00);

    // Verify in database that ownership was NOT transferred
    const checkRes = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(checkRes.status).toBe(200);
  });

  it('PUT /api/transactions/:id should reject unauthorized edits from other users', async () => {
    const res = await request(app)
      .put(`/api/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        amount: 1000.00
      });

    expect(res.status).toBe(401);
  });

  it('GET /api/transactions/stats should aggregate income, expense, and custom category breakdown', async () => {
    const res = await request(app)
      .get('/api/transactions/stats')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('income');
    expect(res.body.data).toHaveProperty('expenses');
    expect(res.body.data).toHaveProperty('balance');
    expect(res.body.data.income.total).toBeGreaterThan(0);
    expect(res.body.data.expenses.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.categoryBreakdown)).toBe(true);
  });
});
