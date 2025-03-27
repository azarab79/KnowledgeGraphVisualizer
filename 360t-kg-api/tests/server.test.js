const request = require('supertest');
const { app } = require('../server');

describe('API Endpoints', () => {
    describe('GET /api/health', () => {
        it('should return health status', async () => {
            const res = await request(app)
                .get('/api/health')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('timestamp');
        });
    });

    describe('GET /api/graph', () => {
        it('should return graph data with proper validation', async () => {
            const res = await request(app)
                .get('/api/graph')
                .query({ limit: 10 })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(Array.isArray(res.body)).toBeTruthy();
        });

        it('should handle invalid limit parameter', async () => {
            const res = await request(app)
                .get('/api/graph')
                .query({ limit: -1 })
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 errors', async () => {
            const res = await request(app)
                .get('/api/nonexistent')
                .expect('Content-Type', /json/)
                .expect(404);

            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toHaveProperty('message', 'Not Found');
        });
    });
}); 