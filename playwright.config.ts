import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: [
    '**/*.test.*',           // Ignore Jest tests
    '**/src/**',             // Ignore anything in src (Jest tests)
    '**/node_modules/**',    // Ignore node_modules
    '**/__tests__/**',       // Ignore Jest test directories
    '**/360t-kg-api/**',     // Ignore backend tests
    '**/proxy-server/**'     // Ignore proxy tests
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      VITE_API_URL: 'http://localhost:3002/api',
      NODE_ENV: 'test'
    }
  },
}); 