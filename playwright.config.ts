import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration
 *
 * Framework: Playwright with TypeScript
 * Project: pharos-bmad (AI 기반 회생 파산 분석 시스템)
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Fully parallelize tests (each test runs in its own worker process)
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers on CI
  workers: process.env.CI ? 1 : undefined,

  // Test timeout: 60 seconds (increased from default 30s for complex flows)
  timeout: 60 * 1000,

  // Expect timeout: 15 seconds
  expect: {
    timeout: 15 * 1000,
  },

  // Reporter configuration
  reporter: [
    // HTML reporter with enhanced UI
    ['html', {
      outputFolder: 'test-results/html',
      open: 'never',
    }],
    // JUnit XML for CI/CD integration
    ['junit', {
      outputFile: 'test-results/junit.xml',
    }],
    // Console reporter
    ['list'],
  ],

  // Shared settings for all tests
  use: {
    // Base URL for tests (can be overridden via BASE_URL env var)
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace when retrying the test for failure (important for debugging)
    trace: 'retain-on-failure',

    // Screenshot: only on failure (reduces storage overhead)
    screenshot: 'only-on-failure',

    // Video: retain on failure (for debugging complex flows)
    video: 'retain-on-failure',

    // Action timeout: 15 seconds
    actionTimeout: 15 * 1000,

    // Navigation timeout: 30 seconds
    navigationTimeout: 30 * 1000,
  },

  // Projects: Configure browser targets
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

    // Mobile viewport testing (optional, comment out if not needed)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run your local dev server before starting the tests
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
