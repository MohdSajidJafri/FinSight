const request = require('supertest');
const app = require('../index');
const User = require('../models/User');
require('./setup');

describe('Authentication & User Management', () => {
  const testUser = {
    name: 'Jane Doe',
    email: `jane_${Date.now()}@example.com`,
    password: 'Password123!',
    monthlyIncome: 6500,
    savingsGoal: 1500
  };

  let authToken = '';

  it('POST /api/auth/register should register a new user and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
    authToken = res.body.token;
  });

  it('POST /api/auth/register should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/login should authenticate user with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
  });

  it('POST /api/auth/login should reject invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword999!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/auth/me should return current user profile when authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email);
    expect(res.body.data.monthlyIncome).toBe(6500);
  });

  it('GET /api/auth/me should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/guest should provide instant demo credentials and JWT', async () => {
    const res = await request(app).post('/api/auth/guest');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('guest@finsight.local');
  });

  it('GET /api/auth/logout should succeed without authentication requirement', async () => {
    const res = await request(app).get('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('User pre-save hook should NOT rehash unmodified password on profile update', async () => {
    const user = await User.findOne({ email: testUser.email });
    const originalHash = user.password;

    user.monthlyIncome = 7000;
    await user.save();

    const updatedUser = await User.findOne({ email: testUser.email });
    expect(updatedUser.password).toBe(originalHash);
    expect(updatedUser.monthlyIncome).toBe(7000);
  });
});
