import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testMatch: '**/*.uit.ts',
  globalSetup: require.resolve('./global-setup'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:10000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'uit',
      testDir: './or/uit',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
