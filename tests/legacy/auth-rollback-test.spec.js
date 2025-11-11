const { test, expect } = require('@playwright/test');

test('Test rolled-back auth functionality', async ({ page }) => {
  const consoleMessages = [];
  const errors = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    console.log(`[CONSOLE] ${text}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`[ERROR] ${error.message}`);
  });

  // Navigate to the app
  console.log('Navigating to CloudFront URL...');
  await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/');

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Check if authManager is defined
  const authManagerExists = await page.evaluate(() => {
    return {
      typeofAuthManager: typeof authManager,
      windowAuthManager: typeof window.authManager,
      hasFirebase: typeof firebase !== 'undefined',
      hasFirebaseAuth: typeof firebase !== 'undefined' && typeof firebase.auth === 'function'
    };
  });

  console.log('AuthManager check:', JSON.stringify(authManagerExists, null, 2));

  // Check if auth gate is visible
  const authGateVisible = await page.locator('#auth-gate').isVisible().catch(() => false);
  console.log('Auth gate visible:', authGateVisible);

  // Check for any auth-related errors
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));

  console.log('\n=== Errors ===');
  errors.forEach(err => console.log(err));

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/auth-rollback-test.png', fullPage: true });

  // Report findings
  console.log('\n=== Summary ===');
  console.log('authManager type:', authManagerExists.typeofAuthManager);
  console.log('window.authManager type:', authManagerExists.windowAuthManager);
  console.log('Firebase loaded:', authManagerExists.hasFirebase);
  console.log('Firebase Auth available:', authManagerExists.hasFirebaseAuth);
  console.log('Errors found:', errors.length);
});
