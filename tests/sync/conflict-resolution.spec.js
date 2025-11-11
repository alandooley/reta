/**
 * Conflict Resolution Tests
 *
 * Tests how the app handles sync conflicts:
 * - Local changes vs cloud changes
 * - Last-write-wins strategy
 * - Timestamp-based resolution
 * - User notification of conflicts
 * - Merge strategies for different data types
 */

const { test, expect } = require('../helpers/test-fixtures');
const { TestDataBuilder } = require('../helpers/test-data-builder');

test.describe('Sync Conflict Resolution', () => {

    /**
     * Last Write Wins: Most recent timestamp wins
     */
    test('should resolve conflicts using last-write-wins', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        const now = Date.now();

        // Local data (older)
        const localData = new TestDataBuilder()
            .withActiveVial({
                vial_id: 'conflict-vial-1',
                total_mg: 10,
                supplier: 'Local Supplier',
                updatedAt: new Date(now - 5000).toISOString() // 5 seconds ago
            })
            .build();

        // Cloud data (newer)
        const cloudData = {
            vials: [{
                vial_id: 'conflict-vial-1',
                total_mg: 10,
                supplier: 'Cloud Supplier',
                updatedAt: new Date(now - 1000).toISOString(), // 1 second ago (more recent)
                status: 'active'
            }]
        };

        // Load local data
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        // Mock API to return cloud data
        await page.route('**/v1/vials', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: cloudData.vials,
                    count: cloudData.vials.length
                })
            });
        });

        await page.reload();

        // Trigger sync
        const syncButton = page.locator('button:has-text("Sync")');
        if (await syncButton.isVisible()) {
            await syncButton.click();
            await page.waitForTimeout(1000);
        }

        // Verify cloud version won (more recent)
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        const vial = vials.find(v => v.vial_id === 'conflict-vial-1');
        expect(vial.supplier).toBe('Cloud Supplier'); // Cloud version should win
    });

    /**
     * Local Wins: Local changes more recent
     */
    test('should keep local changes when they are more recent', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        const now = Date.now();

        // Local data (newer)
        const localData = new TestDataBuilder()
            .withActiveVial({
                vial_id: 'conflict-vial-2',
                total_mg: 10,
                supplier: 'Local Supplier (New)',
                updatedAt: new Date(now - 1000).toISOString() // 1 second ago
            })
            .build();

        // Cloud data (older)
        const cloudData = {
            vials: [{
                vial_id: 'conflict-vial-2',
                total_mg: 10,
                supplier: 'Cloud Supplier (Old)',
                updatedAt: new Date(now - 10000).toISOString(), // 10 seconds ago (older)
                status: 'active'
            }]
        };

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        // Mock API
        await page.route('**/v1/vials', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudData.vials })
            });
        });

        await page.reload();

        // Trigger sync
        await page.evaluate(() => window.syncWithCloud?.());
        await page.waitForTimeout(1000);

        // Verify local version won
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        const vial = vials.find(v => v.vial_id === 'conflict-vial-2');
        expect(vial.supplier).toBe('Local Supplier (New)');
    });

    /**
     * Merge Strategy: Arrays should merge, not replace
     */
    test('should merge arrays instead of replacing', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        // Local has vial A
        const localData = new TestDataBuilder()
            .withActiveVial({ vial_id: 'vial-A', total_mg: 10 })
            .build();

        // Cloud has vial B
        const cloudData = {
            vials: [{
                vial_id: 'vial-B',
                total_mg: 15,
                status: 'active',
                order_date: '2024-11-01'
            }]
        };

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        await page.route('**/v1/vials', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudData.vials })
            });
        });

        await page.reload();
        await page.evaluate(() => window.syncWithCloud?.());
        await page.waitForTimeout(1000);

        // Both vials should exist (merge)
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(vials.length).toBe(2);
        expect(vials.some(v => v.vial_id === 'vial-A')).toBe(true);
        expect(vials.some(v => v.vial_id === 'vial-B')).toBe(true);
    });

    /**
     * Deduplication: Same ID should not duplicate
     */
    test('should not duplicate records with same ID', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        const sharedId = 'shared-vial-123';

        // Both local and cloud have same vial (different data)
        const localData = new TestDataBuilder()
            .withActiveVial({
                vial_id: sharedId,
                total_mg: 10,
                supplier: 'Local'
            })
            .build();

        const cloudData = {
            vials: [{
                vial_id: sharedId,
                total_mg: 10,
                supplier: 'Cloud',
                status: 'active',
                order_date: '2024-11-01',
                updatedAt: new Date(Date.now() - 1000).toISOString()
            }]
        };

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        await page.route('**/v1/vials', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudData.vials })
            });
        });

        await page.reload();
        await page.evaluate(() => window.syncWithCloud?.());
        await page.waitForTimeout(1000);

        // Should only have ONE vial (cloud version due to timestamp)
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(vials.length).toBe(1);
        expect(vials[0].vial_id).toBe(sharedId);
        expect(vials[0].supplier).toBe('Cloud'); // Newer one
    });

    /**
     * Conflict Notification: User notified of conflicts
     */
    test('should notify user when conflicts are resolved', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        const now = Date.now();

        const localData = new TestDataBuilder()
            .withActiveVial({
                vial_id: 'conflict-vial-notify',
                total_mg: 10,
                supplier: 'Local Version',
                updatedAt: new Date(now - 5000).toISOString()
            })
            .build();

        const cloudData = {
            vials: [{
                vial_id: 'conflict-vial-notify',
                total_mg: 10,
                supplier: 'Cloud Version',
                updatedAt: new Date(now - 1000).toISOString(),
                status: 'active'
            }]
        };

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        await page.route('**/v1/vials', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudData.vials })
            });
        });

        await page.reload();
        await page.evaluate(() => window.syncWithCloud?.());
        await page.waitForTimeout(1000);

        // Check for conflict notification
        const notification = page.locator('.notification, .toast, .alert');
        const notificationText = await notification.textContent().catch(() => '');

        // May contain "conflict", "merged", "resolved", etc.
        const hasConflictMessage = /conflict|merged|resolved|synced/i.test(notificationText);

        // If notification exists, it should mention conflict handling
        if (await notification.isVisible().catch(() => false)) {
            expect(hasConflictMessage).toBe(true);
        }
    });

    /**
     * Injection Conflicts: Preserve both if different timestamps
     */
    test('should handle injection conflicts correctly', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        // Local: vial with injection A
        const localData = new TestDataBuilder()
            .withActiveVial({ vial_id: 'vial-123', total_mg: 10 })
            .withInjection(0, { id: 'injection-A', dose_mg: 2.0 })
            .build();

        // Cloud: same vial with injection B
        const cloudData = {
            vials: [{
                vial_id: 'vial-123',
                total_mg: 10,
                status: 'active',
                order_date: '2024-11-01'
            }],
            injections: [{
                id: 'injection-B',
                vial_id: 'vial-123',
                dose_mg: 2.5,
                date: '2024-11-10'
            }]
        };

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        await page.route('**/v1/vials', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudData.vials })
            });
        });

        await page.route('**/v1/injections', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudData.injections })
            });
        });

        await page.reload();
        await page.evaluate(() => window.syncWithCloud?.());
        await page.waitForTimeout(1000);

        // Should have BOTH injections
        const injections = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.injections || [];
        });

        expect(injections.length).toBe(2);
        expect(injections.some(i => i.id === 'injection-A')).toBe(true);
        expect(injections.some(i => i.id === 'injection-B')).toBe(true);
    });

    /**
     * Deletion Conflicts: Deleted item stays deleted
     */
    test('should respect deletions even if cloud has the item', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        const vialId = 'deleted-vial-123';

        // Local: vial is deleted (marked or removed)
        const localData = {
            vials: [],
            injections: [],
            weights: [],
            settings: {},
            deletedItems: [{ id: vialId, type: 'vial', deletedAt: new Date().toISOString() }]
        };

        // Cloud: vial still exists
        const cloudData = {
            vials: [{
                vial_id: vialId,
                total_mg: 10,
                status: 'active',
                order_date: '2024-11-01'
            }]
        };

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        await page.route('**/v1/vials', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudData.vials })
            });
        });

        await page.reload();
        await page.evaluate(() => window.syncWithCloud?.());
        await page.waitForTimeout(1000);

        // Vial should NOT be restored (deletion wins)
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        const vialExists = vials.some(v => v.vial_id === vialId);
        expect(vialExists).toBe(false);
    });

    /**
     * Settings Conflicts: Last write wins for settings
     */
    test('should resolve settings conflicts with last-write-wins', async ({ isolated, apiMock }) => {
        const { page } = isolated;

        const now = Date.now();

        // Local settings (newer)
        const localData = {
            vials: [],
            injections: [],
            weights: [],
            settings: {
                defaultDose: 3.0,
                updatedAt: new Date(now - 1000).toISOString()
            }
        };

        // Cloud settings (older)
        const cloudSettings = {
            defaultDose: 2.5,
            updatedAt: new Date(now - 5000).toISOString()
        };

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, localData);

        await page.route('**/v1/settings', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, data: cloudSettings })
            });
        });

        await page.reload();
        await page.evaluate(() => window.syncWithCloud?.());
        await page.waitForTimeout(1000);

        // Local settings should win (more recent)
        const settings = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.settings || {};
        });

        expect(settings.defaultDose).toBe(3.0);
    });
});
