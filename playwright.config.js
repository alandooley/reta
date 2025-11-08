module.exports = {
  testDir: './tests',
  timeout: 60000,
  workers: 3, // Run 3 tests in parallel
  fullyParallel: true, // Run tests in parallel within files
  use: {
    baseURL: 'http://localhost:3000',
    headless: !!process.env.CI, // Run headless in CI, headed locally
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro dimensions
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node server.js',
    port: 3000,
    timeout: 5000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 }
      },
    },
  ],
};