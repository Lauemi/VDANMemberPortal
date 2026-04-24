import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4321);
const HOST = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['line']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run preview -- --host ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-mobile-375',
      use: {
        browserName: 'chromium',
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});
