import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',          // only our E-2-E specs
  testMatch: /.*\.spec\.ts/,
  testIgnore: '**/*.test.*',     // ignore Jest/component tests
  retries: process.env.CI ? 2 : 0,
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});