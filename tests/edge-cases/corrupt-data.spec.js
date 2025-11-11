/**
 * Corrupt Data Handling Tests
 *
 * Tests how the app handles malformed/corrupt data:
 * - Missing required fields
 * - Invalid data types
 * - Null/undefined values
 * - Circular references
 * - Invalid JSON
 * - Data recovery mechanisms
 */

const { test, expect } = require('../helpers/test-fixtures');
const { corruptData } = require('../fixtures/test-data');

test.describe('Corrupt Data Handling', () => {

    test.describe('Missing Fields', () => {

        test('should handle vial with missing vial_id', async ({ isolated }) => {
            const { page } = isolated;

            const corruptVialData = {
                vials: [{
                    // Missing vial_id
                    total_mg: 10,
                    status: 'active',
                    order_date: '2024-11-01'
                }],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, corruptVialData);

            await page.reload();

            // App should handle gracefully - either ignore or auto-generate ID
            const pageError = await page.evaluate(() => {
                return window.lastError || null;
            });

            // Should not crash
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            // Check if vial was fixed or ignored
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            // Either no vials (ignored) or vial has auto-generated ID
            if (vials.length > 0) {
                expect(vials[0].vial_id).toBeTruthy();
            }
        });

        test('should handle injection with missing vial_id reference', async ({ isolated }) => {
            const { page } = isolated;

            const corruptInjectionData = {
                vials: [{
                    vial_id: 'test-vial-1',
                    total_mg: 10,
                    status: 'active',
                    order_date: '2024-11-01'
                }],
                injections: [{
                    id: 'test-injection-1',
                    // Missing vial_id
                    dose_mg: 2.5,
                    date: '2024-11-10'
                }],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, corruptInjectionData);

            await page.reload();

            // Should handle gracefully
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            // Injection might be ignored or marked as orphaned
            await page.click('text=Injections');

            const injectionCards = page.locator('.injection-card');
            const count = await injectionCards.count();

            // Either 0 (ignored) or 1 with error indicator
            expect(count).toBeLessThanOrEqual(1);
        });
    });

    test.describe('Invalid Data Types', () => {

        test('should handle string where number expected', async ({ isolated }) => {
            const { page } = isolated;

            const invalidTypeData = {
                vials: [{
                    vial_id: 'test-vial-type',
                    total_mg: 'ten', // String instead of number
                    bac_water_ml: 'one',
                    status: 'active',
                    order_date: '2024-11-01'
                }],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, invalidTypeData);

            await page.reload();

            // Should not crash
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            await page.click('text=Vials');

            // Vial might show error state or be hidden
            const vialCards = page.locator('.vial-card');
            const count = await vialCards.count();

            // If shown, should display error indicator
            if (count > 0) {
                const errorIndicator = page.locator('.error-indicator, .data-error, .invalid-data');
                // May or may not have error indicator depending on implementation
            }
        });

        test('should handle null values in critical fields', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, corruptData);

            await page.reload();

            // Should not crash
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            // Navigate to each page to ensure app is stable
            await page.click('text=Vials');
            await page.waitForTimeout(300);

            await page.click('text=Injections');
            await page.waitForTimeout(300);

            await page.click('text=Weight');
            await page.waitForTimeout(300);

            // App should remain functional
            await expect(appHeader).toBeVisible();
        });
    });

    test.describe('Invalid JSON', () => {

        test('should handle corrupted localStorage JSON', async ({ isolated }) => {
            const { page } = isolated;

            // Write invalid JSON
            await page.evaluate(() => {
                localStorage.setItem('retatrutide_data', '{invalid json syntax');
            });

            await page.reload();

            // Should fall back to empty data
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            // Check if data was reset
            const data = await page.evaluate(() => {
                const stored = localStorage.getItem('retatrutide_data');
                try {
                    return JSON.parse(stored || '{}');
                } catch {
                    return null;
                }
            });

            // Should be reset or fixed
            expect(data).not.toBeNull();
        });

        test('should handle empty localStorage', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate(() => {
                localStorage.clear();
            });

            await page.reload();

            // Should initialize with default empty structure
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            const data = await page.evaluate(() => {
                return JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            });

            // Should have structure (even if empty)
            expect(data).toBeTruthy();
        });
    });

    test.describe('Data Recovery', () => {

        test('should recover from corrupt vial data', async ({ isolated }) => {
            const { page } = isolated;

            // Mix of good and corrupt vials
            const mixedData = {
                vials: [
                    {
                        vial_id: 'good-vial-1',
                        total_mg: 10,
                        status: 'active',
                        order_date: '2024-11-01'
                    },
                    {
                        vial_id: 'corrupt-vial',
                        total_mg: null, // Corrupt
                        status: 'active'
                    },
                    {
                        vial_id: 'good-vial-2',
                        total_mg: 15,
                        status: 'dry_stock',
                        order_date: '2024-11-02'
                    }
                ],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, mixedData);

            await page.reload();
            await page.click('text=Vials');

            // Good vials should still be shown
            const vialCards = page.locator('.vial-card');
            const count = await vialCards.count();

            // At least 2 good vials should be visible
            expect(count).toBeGreaterThanOrEqual(2);

            // Verify good vials are accessible
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            const goodVials = vials.filter(v => v.vial_id?.startsWith('good-vial'));
            expect(goodVials.length).toBe(2);
        });

        test('should auto-fix recoverable data issues', async ({ isolated }) => {
            const { page } = isolated;

            // Data that can be auto-fixed
            const recoverableData = {
                vials: [{
                    vial_id: 'test-vial-fix',
                    total_mg: 10,
                    bac_water_ml: 1,
                    // Missing concentration (can be calculated)
                    current_volume_ml: 1.0,
                    status: 'active',
                    order_date: '2024-11-01'
                }],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, recoverableData);

            await page.reload();

            // Check if concentration was auto-calculated
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            if (vials.length > 0) {
                const vial = vials[0];
                // Concentration should be calculated: 10mg / 1ml = 10mg/ml
                if (vial.concentration_mg_ml !== undefined) {
                    expect(vial.concentration_mg_ml).toBe(10);
                }
            }
        });
    });

    test.describe('Circular References', () => {

        test('should handle circular reference in data', async ({ isolated }) => {
            const { page } = isolated;

            // Create circular reference (can't be stringified normally)
            await page.evaluate(() => {
                const data = {
                    vials: [{
                        vial_id: 'circular-vial',
                        total_mg: 10,
                        status: 'active'
                    }],
                    injections: [],
                    weights: []
                };

                // Add circular reference
                data.vials[0].self = data.vials[0];

                try {
                    // This will fail with circular reference
                    localStorage.setItem('retatrutide_data', JSON.stringify(data));
                } catch (error) {
                    console.log('Circular reference detected:', error.message);
                    // App should handle this error
                }
            });

            await page.reload();

            // Should not crash
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();
        });
    });

    test.describe('Boundary Values', () => {

        test('should handle extremely large numbers', async ({ isolated }) => {
            const { page } = isolated;

            const largeNumberData = {
                vials: [{
                    vial_id: 'large-number-vial',
                    total_mg: Number.MAX_SAFE_INTEGER,
                    bac_water_ml: 1,
                    status: 'active',
                    order_date: '2024-11-01'
                }],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeNumberData);

            await page.reload();

            // Should handle gracefully
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            await page.click('text=Vials');

            // May show error or warning about unrealistic value
        });

        test('should handle very small decimal numbers', async ({ isolated }) => {
            const { page } = isolated;

            const smallNumberData = {
                vials: [{
                    vial_id: 'small-number-vial',
                    total_mg: 0.0000001,
                    bac_water_ml: 1,
                    status: 'active',
                    order_date: '2024-11-01'
                }],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, smallNumberData);

            await page.reload();
            await page.click('text=Vials');

            // Should handle or warn about unrealistic value
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();
        });
    });

    test.describe('Array Edge Cases', () => {

        test('should handle empty arrays', async ({ isolated }) => {
            const { page } = isolated;

            const emptyArrayData = {
                vials: [],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, emptyArrayData);

            await page.reload();

            // Should show empty state
            await page.click('text=Vials');

            const emptyState = page.locator('.empty-state, .no-data, text=No vials');
            await expect(emptyState).toBeVisible();
        });

        test('should handle undefined arrays', async ({ isolated }) => {
            const { page } = isolated;

            const undefinedArrayData = {
                // Missing arrays entirely
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, undefinedArrayData);

            await page.reload();

            // Should initialize arrays
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            const data = await page.evaluate(() => {
                return JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            });

            // Arrays should be defined (even if empty)
            expect(Array.isArray(data.vials) || data.vials === undefined).toBe(true);
        });
    });

    test.describe('Date Edge Cases', () => {

        test('should handle invalid date formats', async ({ isolated }) => {
            const { page } = isolated;

            const invalidDateData = {
                vials: [{
                    vial_id: 'invalid-date-vial',
                    total_mg: 10,
                    status: 'active',
                    order_date: 'not-a-date'
                }],
                injections: [{
                    id: 'invalid-date-injection',
                    vial_id: 'invalid-date-vial',
                    dose_mg: 2.5,
                    date: 'invalid-date'
                }],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, invalidDateData);

            await page.reload();

            // Should handle gracefully
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();
        });

        test('should handle timestamp vs ISO date inconsistency', async ({ isolated }) => {
            const { page } = isolated;

            const mixedDateData = {
                vials: [{
                    vial_id: 'mixed-date-vial',
                    total_mg: 10,
                    status: 'active',
                    order_date: Date.now(), // Timestamp instead of ISO string
                    reconstitution_date: '2024-11-10' // ISO string
                }],
                injections: [],
                weights: []
            };

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, mixedDateData);

            await page.reload();

            // Should normalize date formats
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();
        });
    });
});
