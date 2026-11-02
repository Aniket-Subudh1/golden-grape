import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'npm start', url: 'http://localhost:3000/api/health', reuseExistingServer: !process.env.CI },
});
