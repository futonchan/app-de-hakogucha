import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'https://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    ignoreHTTPSErrors: true
  },
  use: {
    baseURL: 'https://127.0.0.1:5173',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium-iphone',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium'
      }
    },
    {
      name: 'webkit-iphone',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit'
      }
    }
  ]
});
