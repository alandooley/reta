/**
 * Test for app-new.html authentication flow
 * Captures all console messages and errors during sign-in
 */

const { test, expect } = require('@playwright/test');

test.describe('app-new.html Authentication', () => {
    let consoleMessages = [];
    let consoleErrors = [];
    let pageErrors = [];

    test.beforeEach(async ({ page }) => {
        // Clear captured messages
        consoleMessages = [];
        consoleErrors = [];
        pageErrors = [];

        // Capture all console messages
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push({
                type: msg.type(),
                text: text,
                location: msg.location()
            });

            if (msg.type() === 'error') {
                consoleErrors.push({
                    text: text,
                    location: msg.location()
                });
            }
        });

        // Capture page errors
        page.on('pageerror', error => {
            pageErrors.push({
                message: error.message,
                stack: error.stack
            });
        });
    });

    test('should load app-new.html and capture auth flow', async ({ page }) => {
        console.log('\n🧪 Starting authentication test...\n');

        // Navigate to app-new.html
        await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/app-new.html');

        // Wait for page to load
        await page.waitForLoadState('networkidle');
        console.log('✅ Page loaded');

        // Wait a bit for scripts to initialize
        await page.waitForTimeout(2000);

        // Check if auth gate is visible
        const authGate = page.locator('#auth-gate');
        const isAuthGateVisible = await authGate.isVisible();
        console.log(`Auth gate visible: ${isAuthGateVisible}`);

        // Check if window.authManager exists
        const authManagerExists = await page.evaluate(() => {
            return {
                exists: typeof window.authManager !== 'undefined',
                initialized: window.authManager?.initialized,
                type: typeof window.authManager
            };
        });
        console.log('\n📊 AuthManager status:', authManagerExists);

        // Check if firebase is loaded
        const firebaseStatus = await page.evaluate(() => {
            return {
                firebaseExists: typeof firebase !== 'undefined',
                authExists: typeof firebase?.auth !== 'undefined',
                currentUser: firebase?.auth()?.currentUser?.email || null
            };
        });
        console.log('🔥 Firebase status:', firebaseStatus);

        // Print all console messages
        console.log('\n📝 Console Messages:');
        consoleMessages.forEach(msg => {
            const prefix = msg.type === 'error' ? '❌' : msg.type === 'warning' ? '⚠️' : 'ℹ️';
            console.log(`  ${prefix} [${msg.type}] ${msg.text}`);
            if (msg.location.url) {
                console.log(`     at ${msg.location.url}:${msg.location.lineNumber}`);
            }
        });

        // Print console errors separately
        if (consoleErrors.length > 0) {
            console.log('\n❌ Console Errors:');
            consoleErrors.forEach(err => {
                console.log(`  ${err.text}`);
                if (err.location.url) {
                    console.log(`  at ${err.location.url}:${err.location.lineNumber}`);
                }
            });
        }

        // Print page errors
        if (pageErrors.length > 0) {
            console.log('\n💥 Page Errors:');
            pageErrors.forEach(err => {
                console.log(`  ${err.message}`);
                console.log(`  ${err.stack}`);
            });
        }

        // Take screenshot
        await page.screenshot({ path: 'tests/screenshots/app-new-auth.png', fullPage: true });
        console.log('\n📸 Screenshot saved to tests/screenshots/app-new-auth.png');

        // Check for specific error patterns
        const hasAuthManagerError = consoleMessages.some(msg =>
            msg.text.includes('authManager') || msg.text.includes('initialized')
        );
        const hasUndefinedError = consoleMessages.some(msg =>
            msg.text.includes('undefined') && msg.text.includes('reading')
        );

        console.log('\n🔍 Error Analysis:');
        console.log(`  AuthManager related errors: ${hasAuthManagerError}`);
        console.log(`  Undefined property errors: ${hasUndefinedError}`);

        // Try to find the sign-in button
        const signInButton = page.locator('button:has-text("Sign in with Google")');
        const signInButtonExists = await signInButton.count() > 0;
        console.log(`\n🔘 Sign-in button found: ${signInButtonExists}`);

        // Summary
        console.log('\n📋 Summary:');
        console.log(`  Total console messages: ${consoleMessages.length}`);
        console.log(`  Console errors: ${consoleErrors.length}`);
        console.log(`  Page errors: ${pageErrors.length}`);
        console.log(`  Auth gate visible: ${isAuthGateVisible}`);
        console.log(`  AuthManager exists: ${authManagerExists.exists}`);
        console.log(`  AuthManager initialized: ${authManagerExists.initialized}`);

        // Assertions
        expect(pageErrors.length, 'Should have no page errors').toBe(0);
        expect(authManagerExists.exists, 'AuthManager should exist on window').toBe(true);
    });

    test('should check auth-manager.js script loading', async ({ page }) => {
        console.log('\n🧪 Checking auth-manager.js loading...\n');

        await page.goto('https://d13m7vzwjqe4pp.cloudfront.net/app-new.html');
        await page.waitForLoadState('networkidle');

        // Check if auth-manager.js loaded successfully
        const scriptStatus = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src*="auth-manager"]'));
            return scripts.map(script => ({
                src: script.src,
                loaded: !script.error
            }));
        });

        console.log('📜 Auth Manager Scripts:', scriptStatus);

        // Check network requests for auth-manager.js
        const authManagerRequest = await page.evaluate(() => {
            return performance.getEntriesByType('resource')
                .filter(entry => entry.name.includes('auth-manager'))
                .map(entry => ({
                    url: entry.name,
                    duration: entry.duration,
                    size: entry.transferSize,
                    status: entry.responseStatus
                }));
        });

        console.log('🌐 Network Requests:', authManagerRequest);

        // Print console messages
        console.log('\n📝 Console Messages:');
        consoleMessages.forEach(msg => {
            console.log(`  [${msg.type}] ${msg.text}`);
        });
    });
});
