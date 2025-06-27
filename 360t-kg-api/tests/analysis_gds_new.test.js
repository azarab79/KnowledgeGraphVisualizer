const request = require('supertest');
const express = require('express');
const MockGraphRepository = require('../src/repositories/MockGraphRepository');

// Create test app with mock repository
const app = express();
app.use(express.json());

const mockRepo = new MockGraphRepository();
const analysisRoutes = require('../routes/analysis')(mockRepo);
app.use('/api/analysis', analysisRoutes);

describe('New GDS Analysis Endpoints with Mock Repository', () => {
  jest.setTimeout(10000);

  describe('GET /api/analysis/clusters', () => {
    it('should return cluster analysis results', async () => {
      const res = await request(app)
        .get('/api/analysis/clusters')
        .query({ resolution: 1.0 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('modularity');
      expect(res.body).toHaveProperty('communityCount');
      expect(res.body).toHaveProperty('communities');
      expect(res.body).toHaveProperty('nodes');
      expect(res.body).toHaveProperty('edges');
      expect(res.body.modularity).toBe(0.45);
      expect(res.body.communityCount).toBe(2);
    });
  });

  describe('GET /api/analysis/hidden-links', () => {
    it('should return link prediction results', async () => {
      const res = await request(app)
        .get('/api/analysis/hidden-links')
        .query({ topN: 10, threshold: 0.5 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('predictions');
      expect(Array.isArray(res.body.predictions)).toBe(true);
      expect(res.body.predictions[0]).toHaveProperty('source');
      expect(res.body.predictions[0]).toHaveProperty('target');
      expect(res.body.predictions[0]).toHaveProperty('probability');
    });

    it('should reject invalid parameters', async () => {
      // topN negative value should fail validation
      await request(app)
        .get('/api/analysis/hidden-links')
        .query({ topN: -5, threshold: 1.2 })
        .expect(400);
    });
  });

  describe('GET /api/analysis/centrality', () => {
    it('should return centrality analysis results', async () => {
      const res = await request(app)
        .get('/api/analysis/centrality')
        .query({ type: 'degree', topN: 5 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('nodes');
      expect(res.body).toHaveProperty('edges');
      expect(Array.isArray(res.body.nodes)).toBe(true);
      expect(res.body.nodes[0]).toHaveProperty('centrality');
      expect(res.body.nodes[0]).toHaveProperty('size');
    });
  });
}); 