const request = require('supertest');
const { app, driver } = require('../server');

describe('Graph API Endpoints', () => {
    let session;

    beforeAll(async () => {
        session = driver.session();
        // Set up test data
        await session.run(`
            CREATE (m1:Module {name: 'test-module', version: '1.0.0'})
            CREATE (p1:Product {name: 'test-product', product_type: 'core'})
            CREATE (m1)-[:IMPLEMENTS {version: '1.0.0'}]->(p1)
        `);
    });

    afterAll(async () => {
        // Clean up test data
        await session.run('MATCH (n) DETACH DELETE n');
        await session.close();
    });

    describe('GET /api/graph', () => {
        it('should return all relationships with default limit', async () => {
            const res = await request(app)
                .get('/api/graph')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('should respect the limit parameter', async () => {
            const res = await request(app)
                .get('/api/graph')
                .query({ limit: 1 })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBeLessThanOrEqual(1);
        });

        it('should filter by node types', async () => {
            const res = await request(app)
                .get('/api/graph')
                .query({ nodeTypes: 'Module,Product' })
                .expect('Content-Type', /json/)
                .expect(200);

            expect(Array.isArray(res.body)).toBeTruthy();
            res.body.forEach(record => {
                const startNode = record.get('n');
                const endNode = record.get('m');
                expect(['Module', 'Product']).toContain(startNode.labels[0]);
                expect(['Module', 'Product']).toContain(endNode.labels[0]);
            });
        });

        it('should handle invalid node types', async () => {
            const res = await request(app)
                .get('/api/graph')
                .query({ nodeTypes: 'InvalidType' })
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });
    });

    describe('Error Handling', () => {
        it('should handle Neo4j connection errors', async () => {
            // Temporarily break Neo4j connection
            const originalRun = session.run;
            session.run = () => Promise.reject(new Error('Connection error'));

            const res = await request(app)
                .get('/api/graph')
                .expect('Content-Type', /json/)
                .expect(500);

            expect(res.body.error).toHaveProperty('message');

            // Restore Neo4j connection
            session.run = originalRun;
        });

        it('should handle malformed queries', async () => {
            const res = await request(app)
                .get('/api/graph')
                .query({ limit: 'not-a-number' })
                .expect('Content-Type', /json/)
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });
    });
}); 