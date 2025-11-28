module.exports = {
  testDir: './tests',
  timeout: 60000,
  workers: 3, // Run 3 tests in parallel
  fullyParallel: true, // Run tests in parallel within files

  // Ignore legacy and example tests by default
  testIgnore: [
    '**/legacy/**',
    '**/example-with-fixtures.spec.js'
  ],

  // Global test setup/teardown
  globalSetup: require.resolve('./tests/helpers/global-setup.js'),
  globalTeardown: require.resolve('./tests/helpers/global-teardown.js'),

  use: {
    baseURL: 'http://localhost:3000',

    // Test mode: append ?test=true to all URLs to bypass auth
    extraHTTPHeaders: {
      'X-Test-Mode': 'true'  // Custom header for debugging
    },

    headless: !!process.env.CI, // Run headless in CI, headed locally
    viewport: { width: 402, height: 874 }, // iPhone 16 Pro dimensions
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',

    // Trace on first retry for debugging
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'node server.js',
    port: 3000,
    timeout: 5000,
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'mobile',  // Mobile-only testing (iPhone 16 Pro)
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        viewport: { width: 402, height: 874 }
      },
    },
    // Desktop project disabled - mobile-only requirement
    // {
    //   name: 'chromium-desktop',
    //   use: {
    //     ...require('@playwright/test').devices['Desktop Chrome'],
    //     viewport: { width: 1280, height: 720 }
    //   },
    // },
  ],

  // Reporter configuration
  reporter: [
    ['list'], // CLI output
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Output directory for artifacts
  outputDir: 'test-results/artifacts',
};