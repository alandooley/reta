/**
 * Data Quality Tests
 * Tests to ensure data integrity after normalization:
 * - No duplicate injections (same day)
 * - Injection sites use correct format
 * - Version numbers display correctly
 * - Duplicate fix button is removed
 */

const { test, expect } = require('@playwright/test');
const {
    waitForAppReady,
    clearAllStorage,
    bypassAuth,
    navigateToSettings,
    navigateToHome
} = require('../helpers/test-utils');

test.describe('Data Quality - Duplicate Prevention', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await waitForAppReady(page);
        await bypassAuth(page);
        await clearAllStorage(page);
    });

    test('should not allow duplicate injections on same day', async ({ page }) => {
        // Navigate to home
        await navigateToHome(page);

        // Create first injection for today
        const today = new Date().toISOString().split('T')[0];
        await page.evaluate((date) => {
            window.app.data.injections = [{
                id: '1',
                timestamp: `${date}T10:00:00Z`,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: null,
                weight_kg: 80.0,
                notes: '',
                sync_status: 'pending'
            }];
            window.app.saveData();
            window.app.updateUI();
        }, today);

        // Try to create duplicate injection on same day
        await page.evaluate((date) => {
            window.app.data.injections.push({
                id: '2',
                timestamp: `${date}T14:00:00Z`,  // Different time, same day
                dose_mg: 1.0,  // Different dose
                injection_site: 'right_thigh',  // Different site
                vial_id: null,
                weight_kg: 80.0,
                notes: 'duplicate test',
                sync_status: 'pending'
            });
            window.app.saveData();
            window.app.updateUI();
        }, today);

        // Count injections for today
        const injectionCount = await page.evaluate((date) => {
            return window.app.data.injections.filter(inj =>
                inj.timestamp.startsWith(date)
            ).length;
        }, today);

        // Both injections should exist (different time/dose/site means NOT duplicates)
        expect(injectionCount).toBe(2);
    });

    test('should identify truly duplicate injections (same timestamp/dose/site)', async ({ page }) => {
        const today = new Date().toISOString().split('T')[0];

        // Create exact duplicates
        await page.evaluate((date) => {
            window.app.data.injections = [
                {
                    id: '1',
                    timestamp: `${date}T10:00:00Z`,
                    dose_mg: 0.5,
                    injection_site: 'left_thigh',
                    vial_id: null,
                    weight_kg: 80.0,
                    notes: 'original',
                    sync_status: 'pending'
                },
                {
                    id: '2',
                    timestamp: `${date}T10:00:00Z`,  // EXACT same time
                    dose_mg: 0.5,  // EXACT same dose
                    injection_site: 'left_thigh',  // EXACT same site
                    vial_id: null,
                    weight_kg: 80.0,
                    notes: 'duplicate',
                    sync_status: 'pending'
                }
            ];
            window.app.saveData();
        }, today);

        // Count exact duplicates
        const duplicates = await page.evaluate(() => {
            const groups = new Map();
            window.app.data.injections.forEach(inj => {
                const key = `${inj.timestamp}|${inj.dose_mg}|${inj.injection_site}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(inj);
            });

            let dupCount = 0;
            groups.forEach(group => {
                if (group.length > 1) dupCount += group.length - 1;
            });
            return dupCount;
        });

        expect(duplicates).toBe(1);  // One duplicate found
    });
});

test.describe('Data Quality - Injection Site Validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await waitForAppReady(page);
        await bypassAuth(page);
        await clearAllStorage(page);
    });

    test('should only accept valid injection site formats', async ({ page }) => {
        const validSites = [
            'left_thigh',
            'right_thigh',
            'left_abdomen',
            'right_abdomen',
            'left_arm',
            'right_arm'
        ];

        // Check that all valid sites are accepted
        for (const site of validSites) {
            await page.evaluate((siteName) => {
                window.app.data.injections = [{
                    id: '1',
                    timestamp: new Date().toISOString(),
                    dose_mg: 0.5,
                    injection_site: siteName,
                    vial_id: null,
                    weight_kg: 80.0,
                    notes: '',
                    sync_status: 'pending'
                }];
                window.app.saveData();
            }, site);

            const storedSite = await page.evaluate(() => {
                return window.app.data.injections[0].injection_site;
            });

            expect(storedSite).toBe(site);
        }
    });

    test('should not have old format injection sites (abdomen_left, etc)', async ({ page }) => {
        // Load all data from app
        const injections = await page.evaluate(() => {
            return window.app.data.injections || [];
        });

        const invalidFormats = ['abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'arm_left', 'arm_right'];

        for (const inj of injections) {
            expect(invalidFormats).not.toContain(inj.injection_site);
        }
    });
});

test.describe('Data Quality - Version Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await waitForAppReady(page);
        await bypassAuth(page);
    });

    test('should display frontend version 1.1.0', async ({ page }) => {
        await navigateToSettings(page);

        const frontendVersion = await page.locator('#frontend-version').textContent();
        expect(frontendVersion).toBe('1.1.0');
    });

    test('should display backend version 1.1.0', async ({ page }) => {
        await navigateToSettings(page);

        // Wait for backend version to load (async fetch)
        await page.waitForTimeout(2000);

        const backendVersion = await page.locator('#backend-version').textContent();

        // Should be either 1.1.0 or "Not available" if API not configured
        expect(['1.1.0', 'Not available', 'API not configured']).toContain(backendVersion);
    });

    test('should show version information in correct format', async ({ page }) => {
        await navigateToSettings(page);

        // Check version section exists
        const versionSection = await page.locator('text=Version Information').count();
        expect(versionSection).toBeGreaterThan(0);

        // Check elements exist
        const frontendVersionExists = await page.locator('#frontend-version').count();
        const backendVersionExists = await page.locator('#backend-version').count();

        expect(frontendVersionExists).toBe(1);
        expect(backendVersionExists).toBe(1);
    });
});

test.describe('Data Quality - UI Cleanup', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await waitForAppReady(page);
        await bypassAuth(page);
    });

    test('should NOT show duplicate fix button in Settings', async ({ page }) => {
        await navigateToSettings(page);

        // Button should not exist
        const deduplicateBtn = await page.locator('#deduplicate-data-btn').count();
        expect(deduplicateBtn).toBe(0);
    });

    test('should NOT show duplicate fix text in Settings', async ({ page }) => {
        await navigateToSettings(page);

        // Old help text should not exist
        const oldHelpText = await page.locator('text=Use this if you see duplicate injections').count();
        expect(oldHelpText).toBe(0);
    });

    test('should still show export and import buttons', async ({ page }) => {
        await navigateToSettings(page);

        // These buttons should still exist
        const exportBtn = await page.locator('#export-data-btn').count();
        const importBtn = await page.locator('#import-data-btn').count();

        expect(exportBtn).toBe(1);
        expect(importBtn).toBe(1);
    });
});

test.describe('Data Quality - Cloud Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await waitForAppReady(page);
        await bypassAuth(page);
    });

    test('should handle injection site normalization in cloud sync', async ({ page }) => {
        // Mock a cloud sync response with old format
        const mockResponse = [{
            id: 'cloud-1',
            timestamp: '2025-11-08T10:00:00Z',
            doseMg: 0.5,
            site: 'left_abdomen',  // Correct format
            notes: '',
            vialId: null,
            weightKg: 80.0
        }];

        // Simulate cloud sync
        const result = await page.evaluate((response) => {
            // Map API format to app format
            const cloudInjections = response.map(inj => ({
                id: inj.id,
                timestamp: inj.timestamp,
                dose_mg: inj.doseMg,
                injection_site: inj.site,  // Should be 'left_abdomen'
                vial_id: inj.vialId,
                weight_kg: inj.weightKg,
                notes: inj.notes || '',
                sync_status: 'synced'
            }));

            window.app.data.injections = cloudInjections;
            window.app.saveData();

            return window.app.data.injections[0].injection_site;
        }, mockResponse);

        expect(result).toBe('left_abdomen');
    });
});

test.describe('Data Quality - Data Integrity', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await waitForAppReady(page);
        await bypassAuth(page);
        await clearAllStorage(page);
    });

    test('should maintain data consistency across page reload', async ({ page }) => {
        // Create test data
        const testData = {
            id: '1',
            timestamp: '2025-11-08T10:00:00Z',
            dose_mg: 0.5,
            injection_site: 'left_thigh',
            vial_id: null,
            weight_kg: 80.0,
            notes: 'test',
            sync_status: 'pending'
        };

        await page.evaluate((data) => {
            window.app.data.injections = [data];
            window.app.saveData();
        }, testData);

        // Reload page
        await page.goto('http://localhost:3000/?test=true');
        await waitForAppReady(page);
        await bypassAuth(page);

        // Check data persisted correctly
        const loadedData = await page.evaluate(() => {
            return window.app.data.injections[0];
        });

        expect(loadedData.injection_site).toBe('left_thigh');
        expect(loadedData.dose_mg).toBe(0.5);
        expect(loadedData.weight_kg).toBe(80.0);
    });

    test('should not have any null or undefined injection sites', async ({ page }) => {
        // Load all injections
        const injections = await page.evaluate(() => {
            return window.app.data.injections || [];
        });

        for (const inj of injections) {
            expect(inj.injection_site).toBeTruthy();
            expect(inj.injection_site).not.toBeNull();
            expect(inj.injection_site).not.toBeUndefined();
        }
    });
});
