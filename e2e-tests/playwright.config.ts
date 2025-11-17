import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for PagoPA Wallet E2E tests
 */
export default defineConfig({
  timeout: 120000, // 2 minutes for complex payment flows
  testMatch: ['test/playwright/**/*.spec.ts'],
  retries: 1,
  workers: 1,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['junit', { outputFile: './test_reports/playwright-results.xml' }],
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 907 },
    actionTimeout: 30000,
    navigationTimeout: 60000,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});