/**
 * Offline Operations Tests
 *
 * Tests application behavior when offline:
 * - Local operations continue to work
 * - Data persists in localStorage
 * - Operations queue for later sync
 * - UI shows offline status
 * - No data loss when going offline/online
 */

const { test, expect } = require('../helpers/test-fixtures');
const { TestDataBuilder } = require('../helpers/test-data-builder');
const { singleActiveVial } = require('../fixtures/test-data');

test.describe('Offline Operations', () => {

    /**
     * Offline Mode: All local CRUD operations work
     */
    test('should allow full CRUD operations while offline', async ({ isolated }) => {
        const { page } = isolated;

        // Load initial data
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        // Go offline
        await page.context().setOffline(true);
        await page.reload();

        // CREATE: Add new vial
        await page.click('text=Vials');
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-11');
        await page.fill('#vial-total-mg', '15');
        await page.fill('#vial-supplier', 'Offline Vial');
        await page.click('#vial-modal button:has-text("Save")');

        // Verify vial was created locally
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(vials.length).toBe(2); // Original + new one
        expect(vials.some(v => v.supplier === 'Offline Vial')).toBe(true);

        // READ: View existing data
        const vialCards = page.locator('.vial-card');
        await expect(vialCards).toHaveCount(2);

        // UPDATE: Edit vial
        await page.click('.vial-card:has-text("Offline Vial") >> button:has-text("Edit")');
        await page.fill('#vial-supplier', 'Offline Vial Updated');
        await page.click('#vial-modal button:has-text("Save")');

        // Verify update
        const updatedVials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(updatedVials.some(v => v.supplier === 'Offline Vial Updated')).toBe(true);

        // DELETE: Remove vial
        await page.click('.vial-card:has-text("Offline Vial Updated") >> button:has-text("Delete")');

        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
            await confirmButton.click();
        }

        // Verify deletion
        const finalVials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(finalVials.length).toBe(1); // Back to original count
        expect(finalVials.some(v => v.supplier?.includes('Offline'))).toBe(false);
    });

    /**
     * Offline Indicator: UI shows offline status
     */
    test('should display offline indicator when no connection', async ({ isolated }) => {
        const { page } = isolated;

        await page.reload();

        // Initially online
        let offlineIndicator = page.locator('.offline-indicator, .status-offline');
        await expect(offlineIndicator).not.toBeVisible();

        // Go offline
        await page.context().setOffline(true);

        // Trigger a sync attempt or navigation to detect offline state
        await page.click('text=Home');
        await page.waitForTimeout(500);

        // Offline indicator should appear
        offlineIndicator = page.locator('.offline-indicator, .status-offline');
        await expect(offlineIndicator).toBeVisible();
        await expect(offlineIndicator).toContainText(/offline|no connection/i);
    });

    /**
     * Data Persistence: No data loss when going offline
     */
    test('should not lose data when going offline mid-operation', async ({ isolated }) => {
        const { page } = isolated;

        await page.reload();

        // Start creating a vial
        await page.click('text=Vials');
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-12');
        await page.fill('#vial-total-mg', '20');

        // Go offline before saving
        await page.context().setOffline(true);

        // Complete the save
        await page.click('#vial-modal button:has-text("Save")');

        // Vial should still be created locally
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(vials.length).toBe(1);
        expect(vials[0].total_mg).toBe(20);

        // Should be queued for sync
        const syncQueue = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.syncQueue || [];
        });

        expect(syncQueue.length).toBeGreaterThan(0);
        expect(syncQueue[0].entity).toBe('vial');
        expect(syncQueue[0].operation).toBe('CREATE');
    });

    /**
     * Offline-to-Online: Data syncs when connection restored
     */
    test('should sync queued operations when coming back online', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        // Start offline
        await page.context().setOffline(true);
        await page.reload();

        // Create multiple operations
        await page.click('text=Vials');
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-13');
        await page.fill('#vial-total-mg', '10');
        await page.click('#vial-modal button:has-text("Save")');

        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-14');
        await page.fill('#vial-total-mg', '15');
        await page.click('#vial-modal button:has-text("Save")');

        // Verify 2 operations queued
        let syncQueue = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.syncQueue || [];
        });

        expect(syncQueue.length).toBe(2);

        // Go back online
        await page.context().setOffline(false);

        // Trigger sync (or wait for automatic sync)
        const syncButton = page.locator('button:has-text("Sync"), .sync-now-button');
        if (await syncButton.isVisible()) {
            await syncButton.click();
        }

        await page.waitForTimeout(2000); // Wait for sync to process

        // Verify queue was processed
        syncQueue = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.syncQueue || [];
        });

        const pendingOps = syncQueue.filter(op => op.status === 'pending');
        expect(pendingOps.length).toBe(0);
    });

    /**
     * Mixed Operations: Online and offline operations together
     */
    test('should handle mixed online/offline operations', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        // Create vial while online
        await page.reload();
        await page.click('text=Vials');
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-15');
        await page.fill('#vial-total-mg', '10');
        await page.fill('#vial-supplier', 'Online Vial');
        await page.click('#vial-modal button:has-text("Save")');

        // Verify created
        let vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });
        expect(vials.length).toBe(1);

        // Go offline
        await page.context().setOffline(true);

        // Create another vial while offline
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-16');
        await page.fill('#vial-total-mg', '15');
        await page.fill('#vial-supplier', 'Offline Vial');
        await page.click('#vial-modal button:has-text("Save")');

        // Verify both vials exist locally
        vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(vials.length).toBe(2);
        expect(vials.some(v => v.supplier === 'Online Vial')).toBe(true);
        expect(vials.some(v => v.supplier === 'Offline Vial')).toBe(true);

        // Only offline vial should be in sync queue
        const syncQueue = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.syncQueue || [];
        });

        expect(syncQueue.length).toBe(1);
        expect(syncQueue[0].data.supplier).toBe('Offline Vial');
    });

    /**
     * Page Reload: Offline state persists
     */
    test('should remember offline state across page reload', async ({ isolated }) => {
        const { page } = isolated;

        await page.context().setOffline(true);
        await page.reload();

        // Create operation
        await page.click('text=Vials');
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-17');
        await page.fill('#vial-total-mg', '10');
        await page.click('#vial-modal button:has-text("Save")');

        // Get sync queue
        let syncQueue = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.syncQueue || [];
        });
        expect(syncQueue.length).toBe(1);

        // Reload page (still offline)
        await page.reload();

        // Queue should still exist
        syncQueue = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.syncQueue || [];
        });
        expect(syncQueue.length).toBe(1);

        // Offline indicator should still show
        const offlineIndicator = page.locator('.offline-indicator, .status-offline');
        await expect(offlineIndicator).toBeVisible();
    });

    /**
     * Deletion Queuing: Delete operations queued when offline
     */
    test('should queue delete operations when offline', async ({ isolated }) => {
        const { page } = isolated;

        // Load vial
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        const vialId = singleActiveVial.vials[0].vial_id;

        await page.context().setOffline(true);
        await page.reload();

        await page.click('text=Vials');

        // Delete vial while offline
        await page.click('.vial-card >> button:has-text("Delete")');

        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
            await confirmButton.click();
        }

        // Vial should be marked for deletion locally
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        // Either removed locally or marked as deleted
        const vialStillExists = vials.some(v => v.vial_id === vialId && !v.deleted);
        expect(vialStillExists).toBe(false);

        // Delete operation should be queued
        const syncQueue = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.syncQueue || [];
        });

        const deleteOp = syncQueue.find(op =>
            op.operation === 'DELETE' &&
            op.entity === 'vial' &&
            op.data.vial_id === vialId
        );

        expect(deleteOp).toBeTruthy();
    });

    /**
     * Local-First: App fully functional offline
     */
    test('should provide full app functionality offline', async ({ isolated }) => {
        const { page } = isolated;

        await page.context().setOffline(true);
        await page.reload();

        // Navigate to all pages
        const pages = ['Home', 'Vials', 'Injections', 'Results', 'Settings'];

        for (const pageName of pages) {
            await page.click(`text=${pageName}`);
            await page.waitForLoadState('networkidle');

            // Verify page loaded
            const pageContent = page.locator('.page-content, .page, main');
            await expect(pageContent).toBeVisible();
        }

        // Create data on each page
        // Vial
        await page.click('text=Vials');
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-18');
        await page.fill('#vial-total-mg', '10');
        await page.click('#vial-modal button:has-text("Save")');

        // Verify all data created locally
        const data = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
        });

        expect(data.vials?.length).toBeGreaterThan(0);

        // Verify sync queue has all operations
        expect(data.syncQueue?.length).toBeGreaterThan(0);
    });
});
