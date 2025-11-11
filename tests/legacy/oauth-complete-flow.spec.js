const { test, expect } = require('@playwright/test');

test('Complete OAuth flow with redirect simulation', async ({ page, context }) => {
  const consoleMessages = [];
  const errors = [];
  const authStateChanges = [];

  // Capture everything
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ time: Date.now(), text });
    if (text.includes('Auth state') || text.includes('sign') || text.includes('redirect')) {
      console.log(`[CONSOLE] ${text}`);
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`[ERROR] ${error.message}`);
  });

  console.log('\n=== Step 1: Load app and check service worker ===');
  await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/');
  await page.waitForTimeout(3000);

  // Check service worker version
  const swVersion = await page.evaluate(() => {
    return navigator.serviceWorker.controller?.scriptURL || 'No SW';
  });
  console.log('Service Worker:', swVersion);

  // Check if auth gate is visible
  const authGateVisible = await page.locator('#auth-gate').isVisible();
  console.log('Auth gate visible:', authGateVisible);

  console.log('\n=== Step 2: Simulate OAuth redirect with parameters ===');

  // Simulate what happens when Google redirects back with OAuth params
  const testState = 'TEST_STATE_12345';
  const testCode = 'TEST_CODE_67890';
  const redirectUrl = `https://d13m7vzwjqe4pp.cloudfront.net/?state=${testState}&code=${testCode}`;

  console.log('Navigating to:', redirectUrl);
  await page.goto(redirectUrl);
  await page.waitForTimeout(2000);

  // Check if URL parameters are preserved
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  console.log('URL has state param:', currentUrl.includes('state='));
  console.log('URL has code param:', currentUrl.includes('code='));

  // Check what Firebase sees
  const urlParams = await page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      state: params.get('state'),
      code: params.get('code'),
      hasState: params.has('state'),
      hasCode: params.has('code'),
      allParams: Array.from(params.entries())
    };
  });

  console.log('\n=== URL Parameters Check ===');
  console.log('State param:', urlParams.state);
  console.log('Code param:', urlParams.code);
  console.log('Has state:', urlParams.hasState);
  console.log('Has code:', urlParams.hasCode);
  console.log('All params:', JSON.stringify(urlParams.allParams));

  // Check Firebase redirect result handling
  const firebaseCheck = await page.evaluate(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          firebaseExists: typeof firebase !== 'undefined',
          authExists: typeof firebase !== 'undefined' && typeof firebase.auth === 'function',
          authManagerExists: typeof authManager !== 'undefined',
          authManagerInitialized: typeof authManager !== 'undefined' && authManager.initialized
        });
      }, 1000);
    });
  });

  console.log('\n=== Firebase Status ===');
  console.log(JSON.stringify(firebaseCheck, null, 2));

  // Look for auth-related console messages
  console.log('\n=== Auth-Related Console Messages ===');
  const authMessages = consoleMessages.filter(m =>
    m.text.includes('Auth') ||
    m.text.includes('sign') ||
    m.text.includes('redirect') ||
    m.text.includes('Firebase') ||
    m.text.includes('state') ||
    m.text.includes('code')
  );
  authMessages.forEach(m => console.log(m.text));

  // Take screenshots
  await page.screenshot({ path: 'tests/screenshots/oauth-with-params.png', fullPage: true });

  console.log('\n=== Errors Found ===');
  if (errors.length === 0) {
    console.log('No errors');
  } else {
    errors.forEach(err => console.log(err));
  }

  console.log('\n=== Analysis ===');
  if (!urlParams.hasState || !urlParams.hasCode) {
    console.log('❌ PROBLEM: URL parameters were stripped by service worker!');
    console.log('Service worker is still caching the redirect and removing OAuth params.');
  } else {
    console.log('✅ URL parameters preserved correctly');
    if (!authGateVisible) {
      console.log('✅ Auth gate hidden - user is signed in');
    } else {
      console.log('❌ Auth gate still showing - Firebase did not process OAuth redirect');
    }
  }
});
