/**
 * Jest Configuration for KG-QA Proxy Server
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'server.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Handle ES modules and CommonJS
  transform: {},
  extensionsToTreatAsEsm: [],
  
  // Mock configuration
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  }
}; 