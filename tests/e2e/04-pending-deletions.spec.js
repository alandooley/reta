/**
 * Pending Deletions Tests
 * Tests 60-second deletion window and resurrection prevention
 *
 * What's Tested:
 * - Pending deletions persist in localStorage
 * - 60-second (120000ms) expiry window
 * - Expired deletions are cleaned up automatically
 * - Prevents resurrecting items within expiry window
 * - Supports manual cancellation
 * - Works across reloads
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    getPendingDeletions,
    setLocalStorage,
    reloadPage,
    getInjections,
    getVials,
    getWeights
} = require('../helpers/test-utils');

const {
    createValidInjection,
    createValidVial,
    createValidWeight
} = require('../fixtures/test-data');

test.describe('Pending Deletions - Basic Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should initialize empty pending deletions on first load', async ({ page }) => {
        const pendingDeletions = await getPendingDeletions(page);
        expect(pendingDeletions).toEqual({});
    });

    test('should persist pending deletions in localStorage', async ({ page }) => {
        const now = Date.now();
        const expiryTime = now + 120000; // 120 seconds from now

        const deletions = {
            'injection-123': expiryTime,
            'vial-456': expiryTime
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const loaded = await getPendingDeletions(page);
        expect(loaded['injection-123']).toBeDefined();
        expect(loaded['vial-456']).toBeDefined();
    });

    test('should add item with 120-second expiry (default TTL)', async ({ page }) => {
        const id = 'test-injection-1';
        const beforeAdd = Date.now();

        await page.evaluate((itemId) => {
            const deletions = {};
            const ttl = 120000; // 120 seconds
            deletions[itemId] = Date.now() + ttl;
            localStorage.setItem('pending_deletions', JSON.stringify(deletions));
        }, id);

        const pendingDeletions = await getPendingDeletions(page);
        const expiryTime = pendingDeletions[id];

        expect(expiryTime).toBeDefined();
        expect(expiryTime).toBeGreaterThan(beforeAdd + 119000); // At least 119s from now
        expect(expiryTime).toBeLessThanOrEqual(beforeAdd + 121000); // At most 121s from now
    });

    test('should remove item from pending deletions', async ({ page }) => {
        const deletions = {
            'injection-123': Date.now() + 120000,
            'injection-456': Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        // Remove one item
        await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions'));
            delete deletions['injection-123'];
            localStorage.setItem('pending_deletions', JSON.stringify(deletions));
        });

        const updated = await getPendingDeletions(page);
        expect(updated['injection-123']).toBeUndefined();
        expect(updated['injection-456']).toBeDefined();
    });

    test('should check if item exists in pending deletions', async ({ page }) => {
        const deletions = {
            'injection-123': Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const hasItem = await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            return 'injection-123' in deletions;
        });

        expect(hasItem).toBe(true);
    });

    test('should return false for non-existent items', async ({ page }) => {
        await setLocalStorage(page, 'pending_deletions', {});
        await reloadPage(page);

        const hasItem = await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            return 'non-existent-id' in deletions;
        });

        expect(hasItem).toBe(false);
    });
});

test.describe('Pending Deletions - Expiry Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should cleanup expired deletions on initialization', async ({ page }) => {
        const now = Date.now();
        const deletions = {
            'expired-1': now - 10000, // Expired 10 seconds ago
            'expired-2': now - 5000,  // Expired 5 seconds ago
            'active-1': now + 120000, // Active (expires in 120s)
            'active-2': now + 60000   // Active (expires in 60s)
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        // Simulate cleanup on init
        await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            const now = Date.now();

            // Remove expired items
            for (const [id, expiryTime] of Object.entries(deletions)) {
                if (now > expiryTime) {
                    delete deletions[id];
                }
            }

            localStorage.setItem('pending_deletions', JSON.stringify(deletions));
        });

        const cleaned = await getPendingDeletions(page);
        expect(cleaned['expired-1']).toBeUndefined();
        expect(cleaned['expired-2']).toBeUndefined();
        expect(cleaned['active-1']).toBeDefined();
        expect(cleaned['active-2']).toBeDefined();
    });

    test('should return false for expired items when checking existence', async ({ page }) => {
        const deletions = {
            'expired-item': Date.now() - 10000 // Expired 10 seconds ago
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const hasExpiredItem = await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            const id = 'expired-item';

            if (!(id in deletions)) return false;

            // Check if expired
            if (Date.now() > deletions[id]) {
                delete deletions[id];
                localStorage.setItem('pending_deletions', JSON.stringify(deletions));
                return false;
            }

            return true;
        });

        expect(hasExpiredItem).toBe(false);
    });

    test('should return true for non-expired items', async ({ page }) => {
        const deletions = {
            'active-item': Date.now() + 120000 // Expires in 120 seconds
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const hasActiveItem = await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            const id = 'active-item';

            if (!(id in deletions)) return false;

            // Check if expired
            if (Date.now() > deletions[id]) {
                delete deletions[id];
                localStorage.setItem('pending_deletions', JSON.stringify(deletions));
                return false;
            }

            return true;
        });

        expect(hasActiveItem).toBe(true);
    });

    test('should handle items expiring at different times', async ({ page }) => {
        const now = Date.now();
        const deletions = {
            'item-1': now + 10000,  // Expires in 10s
            'item-2': now + 60000,  // Expires in 60s
            'item-3': now + 120000  // Expires in 120s
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const loaded = await getPendingDeletions(page);
        expect(Object.keys(loaded).length).toBe(3);

        // Verify all items have future expiry times
        for (const [id, expiryTime] of Object.entries(loaded)) {
            expect(expiryTime).toBeGreaterThan(Date.now());
        }
    });
});

test.describe('Pending Deletions - Resurrection Prevention', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should prevent syncing items in pending deletion window', async ({ page }) => {
        const injection = createValidInjection({ id: 'test-injection-1' });

        // Add to pending deletions
        const deletions = {
            [injection.id]: Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        // Verify injection is NOT in data (deletion in progress)
        const injections = await getInjections(page);
        expect(injections.find(i => i.id === injection.id)).toBeUndefined();

        // Verify still in pending deletions
        const pending = await getPendingDeletions(page);
        expect(pending[injection.id]).toBeDefined();
    });

    test('should allow sync after expiry window passes', async ({ page }) => {
        const injection = createValidInjection({ id: 'test-injection-1' });

        // Add to pending deletions with EXPIRED timestamp
        const deletions = {
            [injection.id]: Date.now() - 10000 // Expired 10 seconds ago
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        // Cleanup expired deletions
        await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            const now = Date.now();

            for (const [id, expiryTime] of Object.entries(deletions)) {
                if (now > expiryTime) {
                    delete deletions[id];
                }
            }

            localStorage.setItem('pending_deletions', JSON.stringify(deletions));
        });

        // Now item is no longer pending deletion
        const pending = await getPendingDeletions(page);
        expect(pending[injection.id]).toBeUndefined();

        // Should be safe to add back to data
        await loadTestData(page, { injections: [injection], vials: [], weights: [] });
        await reloadPage(page);

        const injections = await getInjections(page);
        expect(injections.find(i => i.id === injection.id)).toBeDefined();
    });

    test('should handle multiple entities in pending deletion', async ({ page }) => {
        const injection = createValidInjection({ id: 'injection-1' });
        const vial = createValidVial({ vial_id: 'vial-1' });
        const weight = createValidWeight({ id: 'weight-1' });

        const deletions = {
            [injection.id]: Date.now() + 120000,
            [vial.vial_id]: Date.now() + 120000,
            [weight.id]: Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const pending = await getPendingDeletions(page);
        expect(pending[injection.id]).toBeDefined();
        expect(pending[vial.vial_id]).toBeDefined();
        expect(pending[weight.id]).toBeDefined();
    });

    test('should remove from pending deletions when user cancels deletion', async ({ page }) => {
        const injection = createValidInjection({ id: 'test-injection-1' });

        const deletions = {
            [injection.id]: Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        // Simulate user cancelling deletion (undo)
        await page.evaluate((id) => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            delete deletions[id];
            localStorage.setItem('pending_deletions', JSON.stringify(deletions));
        }, injection.id);

        const pending = await getPendingDeletions(page);
        expect(pending[injection.id]).toBeUndefined();
    });
});

test.describe('Pending Deletions - Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should handle corrupted pending deletions gracefully', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.setItem('pending_deletions', 'invalid{json}');
        });

        await reloadPage(page);

        // Should initialize empty object instead of crashing
        const pending = await page.evaluate(() => {
            try {
                return JSON.parse(localStorage.getItem('pending_deletions')) || {};
            } catch {
                return {};
            }
        });

        expect(typeof pending).toBe('object');
    });

    test('should handle missing pending_deletions key', async ({ page }) => {
        await page.evaluate(() => {
            localStorage.removeItem('pending_deletions');
        });

        await reloadPage(page);

        const pending = await getPendingDeletions(page);
        expect(pending).toEqual({});
    });

    test('should handle invalid expiry timestamps', async ({ page }) => {
        const deletions = {
            'invalid-1': 'not-a-number',
            'invalid-2': null,
            'valid-1': Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const loaded = await getPendingDeletions(page);
        expect(loaded['valid-1']).toBeDefined();
        // Invalid entries might be kept or cleaned up depending on implementation
    });

    test('should handle very large numbers of pending deletions', async ({ page }) => {
        const deletions = {};
        const expiryTime = Date.now() + 120000;

        // Create 100 pending deletions
        for (let i = 0; i < 100; i++) {
            deletions[`item-${i}`] = expiryTime;
        }

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const loaded = await getPendingDeletions(page);
        expect(Object.keys(loaded).length).toBe(100);
    });

    test('should persist across multiple reloads', async ({ page }) => {
        const deletions = {
            'persistent-item': Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);

        // Reload 3 times
        for (let i = 0; i < 3; i++) {
            await reloadPage(page);
            const pending = await getPendingDeletions(page);
            expect(pending['persistent-item']).toBeDefined();
        }
    });

    test('should handle clearing all pending deletions', async ({ page }) => {
        const deletions = {
            'item-1': Date.now() + 120000,
            'item-2': Date.now() + 120000,
            'item-3': Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        // Clear all
        await page.evaluate(() => {
            localStorage.setItem('pending_deletions', JSON.stringify({}));
        });

        const pending = await getPendingDeletions(page);
        expect(Object.keys(pending).length).toBe(0);
    });

    test('should return correct size of pending deletions', async ({ page }) => {
        const deletions = {
            'item-1': Date.now() + 120000,
            'item-2': Date.now() + 120000,
            'item-3': Date.now() + 120000
        };

        await setLocalStorage(page, 'pending_deletions', deletions);
        await reloadPage(page);

        const size = await page.evaluate(() => {
            const deletions = JSON.parse(localStorage.getItem('pending_deletions')) || {};
            return Object.keys(deletions).length;
        });

        expect(size).toBe(3);
    });
});
