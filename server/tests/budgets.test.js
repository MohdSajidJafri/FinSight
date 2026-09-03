const request = require('supertest');
const app = require('../index');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
require('./setup');

describe('Budgets & Period Limits', () => {
  let authToken = '';
  let userId = '';
  let categoryId = '';
  let budgetId = '';

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Budget User',
      email: `budget_${Date.now()}@example.com`,
      password: 'Password123!'
    });
    authToken = res.body.token;
    userId = res.body.user.id;

    const cat = await Category.create({ user: userId, name: 'Entertainment', type: 'expense' });
    categoryId = cat._id.toString();
  });

  it('POST /api/budgets should create an active budget for a category', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        category: categoryId,
        amount: 300,
        period: 'monthly'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(300);
    budgetId = res.body.data._id;
  });

  it('POST /api/budgets should reject duplicate active budget for same category and period', async () => {
    const res = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        category: categoryId,
        amount: 400,
        period: 'monthly'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('already exists');
  });

  it('PUT /api/budgets/:id should update budget amount while preventing IDOR', async () => {
    const res = await request(app)
      .put(`/api/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 350,
        user: '64f000000000000000000999' // attempt user hijacking
      });

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(350);

    const check = await Budget.findById(budgetId);
    expect(check.user.toString()).toBe(userId);
  });

  it('GET /api/budgets should return user active budgets', async () => {
    const res = await request(app)
      .get('/api/budgets')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('DELETE /api/budgets/:id should remove the budget', async () => {
    const res = await request(app)
      .delete(`/api/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
