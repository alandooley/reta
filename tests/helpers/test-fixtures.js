/**
 * Custom Playwright Test Fixtures
 *
 * Extends base Playwright test with:
 * - Transaction rollback wrapper
 * - Custom domain assertions
 * - Test mode URL helper
 * - API mocking utilities
 */

const { test: base, expect } = require('@playwright/test');
const { TransactionWrapper } = require('./transaction-wrapper');
const { mockApiSuccess, mockApiError, verifyNoApiCalls } = require('./api-mock');
const { nuclearCleanup, verifyNoTestDataRemains } = require('./test-cleanup');
const {
    toHaveInLocalStorage,
    toHaveVial,
    toHaveInjection,
    toHaveWeight,
    toHaveVialVolume,
    toBeEmpty,
    toHaveSyncQueueEmpty,
} = require('./assertions');

/**
 * Extended test with custom fixtures
 */
const test = base.extend({
    /**
     * Test mode page - automatically navigates to ?test=true
     */
    testPage: async ({ page }, use) => {
        // Navigate to test mode URL
        await page.goto('/?test=true');

        // Verify test mode is active
        const isTestMode = await page.evaluate(() => window.SKIP_AUTH_INIT === true);
        if (!isTestMode) {
            throw new Error('Test mode not active! Check index.html test mode implementation');
        }

        console.log('[TEST] Test mode confirmed active');

        await use(page);
    },

    /**
     * Transaction wrapper - automatic rollback after test
     */
    transaction: async ({ page }, use) => {
        const tx = new TransactionWrapper(page);
        await tx.begin();

        await use(tx);

        // Always rollback, even if test fails
        await tx.rollback();
        console.log('[TRANSACTION] Rolled back to snapshot');
    },

    /**
     * API mock - prevents all network calls
     */
    apiMock: async ({ page }, use) => {
        await mockApiSuccess(page);
        console.log('[API MOCK] All API routes mocked');

        await use({
            success: () => mockApiSuccess(page),
            error: () => mockApiError(page),
            verify: () => verifyNoApiCalls(page),
        });
    },

    /**
     * Isolated test - combines test mode + transaction + API mock
     */
    isolated: async ({ page }, use) => {
        // Navigate to test mode
        await page.goto('/?test=true');

        // Mock all API calls
        await mockApiSuccess(page);

        // Start transaction
        const tx = new TransactionWrapper(page);
        await tx.begin();

        console.log('[ISOLATED] Test environment ready (test mode + transaction + API mock)');

        await use({ page, transaction: tx });

        // Cleanup
        await tx.rollback();
        await verifyNoTestDataRemains(page);
        console.log('[ISOLATED] Environment cleaned up');
    },
});

/**
 * Extend expect with custom matchers
 */
expect.extend({
    /**
     * Check if value exists in localStorage
     * Usage: await expect(page).toHaveInLocalStorage('retatrutide_data')
     */
    async toHaveInLocalStorage(page, key, expectedValue) {
        const result = await toHaveInLocalStorage(page, key, expectedValue);
        return result;
    },

    /**
     * Check if vial exists with expected properties
     * Usage: await expect(page).toHaveVial('vial-id', { status: 'active' })
     */
    async toHaveVial(page, vialId, expectedProps) {
        try {
            await toHaveVial(page, vialId, expectedProps);
            return {
                pass: true,
                message: () => `Expected vial ${vialId} to NOT exist or NOT match properties`,
            };
        } catch (error) {
            return {
                pass: false,
                message: () => error.message,
            };
        }
    },

    /**
     * Check if injection exists
     * Usage: await expect(page).toHaveInjection('injection-id')
     */
    async toHaveInjection(page, injectionId, expectedProps) {
        try {
            await toHaveInjection(page, injectionId, expectedProps);
            return {
                pass: true,
                message: () => `Expected injection ${injectionId} to NOT exist`,
            };
        } catch (error) {
            return {
                pass: false,
                message: () => error.message,
            };
        }
    },

    /**
     * Check if weight entry exists
     * Usage: await expect(page).toHaveWeight('weight-id')
     */
    async toHaveWeight(page, weightId, expectedProps) {
        try {
            await toHaveWeight(page, weightId, expectedProps);
            return {
                pass: true,
                message: () => `Expected weight ${weightId} to NOT exist`,
            };
        } catch (error) {
            return {
                pass: false,
                message: () => error.message,
            };
        }
    },

    /**
     * Check vial volume with tolerance
     * Usage: await expect(page).toHaveVialVolume('vial-id', 0.75, 0.01)
     */
    async toHaveVialVolume(page, vialId, expectedVolume, tolerance = 0.01) {
        try {
            await toHaveVialVolume(page, vialId, expectedVolume, tolerance);
            return {
                pass: true,
                message: () => `Expected vial ${vialId} to NOT have volume ${expectedVolume}ml`,
            };
        } catch (error) {
            return {
                pass: false,
                message: () => error.message,
            };
        }
    },

    /**
     * Check if data is empty
     * Usage: await expect(page).toBeEmpty()
     */
    async toBeEmpty(page) {
        try {
            await toBeEmpty(page);
            return {
                pass: true,
                message: () => 'Expected data to NOT be empty',
            };
        } catch (error) {
            return {
                pass: false,
                message: () => error.message,
            };
        }
    },

    /**
     * Check if sync queue is empty
     * Usage: await expect(page).toHaveSyncQueueEmpty()
     */
    async toHaveSyncQueueEmpty(page) {
        try {
            await toHaveSyncQueueEmpty(page);
            return {
                pass: true,
                message: () => 'Expected sync queue to NOT be empty',
            };
        } catch (error) {
            return {
                pass: false,
                message: () => error.message,
            };
        }
    },
});

module.exports = { test, expect };
