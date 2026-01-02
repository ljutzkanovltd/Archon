import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  /* Visual regression testing settings */
  snapshotDir: './e2e/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{-projectName}{ext}',

  /* Expect settings for visual comparisons */
  expect: {
    toHaveScreenshot: {
      /* Allow up to 1% pixel difference for anti-aliasing and timing variations */
      maxDiffPixelRatio: 0.01,
      /* Allow moderate pixel differences for dynamic content */
      maxDiffPixels: 500,
      /* Animation timeout */
      animations: 'disabled',
      /* Threshold for pixel color comparison (0-1, lower = stricter) */
      threshold: 0.2,
    },
  },

  use: {
    baseURL: 'http://localhost:3738',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /* Consistent viewport for visual regression */
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3738',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
