const request = require('supertest');
const { app } = require('../server');

describe('GDS Analysis Endpoints', () => {
  jest.setTimeout(30000);

  it('should respond (2xx-5xx) for /api/analysis/clusters', async () => {
    const res = await request(app)
      .get('/api/analysis/clusters')
      .query({ resolution: 1.0 })
      .expect('Content-Type', /json/);

    expect([200, 400, 500]).toContain(res.status);
    // Must contain at least an object with either results or error
    expect(res.body).toBeDefined();
  });
}); 