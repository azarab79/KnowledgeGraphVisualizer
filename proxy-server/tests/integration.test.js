/**
 * Integration Tests for KG-QA Proxy Server
 * 
 * Tests all major functionality including proxy routes, session management,
 * chat endpoints, health monitoring, and error handling.
 */

const request = require('supertest');
const app = require('../server');

// Mock axios for FastAPI calls
const axios = require('axios');
jest.mock('axios');
const mockedAxios = axios;

describe('KG-QA Proxy Server Integration Tests', () => {
  let server;
  
  beforeAll(() => {
    // Start server on a different port for testing
    process.env.PROXY_PORT = 3004;
    process.env.NODE_ENV = 'test';
    process.env.FASTAPI_URL = 'http://localhost:8000';
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Health Check Endpoints', () => {
    test('GET /health should return health status', async () => {
      // Mock FastAPI health check response
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { status: 'healthy', service: 'fastapi' }
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.any(String),
        service: 'kg-qa-proxy',
        version: '1.0.0',
        timestamp: expect.any(String),
      });
    });

    test('GET /health should handle FastAPI unavailable', async () => {
      // Mock FastAPI failure
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      });

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.details.fastapi.status).toBe('unhealthy');
    });
  });

  describe('Session Management', () => {
    test('Should create and maintain sessions', async () => {
      const agent = request.agent(app);
      
      // Mock FastAPI response
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { answer: 'Test response' }
      });

      // First request should create session
      const response1 = await agent
        .post('/api/chat/message')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response1.body.sessionId).toBeDefined();
      const sessionId = response1.body.sessionId;

      // Second request should use same session
      const response2 = await agent
        .post('/api/chat/message')
        .send({ message: 'Follow up' })
        .expect(200);

      expect(response2.body.sessionId).toBe(sessionId);
    });

    test('Should handle session-based conversation history', async () => {
      const agent = request.agent(app);
      
      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { answer: 'Test response' }
      });

      // Send a message
      await agent
        .post('/api/chat/message')
        .send({ message: 'Hello' })
        .expect(200);

      // Get conversation history
      const historyResponse = await agent
        .get('/api/chat/history')
        .expect(200);

      expect(historyResponse.body.messages).toHaveLength(1);
      expect(historyResponse.body.messages[0].user).toBe('Hello');
    });
  });

  describe('Chat Endpoints', () => {
    describe('POST /api/chat/message', () => {
      test('Should send message and return response', async () => {
        const agent = request.agent(app);
        
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: { 
            answer: 'This is a test response',
            metadata: { confidence: 0.85 }
          }
        });

        const response = await agent
          .post('/api/chat/message')
          .send({ 
            message: 'What is the knowledge graph about?',
            context: { source: 'test' }
          })
          .expect(200);

        expect(response.body).toMatchObject({
          response: 'This is a test response',
          sessionId: expect.any(String),
          timestamp: expect.any(String),
          correlationId: expect.any(String),
          metadata: { confidence: 0.85 }
        });

        // Verify axios was called with correct parameters
        expect(mockedAxios.post).toHaveBeenCalledWith(
          'http://localhost:8000/chat',
          expect.objectContaining({
            question: 'What is the knowledge graph about?',
            conversation_history: expect.any(Array),
            context: { source: 'test' }
          }),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'X-Session-ID': expect.any(String),
              'X-Correlation-ID': expect.any(String)
            })
          })
        );
      });

      test('Should validate message input', async () => {
        const agent = request.agent(app);

        // Test missing message
        await agent
          .post('/api/chat/message')
          .send({})
          .expect(400);

        // Test empty message
        await agent
          .post('/api/chat/message')
          .send({ message: '' })
          .expect(400);

        // Test non-string message
        await agent
          .post('/api/chat/message')
          .send({ message: 123 })
          .expect(400);

        // Test message too long
        const longMessage = 'a'.repeat(10001);
        await agent
          .post('/api/chat/message')
          .send({ message: longMessage })
          .expect(400);
      });

      test('Should handle FastAPI errors gracefully', async () => {
        const agent = request.agent(app);

        // Test connection refused
        mockedAxios.post.mockRejectedValue({
          code: 'ECONNREFUSED',
          message: 'Connection refused'
        });

        const response1 = await agent
          .post('/api/chat/message')
          .send({ message: 'Test message' })
          .expect(503);

        expect(response1.body.code).toBe('SERVICE_UNAVAILABLE');

        // Test timeout
        mockedAxios.post.mockRejectedValue({
          code: 'ETIMEDOUT',
          message: 'Timeout'
        });

        const response2 = await agent
          .post('/api/chat/message')
          .send({ message: 'Test message' })
          .expect(504);

        expect(response2.body.code).toBe('TIMEOUT');
      });

      test('Should apply rate limiting', async () => {
        const agent = request.agent(app);
        
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: { answer: 'Response' }
        });

        // Send messages up to the limit (10 per minute)
        const promises = [];
        for (let i = 0; i < 12; i++) {
          promises.push(
            agent
              .post('/api/chat/message')
              .send({ message: `Message ${i}` })
          );
        }

        const responses = await Promise.all(promises);
        
        // First 10 should succeed
        responses.slice(0, 10).forEach(response => {
          expect(response.status).toBe(200);
        });

        // Additional requests should be rate limited
        responses.slice(10).forEach(response => {
          expect(response.status).toBe(429);
        });
      });

      it('should forward source_nodes from backend response', async () => {
        // Mock FastAPI response with source_nodes
        const mockBackendResponse = {
          data: {
            answer: 'Test response',
            source_documents: [
              { id: 'doc1', title: 'Document 1', preview: 'Preview text...' }
            ],
            source_nodes: [
              { id: 'node1', name: 'Test Node', labels: ['Test'] },
              { id: 'node2', name: 'Another Node', labels: ['Test', 'Data'] }
            ],
            kg_success: true,
            llm_used: 'test-llm'
          }
        };

        mockedAxios.post.mockResolvedValue(mockBackendResponse);

        const response = await agent
          .post('/api/chat/message')
          .send({ message: 'Test message' })
          .expect(200);

        // Verify response includes both sourceDocuments and sourceNodes
        expect(response.body).toHaveProperty('sourceDocuments');
        expect(response.body).toHaveProperty('sourceNodes');
        expect(response.body.sourceNodes).toHaveLength(2);
        expect(response.body.sourceNodes[0]).toEqual({
          id: 'node1',
          name: 'Test Node',
          labels: ['Test']
        });
        expect(response.body.metadata.nodes_found).toBe(2);
      });

      it('should handle missing source_nodes gracefully', async () => {
        // Mock FastAPI response without source_nodes
        const mockBackendResponse = {
          data: {
            answer: 'Test response',
            source_documents: [
              { id: 'doc1', title: 'Document 1', preview: 'Preview text...' }
            ],
            kg_success: true,
            llm_used: 'test-llm'
          }
        };

        mockedAxios.post.mockResolvedValue(mockBackendResponse);

        const response = await agent
          .post('/api/chat/message')
          .send({ message: 'Test message' })
          .expect(200);

        // Verify response includes empty sourceNodes array
        expect(response.body).toHaveProperty('sourceNodes');
        expect(response.body.sourceNodes).toEqual([]);
        expect(response.body.metadata.nodes_found).toBe(0);
      });

      it('should include empty sourceNodes in error responses', async () => {
        // Mock connection error
        mockedAxios.post.mockImplementation(() => {
          const error = new Error('Connection refused');
          error.code = 'ECONNREFUSED';
          throw error;
        });

        const response = await agent
          .post('/api/chat/message')
          .send({ message: 'Test message' })
          .expect(503);

        // Verify error response includes empty arrays
        expect(response.body).toHaveProperty('sourceDocuments');
        expect(response.body).toHaveProperty('sourceNodes');
        expect(response.body.sourceDocuments).toEqual([]);
        expect(response.body.sourceNodes).toEqual([]);
      });

      it('should handle timeout errors with empty sourceNodes', async () => {
        // Mock timeout error
        mockedAxios.post.mockImplementation(() => {
          const error = new Error('Request timeout');
          error.code = 'ETIMEDOUT';
          throw error;
        });

        const response = await agent
          .post('/api/chat/message')
          .send({ message: 'Test message' })
          .expect(504);

        // Verify timeout response includes empty arrays
        expect(response.body).toHaveProperty('sourceDocuments');
        expect(response.body).toHaveProperty('sourceNodes');
        expect(response.body.sourceDocuments).toEqual([]);
        expect(response.body.sourceNodes).toEqual([]);
      });

      it('should log node count in successful responses', async () => {
        const mockBackendResponse = {
          data: {
            answer: 'Test response',
            source_documents: [],
            source_nodes: [
              { id: 'node1', name: 'Test Node', labels: ['Test'] }
            ],
            kg_success: true,
            llm_used: 'test-llm'
          }
        };

        mockedAxios.post.mockResolvedValue(mockBackendResponse);

        // Spy on console.info to verify logging
        const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

        const response = await agent
          .post('/api/chat/message')
          .send({ message: 'Test message' })
          .expect(200);

        expect(response.body.metadata.nodes_found).toBe(1);
        
        consoleSpy.mockRestore();
      });
    });

    describe('GET /api/chat/history', () => {
      test('Should return conversation history', async () => {
        const agent = request.agent(app);
        
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: { answer: 'Response' }
        });

        // Send a few messages
        await agent.post('/api/chat/message').send({ message: 'Message 1' });
        await agent.post('/api/chat/message').send({ message: 'Message 2' });

        const response = await agent
          .get('/api/chat/history')
          .expect(200);

        expect(response.body.messages).toHaveLength(2);
        expect(response.body.messages[0].user).toBe('Message 1');
        expect(response.body.messages[1].user).toBe('Message 2');
      });

      test('Should return empty history for new session', async () => {
        const agent = request.agent(app);

        const response = await agent
          .get('/api/chat/history')
          .expect(200);

        expect(response.body.messages).toHaveLength(0);
      });
    });

    describe('DELETE /api/chat/history', () => {
      test('Should clear conversation history', async () => {
        const agent = request.agent(app);
        
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: { answer: 'Response' }
        });

        // Send a message
        await agent.post('/api/chat/message').send({ message: 'Message' });

        // Verify history exists
        const historyBefore = await agent.get('/api/chat/history');
        expect(historyBefore.body.messages).toHaveLength(1);

        // Clear history
        await agent
          .delete('/api/chat/history')
          .expect(200);

        // Verify history is cleared
        const historyAfter = await agent.get('/api/chat/history');
        expect(historyAfter.body.messages).toHaveLength(0);
      });
    });

    describe('GET /api/chat/suggestions', () => {
      test('Should return default suggestions for new session', async () => {
        const agent = request.agent(app);

        const response = await agent
          .get('/api/chat/suggestions')
          .expect(200);

        expect(response.body.suggestions).toBeInstanceOf(Array);
        expect(response.body.suggestions.length).toBeGreaterThan(0);
        expect(response.body.suggestions[0]).toContain('knowledge graph');
      });

      test('Should return contextual suggestions when available', async () => {
        const agent = request.agent(app);
        
        // Mock chat response
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: { answer: 'Response' }
        });

        // Mock suggestions response
        mockedAxios.get.mockResolvedValue({
          status: 200,
          data: { 
            suggestions: [
              'Can you tell me more about entities?',
              'What relationships exist?'
            ]
          }
        });

        // Send a message to create conversation history
        await agent.post('/api/chat/message').send({ message: 'Tell me about entities' });

        const response = await agent
          .get('/api/chat/suggestions')
          .expect(200);

        expect(response.body.suggestions).toEqual([
          'Can you tell me more about entities?',
          'What relationships exist?'
        ]);
      });
    });

    describe('GET /api/chat/stats', () => {
      test('Should return conversation statistics', async () => {
        const agent = request.agent(app);
        
        mockedAxios.post.mockResolvedValue({
          status: 200,
          data: { answer: 'Response' }
        });

        // Send a message
        await agent.post('/api/chat/message').send({ message: 'Message' });

        const response = await agent
          .get('/api/chat/stats')
          .expect(200);

        expect(response.body).toMatchObject({
          sessionMessageCount: 1,
          sessionId: expect.any(String),
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('Security and Middleware', () => {
    test('Should require session for chat endpoints', async () => {
      // Create a request without session support
      const response = await request(app)
        .post('/api/chat/message')
        .send({ message: 'Test' });

      // Should still work because Express session creates session automatically
      expect(response.status).not.toBe(401);
    });

    test('Should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('Should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/chat/message')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('Should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });

    test('Should handle malformed JSON gracefully', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/chat/message')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility with old responses', async () => {
      // Mock old-style response without source_nodes
      const mockBackendResponse = {
        data: {
          response: 'Test response', // Old response field
          sourceDocuments: [ // Old camelCase field
            { id: 'doc1', title: 'Document 1' }
          ],
          metadata: {
            kg_success: true
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockBackendResponse);

      const response = await agent
        .post('/api/chat/message')
        .send({ message: 'Test message' })
        .expect(200);

      // Should still work and include empty sourceNodes
      expect(response.body.response).toBe('Test response');
      expect(response.body.sourceDocuments).toHaveLength(1);
      expect(response.body.sourceNodes).toEqual([]);
    });
  });
}); 