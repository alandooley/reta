/**
 * Full OAuth Flow Test with Actual Authentication
 * This test will attempt to complete the entire sign-in flow
 */

const { test, expect } = require('@playwright/test');

test.describe('Full OAuth Authentication Flow', () => {
    test('Complete sign-in flow and check for redirect loop', async ({ page, context }) => {
        console.log('\n🔍 Starting full OAuth flow analysis...\n');

        const logs = [];
        const errors = [];
        const redirects = [];

        // Capture console
        page.on('console', msg => {
            const text = msg.text();
            logs.push({ type: msg.type(), text, time: Date.now() });
            console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${text}`);
        });

        // Capture errors
        page.on('pageerror', error => {
            errors.push({ message: error.message, stack: error.stack });
            console.log(`[PAGE ERROR] ${error.message}`);
        });

        // Track all navigation
        page.on('framenavigated', frame => {
            if (frame === page.mainFrame()) {
                const url = frame.url();
                redirects.push({ url, time: Date.now() });
                console.log(`[NAVIGATION] ${url}`);
            }
        });

        // Navigate to original app
        console.log('[TEST] Navigating to index.html...');
        await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/index.html', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await page.waitForTimeout(2000);

        // Check initial state
        console.log('[TEST] Checking initial state...');
        const initialState = await page.evaluate(() => {
            return {
                url: window.location.href,
                hasFirebase: typeof firebase !== 'undefined',
                hasAuthManager: typeof authManager !== 'undefined',
                authManagerInitialized: authManager?.initialized,
                currentUser: firebase?.auth()?.currentUser?.email || null,
                serviceWorkerState: navigator.serviceWorker.controller ? 'active' : 'none'
            };
        });
        console.log('[STATE] Initial:', JSON.stringify(initialState, null, 2));

        // Check service worker version
        const swVersion = await page.evaluate(() => {
            return new Promise((resolve) => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        // Try to get version from the service worker
                        fetch('/sw.js')
                            .then(r => r.text())
                            .then(text => {
                                const match = text.match(/const VERSION = ['"]([^'"]+)['"]/);
                                resolve(match ? match[1] : 'unknown');
                            })
                            .catch(() => resolve('error'));
                    });
                } else {
                    resolve('not-supported');
                }
            });
        });
        console.log(`[SERVICE WORKER] Version: ${swVersion}`);

        // Find and click sign-in button
        console.log('[TEST] Looking for sign-in button...');
        const signInButton = page.locator('button:has-text("Sign in with Google"), button:has-text("Sign In with Google")').first();
        const buttonExists = await signInButton.count() > 0;

        if (!buttonExists) {
            console.log('[ERROR] Sign-in button not found!');
            return;
        }

        console.log('[TEST] Clicking sign-in button...');

        // Set up navigation promise BEFORE clicking
        const navigationPromise = page.waitForURL(url => {
            const urlStr = url.toString();
            console.log(`[WAIT] Checking URL: ${urlStr}`);
            return urlStr.includes('accounts.google.com') || urlStr.includes('firebaseapp.com');
        }, { timeout: 15000 }).catch(err => {
            console.log(`[WAIT] Navigation timeout: ${err.message}`);
            return null;
        });

        // Click button
        await signInButton.click();
        console.log('[TEST] Button clicked, waiting for redirect...');

        // Wait for redirect
        await navigationPromise;
        await page.waitForTimeout(2000);

        // Check where we landed
        const currentUrl = page.url();
        console.log(`[TEST] Current URL after click: ${currentUrl}`);

        // Check if we're on Firebase handler page
        if (currentUrl.includes('firebaseapp.com/__/auth/handler')) {
            console.log('[SUCCESS] Reached Firebase auth handler');

            // Wait a bit more to see if it redirects to Google
            await page.waitForTimeout(3000);
            const finalUrl = page.url();
            console.log(`[TEST] Final URL: ${finalUrl}`);

            if (finalUrl.includes('accounts.google.com')) {
                console.log('[SUCCESS] Successfully redirected to Google sign-in page');
                console.log('[INFO] This is where you would enter credentials in real browser');

                // Check if there are any errors or issues on the Google page
                const pageContent = await page.content();
                if (pageContent.includes('error') || pageContent.includes('Error')) {
                    console.log('[WARNING] Google page may contain errors');
                }
            } else if (finalUrl.includes('firebaseapp.com')) {
                console.log('[STUCK] Still on Firebase handler page - not redirecting to Google');

                // Get page content to see what's happening
                const content = await page.textContent('body').catch(() => 'Could not read body');
                console.log('[CONTENT]', content.substring(0, 500));
            } else {
                console.log('[ERROR] Unexpected URL:', finalUrl);
            }
        } else if (currentUrl.includes('accounts.google.com')) {
            console.log('[SUCCESS] Went directly to Google sign-in');
        } else {
            console.log('[ERROR] Did not redirect to Firebase or Google');
            console.log('[ERROR] Still on:', currentUrl);
        }

        // Summary
        console.log('\n📊 Test Summary:');
        console.log(`Service Worker Version: ${swVersion}`);
        console.log(`Total Console Messages: ${logs.length}`);
        console.log(`Total Errors: ${errors.length}`);
        console.log(`Total Redirects: ${redirects.length}`);
        console.log('\nRedirect Chain:');
        redirects.forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.url}`);
        });

        if (errors.length > 0) {
            console.log('\n❌ Errors Found:');
            errors.forEach(err => {
                console.log(`  - ${err.message}`);
            });
        }

        // Take screenshot
        await page.screenshot({ path: `tests/screenshots/oauth-full-flow-${Date.now()}.png`, fullPage: true });
        console.log('\n📸 Screenshot saved');
    });

    test('Check if OAuth redirect comes back correctly', async ({ page }) => {
        console.log('\n🔍 Testing OAuth redirect return...\n');

        // Simulate coming back from OAuth with state parameter
        console.log('[TEST] Simulating OAuth return with state parameter...');

        await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/index.html?state=TEST123&code=TEST456', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await page.waitForTimeout(2000);

        // Check if URL parameters are preserved
        const urlParams = await page.evaluate(() => {
            return {
                url: window.location.href,
                search: window.location.search,
                hasState: new URLSearchParams(window.location.search).has('state'),
                hasCode: new URLSearchParams(window.location.search).has('code'),
                stateValue: new URLSearchParams(window.location.search).get('state'),
                codeValue: new URLSearchParams(window.location.search).get('code')
            };
        });

        console.log('[URL PARAMS]', JSON.stringify(urlParams, null, 2));

        if (urlParams.hasState && urlParams.hasCode) {
            console.log('✅ URL parameters preserved correctly');
        } else {
            console.log('❌ URL parameters were stripped!');
            console.log('This confirms the service worker or caching is interfering');
        }

        // Check what getRedirectResult would see
        const redirectCheck = await page.evaluate(() => {
            return new Promise((resolve) => {
                firebase.auth().getRedirectResult()
                    .then(result => {
                        resolve({
                            hasResult: !!result,
                            hasUser: !!result?.user,
                            user: result?.user?.email || null,
                            error: null
                        });
                    })
                    .catch(error => {
                        resolve({
                            hasResult: false,
                            hasUser: false,
                            user: null,
                            error: error.message
                        });
                    });
            });
        });

        console.log('[REDIRECT RESULT]', JSON.stringify(redirectCheck, null, 2));
    });

    test('Check service worker fetch interception', async ({ page }) => {
        console.log('\n🔍 Testing service worker fetch behavior...\n');

        // Navigate with OAuth parameters
        await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/index.html?state=ABC&code=XYZ');
        await page.waitForTimeout(2000);

        // Check if service worker intercepted the request
        const fetchInfo = await page.evaluate(() => {
            return {
                url: window.location.href,
                search: window.location.search,
                hasServiceWorker: !!navigator.serviceWorker.controller,
                swState: navigator.serviceWorker.controller?.state || 'none'
            };
        });

        console.log('[FETCH INFO]', JSON.stringify(fetchInfo, null, 2));

        // Check network requests
        const performanceEntries = await page.evaluate(() => {
            const entries = performance.getEntriesByType('navigation');
            if (entries.length > 0) {
                const nav = entries[0];
                return {
                    type: nav.type,
                    redirectCount: nav.redirectCount,
                    transferSize: nav.transferSize,
                    duration: nav.duration
                };
            }
            return null;
        });

        console.log('[NETWORK]', JSON.stringify(performanceEntries, null, 2));

        if (performanceEntries && performanceEntries.transferSize === 0) {
            console.log('⚠️  Transfer size is 0 - likely served from cache!');
        }
    });
});
