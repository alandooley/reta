const { test, expect } = require('@playwright/test');

test('Test sign-in button and redirect', async ({ page, context }) => {
  const consoleMessages = [];
  const errors = [];
  const networkRequests = [];

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

  // Capture network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('google') || url.includes('firebase') || url.includes('auth')) {
      networkRequests.push({
        method: request.method(),
        url: url
      });
      console.log(`[REQUEST] ${request.method()} ${url}`);
    }
  });

  // Navigate to the app
  console.log('Navigating to CloudFront URL...');
  await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Check if sign-in button exists
  const signInButton = page.locator('button:has-text("Sign in with Google")').first();
  const buttonExists = await signInButton.count() > 0;
  console.log('Sign-in button exists:', buttonExists);

  if (buttonExists) {
    // Click the sign-in button
    console.log('Clicking sign-in button...');

    // Wait for navigation to Google
    const navigationPromise = page.waitForURL(/accounts\.google\.com/, { timeout: 10000 }).catch(() => {
      console.log('Did not navigate to Google - checking what happened...');
      return null;
    });

    await signInButton.click();

    const navigated = await navigationPromise;

    if (navigated !== null) {
      console.log('✅ Successfully redirected to Google sign-in');
      console.log('Current URL:', page.url());
    } else {
      console.log('❌ Did not redirect to Google');
      console.log('Current URL:', page.url());

      // Check for any popups
      const pages = context.pages();
      console.log('Open pages:', pages.length);
    }
  }

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/auth-signin-test.png', fullPage: true });

  console.log('\n=== Network Requests ===');
  networkRequests.forEach(req => console.log(`${req.method} ${req.url}`));

  console.log('\n=== Errors ===');
  errors.forEach(err => console.log(err));
});
