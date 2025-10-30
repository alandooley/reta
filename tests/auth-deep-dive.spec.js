/**
 * Comprehensive Authentication Deep Dive Test Suite
 * Captures detailed logs, network requests, console messages, and Firebase state
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Test configuration
const TESTS = {
    original: 'https://d13m7vzwjqe4pp.cloudfront.net/index.html',
    new: 'https://d13m7vzwjqe4pp.cloudfront.net/app-new.html',
    test: 'https://d13m7vzwjqe4pp.cloudfront.net/test-auth-simple.html'
};

// Detailed logger
class TestLogger {
    constructor(testName) {
        this.testName = testName;
        this.logs = [];
        this.startTime = Date.now();
    }

    log(category, message, data = null) {
        const entry = {
            timestamp: Date.now() - this.startTime,
            time: new Date().toISOString(),
            category,
            message,
            data
        };
        this.logs.push(entry);

        const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
        console.log(`[${entry.timestamp}ms] [${category}] ${message}${dataStr}`);
    }

    save() {
        const filename = `test-logs-${this.testName}-${Date.now()}.json`;
        const filepath = path.join(__dirname, 'logs', filename);

        // Create logs directory if it doesn't exist
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filepath, JSON.stringify(this.logs, null, 2));
        console.log(`\n📝 Detailed logs saved to: ${filepath}`);
        return filepath;
    }

    summary() {
        const categories = {};
        this.logs.forEach(log => {
            categories[log.category] = (categories[log.category] || 0) + 1;
        });

        console.log('\n📊 Log Summary:');
        Object.entries(categories).forEach(([cat, count]) => {
            console.log(`  ${cat}: ${count}`);
        });
    }
}

test.describe('Authentication Deep Dive', () => {
    test.beforeEach(({ page }) => {
        // Clear all storage before each test
        page.on('console', msg => {
            const type = msg.type();
            if (type === 'error' || type === 'warning') {
                console.log(`[BROWSER ${type.toUpperCase()}] ${msg.text()}`);
            }
        });
    });

    test('Test 1: Original app (index.html) - Full auth flow analysis', async ({ page, context }) => {
        const logger = new TestLogger('original-app');
        const networkRequests = [];
        const consoleMessages = [];
        const errors = [];

        logger.log('SETUP', 'Starting test for original app (index.html)');

        // Capture all network requests
        page.on('request', request => {
            const entry = {
                url: request.url(),
                method: request.method(),
                resourceType: request.resourceType()
            };
            networkRequests.push(entry);

            if (request.url().includes('firebase') ||
                request.url().includes('auth') ||
                request.url().includes('google')) {
                logger.log('NETWORK-REQUEST', `${request.method()} ${request.url()}`, entry);
            }
        });

        // Capture network responses
        page.on('response', response => {
            const url = response.url();
            if (url.includes('firebase') || url.includes('auth') || url.includes('google')) {
                logger.log('NETWORK-RESPONSE', `${response.status()} ${url}`, {
                    status: response.status(),
                    statusText: response.statusText(),
                    url: url
                });
            }
        });

        // Capture console messages
        page.on('console', msg => {
            const entry = {
                type: msg.type(),
                text: msg.text(),
                location: msg.location()
            };
            consoleMessages.push(entry);

            const text = msg.text();
            if (text.includes('Auth') ||
                text.includes('Firebase') ||
                text.includes('auth') ||
                text.includes('sign') ||
                text.includes('redirect')) {
                logger.log('CONSOLE', `[${msg.type()}] ${text}`, entry);
            }
        });

        // Capture errors
        page.on('pageerror', error => {
            const entry = {
                message: error.message,
                stack: error.stack
            };
            errors.push(entry);
            logger.log('ERROR', error.message, entry);
        });

        // Navigate to original app
        logger.log('NAVIGATION', 'Navigating to index.html');
        await page.goto(TESTS.original, { waitUntil: 'networkidle', timeout: 30000 });
        logger.log('NAVIGATION', 'Page loaded');

        // Wait for auth-manager to initialize
        await page.waitForTimeout(2000);

        // Check initial Firebase state
        const initialState = await page.evaluate(() => {
            return {
                firebaseLoaded: typeof firebase !== 'undefined',
                authLoaded: typeof firebase?.auth !== 'undefined',
                authManagerExists: typeof authManager !== 'undefined',
                authManagerInitialized: authManager?.initialized,
                currentUser: firebase?.auth()?.currentUser?.email || null,
                windowAuthManager: typeof window.authManager !== 'undefined'
            };
        });
        logger.log('FIREBASE-STATE', 'Initial Firebase state', initialState);

        // Check for auth gate
        const authGateVisible = await page.locator('#auth-gate').isVisible().catch(() => false);
        logger.log('UI-STATE', `Auth gate visible: ${authGateVisible}`);

        // Find sign-in button
        const signInButton = page.locator('button:has-text("Sign in with Google"), button:has-text("Sign In with Google")').first();
        const buttonExists = await signInButton.count() > 0;
        logger.log('UI-STATE', `Sign-in button exists: ${buttonExists}`);

        if (buttonExists) {
            logger.log('ACTION', 'Clicking sign-in button');

            // Set up promise to wait for navigation
            const navigationPromise = page.waitForURL(url => {
                const urlStr = url.toString();
                logger.log('NAVIGATION', `URL changed to: ${urlStr}`);
                return urlStr.includes('accounts.google.com') || urlStr.includes('firebaseapp.com');
            }, { timeout: 10000 }).catch(err => {
                logger.log('ERROR', 'Navigation timeout', { error: err.message });
                return null;
            });

            // Click button
            await signInButton.click();
            logger.log('ACTION', 'Button clicked');

            // Wait for redirect or timeout
            await navigationPromise;

            // Wait a bit more
            await page.waitForTimeout(2000);

            // Check final URL
            const finalUrl = page.url();
            logger.log('NAVIGATION', `Final URL: ${finalUrl}`);

            // Check if we're on Google auth page
            if (finalUrl.includes('accounts.google.com')) {
                logger.log('SUCCESS', 'Redirected to Google auth page');
            } else if (finalUrl.includes('firebaseapp.com')) {
                logger.log('INFO', 'Redirected to Firebase domain');
            } else {
                logger.log('WARNING', 'Did not redirect to expected auth page');
            }
        } else {
            logger.log('ERROR', 'Sign-in button not found');
        }

        // Final state check
        const finalState = await page.evaluate(() => {
            return {
                url: window.location.href,
                firebaseUser: firebase?.auth()?.currentUser?.email || null,
                authManagerUser: authManager?.user?.email || null,
                localStorage: Object.keys(localStorage),
                sessionStorage: Object.keys(sessionStorage)
            };
        }).catch(err => {
            logger.log('ERROR', 'Failed to get final state', { error: err.message });
            return null;
        });
        logger.log('FINAL-STATE', 'Final application state', finalState);

        // Save screenshot
        await page.screenshot({ path: `tests/screenshots/auth-original-${Date.now()}.png`, fullPage: true });
        logger.log('SCREENSHOT', 'Screenshot saved');

        // Summary
        logger.log('SUMMARY', 'Test completed', {
            networkRequests: networkRequests.length,
            consoleMessages: consoleMessages.length,
            errors: errors.length,
            authGateVisible,
            buttonExists
        });

        logger.summary();
        logger.save();
    });

    test('Test 2: Test page (test-auth-simple.html) - Minimal auth test', async ({ page }) => {
        const logger = new TestLogger('test-page');
        const consoleMessages = [];

        logger.log('SETUP', 'Starting test for test-auth-simple.html');

        // Capture ALL console messages
        page.on('console', msg => {
            const entry = {
                type: msg.type(),
                text: msg.text(),
                location: msg.location()
            };
            consoleMessages.push(entry);
            logger.log('CONSOLE', `[${msg.type()}] ${msg.text()}`, entry);
        });

        // Navigate
        logger.log('NAVIGATION', 'Navigating to test page');
        await page.goto(TESTS.test, { waitUntil: 'networkidle', timeout: 30000 });
        logger.log('NAVIGATION', 'Page loaded');

        await page.waitForTimeout(2000);

        // Check Firebase state
        const state = await page.evaluate(() => {
            return {
                firebaseLoaded: typeof firebase !== 'undefined',
                currentUser: firebase?.auth()?.currentUser?.email || null
            };
        });
        logger.log('FIREBASE-STATE', 'Firebase state', state);

        // Click sign in
        logger.log('ACTION', 'Clicking sign-in button');
        await page.locator('#signin').click();
        logger.log('ACTION', 'Button clicked');

        // Wait for redirect
        await page.waitForTimeout(3000);

        const finalUrl = page.url();
        logger.log('NAVIGATION', `Final URL: ${finalUrl}`);

        // Take screenshot
        await page.screenshot({ path: `tests/screenshots/auth-test-${Date.now()}.png`, fullPage: true });

        logger.summary();
        logger.save();
    });

    test('Test 3: Check auth-manager.js directly', async ({ page }) => {
        const logger = new TestLogger('auth-manager-check');

        logger.log('SETUP', 'Fetching and analyzing auth-manager.js');

        // Fetch the file
        const response = await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/js/auth-manager.js');
        const content = await response.text();

        logger.log('FILE-CHECK', 'File fetched', {
            status: response.status(),
            size: content.length,
            contentType: response.headers()['content-type']
        });

        // Check for key patterns
        const checks = {
            hasAuthManagerClass: content.includes('class AuthManager'),
            hasInitialize: content.includes('async initialize()'),
            hasSignInWithGoogle: content.includes('signInWithGoogle'),
            hasGetRedirectResult: content.includes('getRedirectResult'),
            hasOnAuthStateChanged: content.includes('onAuthStateChanged'),
            hasWindowExport: content.includes('window.authManager'),
            hasAutoInitialize: content.includes('Auto-initialize'),
            hasDOMContentLoaded: content.includes('DOMContentLoaded')
        };

        logger.log('FILE-ANALYSIS', 'Code structure checks', checks);

        // Look for potential issues
        const issues = [];
        if (!checks.hasGetRedirectResult) {
            issues.push('Missing getRedirectResult handling');
        }
        if (!checks.hasAutoInitialize) {
            issues.push('Missing auto-initialization');
        }

        logger.log('FILE-ANALYSIS', `Found ${issues.length} potential issues`, { issues });

        logger.summary();
        logger.save();
    });

    test('Test 4: Compare working vs broken state', async ({ page, context }) => {
        const logger = new TestLogger('state-comparison');

        logger.log('SETUP', 'Analyzing browser state and storage');

        // Navigate to original
        await page.goto(TESTS.original);
        await page.waitForTimeout(2000);

        // Get all browser state
        const browserState = await page.evaluate(() => {
            return {
                // LocalStorage
                localStorage: Object.fromEntries(
                    Object.entries(localStorage).map(([k, v]) => {
                        try {
                            return [k, JSON.parse(v)];
                        } catch {
                            return [k, v];
                        }
                    })
                ),

                // SessionStorage
                sessionStorage: Object.fromEntries(
                    Object.entries(sessionStorage).map(([k, v]) => {
                        try {
                            return [k, JSON.parse(v)];
                        } catch {
                            return [k, v];
                        }
                    })
                ),

                // Cookies
                cookies: document.cookie,

                // Firebase config
                firebaseConfig: window.firebase?.app()?.options || null,

                // Service Worker
                serviceWorker: {
                    controller: navigator.serviceWorker.controller ? 'active' : 'none',
                    ready: 'checking'
                }
            };
        });

        logger.log('BROWSER-STATE', 'Current browser state', browserState);

        // Check service worker
        const serviceWorker = await context.serviceWorkers();
        logger.log('SERVICE-WORKER', `Active service workers: ${serviceWorker.length}`);

        // Check cookies
        const cookies = await context.cookies();
        const firebaseCookies = cookies.filter(c =>
            c.name.includes('firebase') ||
            c.domain.includes('firebase') ||
            c.domain.includes('google')
        );
        logger.log('COOKIES', `Firebase-related cookies: ${firebaseCookies.length}`, firebaseCookies);

        logger.summary();
        logger.save();
    });

    test('Test 5: Network timing and performance', async ({ page }) => {
        const logger = new TestLogger('network-timing');

        logger.log('SETUP', 'Analyzing network performance');

        await page.goto(TESTS.original);
        await page.waitForTimeout(3000);

        // Get performance metrics
        const metrics = await page.evaluate(() => {
            const perfEntries = performance.getEntriesByType('resource');

            const authRelated = perfEntries.filter(entry =>
                entry.name.includes('auth') ||
                entry.name.includes('firebase') ||
                entry.name.includes('google')
            ).map(entry => ({
                name: entry.name,
                duration: entry.duration,
                transferSize: entry.transferSize,
                type: entry.initiatorType
            }));

            return {
                authRelated,
                navigation: performance.getEntriesByType('navigation')[0],
                total: perfEntries.length
            };
        });

        logger.log('PERFORMANCE', 'Network metrics', metrics);

        logger.summary();
        logger.save();
    });
});
