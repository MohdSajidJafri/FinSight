const request = require('supertest');
const app = require('../index');
require('./setup');

describe('Health & Operational Endpoints', () => {
  it('GET / should return 200 with API operational status', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('FinSight AI API is running');
    expect(res.body.canonicalApiBase).toBe('/api');
  });

  it('GET /health/live should return 200 indicating HTTP server is alive', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /health/ready should return readiness based on database connection', async () => {
    const res = await request(app).get('/health/ready');
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    }
  });

  it('GET /health and /api/health should return comprehensive health metrics', async () => {
    const res = await request(app).get('/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('environment');

    const apiRes = await request(app).get('/api/health');
    expect([200, 503]).toContain(apiRes.status);
  });

  it('GET /api/nonexistent-route should return structured 404', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
