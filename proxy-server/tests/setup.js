/**
 * Jest Test Setup
 * 
 * Global setup and configuration for proxy server tests.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PROXY_PORT = 3004;
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.SESSION_SECRET = 'test-secret-key';
process.env.FASTAPI_URL = 'http://localhost:8000';

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  // Uncomment below to disable console output during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
  // info: jest.fn(),
}; 