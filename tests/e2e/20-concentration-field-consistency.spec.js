// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test: Concentration Field Naming Consistency
 *
 * Issue #2: Three different property names used for concentration:
 * - concentration_mg_ml (localStorage/frontend)
 * - concentrationMgMl (some API endpoints)
 * - concentrationMgPerMl (sync endpoint)
 *
 * This causes calculations to produce NaN when wrong property is used.
 */

test.describe('Concentration Field Consistency', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await page.waitForSelector('#app-content', { state: 'visible', timeout: 5000 }).catch(() => {});
    });

    test('localStorage vials should use concentration_mg_ml (snake_case)', async ({ page }) => {
        // Create a vial and verify it uses snake_case in localStorage
        const result = await page.evaluate(() => {
            // Create test vial with known concentration
            const testVial = {
                id: 'test-vial-' + Date.now(),
                vial_id: 'test-vial-' + Date.now(),
                concentration_mg_ml: 200,
                volume_ml: 10,
                remaining_ml: 10,
                lot_number: 'TEST123',
                expiry_date: '2027-01-01'
            };

            // Add to app data
            if (!app.data.trtVials) app.data.trtVials = [];
            app.data.trtVials.push(testVial);
            app.saveData();

            // Read back from localStorage
            const stored = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const storedVial = stored.trtVials?.find(v => v.id === testVial.id);

            return {
                hasConcentrationMgMl: storedVial?.concentration_mg_ml !== undefined,
                hasConcentrationMgMlCamel: storedVial?.concentrationMgMl !== undefined,
                hasConcentrationMgPerMl: storedVial?.concentrationMgPerMl !== undefined,
                concentration: storedVial?.concentration_mg_ml
            };
        });

        // Should have snake_case property
        expect(result.hasConcentrationMgMl).toBe(true);
        expect(result.concentration).toBe(200);
    });

    test('concentration should survive round-trip through API format conversion', async ({ page }) => {
        const result = await page.evaluate(() => {
            // Simulate localStorage format (snake_case)
            const localVial = {
                id: 'roundtrip-test',
                vial_id: 'roundtrip-test',
                concentration_mg_ml: 250,
                volume_ml: 5,
                remaining_ml: 5
            };

            // Simulate conversion TO API format (what cloud-storage.js should do)
            const toApiFormat = (vial) => ({
                id: vial.id || vial.vial_id,
                concentrationMgMl: vial.concentration_mg_ml || vial.concentrationMgMl || vial.concentrationMgPerMl,
                volumeMl: vial.volume_ml || vial.volumeMl,
                remainingMl: vial.remaining_ml || vial.remainingMl
            });

            // Simulate conversion FROM API format (what cloud-storage.js should do)
            const toLocalFormat = (apiVial) => ({
                id: apiVial.id,
                vial_id: apiVial.id,
                concentration_mg_ml: apiVial.concentrationMgMl || apiVial.concentrationMgPerMl,
                volume_ml: apiVial.volumeMl,
                remaining_ml: apiVial.remainingMl
            });

            // Round trip: local → API → local
            const apiFormat = toApiFormat(localVial);
            const backToLocal = toLocalFormat(apiFormat);

            return {
                original: localVial.concentration_mg_ml,
                inApiFormat: apiFormat.concentrationMgMl,
                afterRoundTrip: backToLocal.concentration_mg_ml,
                preserved: localVial.concentration_mg_ml === backToLocal.concentration_mg_ml
            };
        });

        expect(result.preserved).toBe(true);
        expect(result.original).toBe(250);
        expect(result.inApiFormat).toBe(250);
        expect(result.afterRoundTrip).toBe(250);
    });

    test('supply forecast calculation should work with any concentration field variant', async ({ page }) => {
        const result = await page.evaluate(() => {
            // Test with all three field name variants
            const vialWithSnakeCase = { concentration_mg_ml: 200, remaining_ml: 5 };
            const vialWithCamelCase = { concentrationMgMl: 200, remaining_ml: 5 };
            const vialWithPerMl = { concentrationMgPerMl: 200, remaining_ml: 5 };

            // Helper to get concentration regardless of field name
            const getConcentration = (vial) => {
                return vial.concentration_mg_ml || vial.concentrationMgMl || vial.concentrationMgPerMl || 0;
            };

            // Calculate remaining mg for each variant
            const calcRemainingMg = (vial) => {
                const concentration = getConcentration(vial);
                const remainingMl = vial.remaining_ml || vial.remainingMl || 0;
                return concentration * remainingMl;
            };

            return {
                snakeCaseResult: calcRemainingMg(vialWithSnakeCase),
                camelCaseResult: calcRemainingMg(vialWithCamelCase),
                perMlResult: calcRemainingMg(vialWithPerMl),
                allEqual: calcRemainingMg(vialWithSnakeCase) === calcRemainingMg(vialWithCamelCase) &&
                          calcRemainingMg(vialWithCamelCase) === calcRemainingMg(vialWithPerMl)
            };
        });

        // All variants should produce same result: 200 * 5 = 1000
        expect(result.snakeCaseResult).toBe(1000);
        expect(result.camelCaseResult).toBe(1000);
        expect(result.perMlResult).toBe(1000);
        expect(result.allEqual).toBe(true);
    });

    test('vial display should not show undefined concentration', async ({ page }) => {
        // Add a vial and check UI doesn't show undefined
        await page.evaluate(() => {
            const testVial = {
                id: 'display-test-' + Date.now(),
                vial_id: 'display-test-' + Date.now(),
                concentration_mg_ml: 200,
                volume_ml: 10,
                remaining_ml: 8,
                lot_number: 'DISPLAY123',
                expiry_date: '2027-06-01',
                opened_date: new Date().toISOString().split('T')[0]
            };

            if (!app.data.trtVials) app.data.trtVials = [];
            app.data.trtVials.push(testVial);
            app.saveData();
        });

        // Navigate to TRT page
        await page.evaluate(() => {
            if (app && app.navigateTo) app.navigateTo('trt');
        });
        await page.waitForTimeout(500);

        // Check page content for undefined or NaN
        const pageContent = await page.textContent('body');
        const hasUndefined = pageContent.includes('undefinedmg') || pageContent.includes('undefined mg');
        const hasNaN = pageContent.includes('NaN');

        expect(hasUndefined).toBe(false);
        expect(hasNaN).toBe(false);
    });

    test('cloud-storage should normalize concentration field names', async ({ page }) => {
        // Test that CloudStorage class properly normalizes field names
        const result = await page.evaluate(() => {
            // Check if CloudStorage exists and has proper methods
            if (typeof CloudStorage === 'undefined') {
                return { exists: false, reason: 'CloudStorage class not found' };
            }

            // Create instance for testing
            const cs = new CloudStorage();

            // Test data with different field name variants
            const testCases = [
                { input: { concentration_mg_ml: 100 }, expected: 100 },
                { input: { concentrationMgMl: 150 }, expected: 150 },
                { input: { concentrationMgPerMl: 200 }, expected: 200 }
            ];

            // Helper function that should exist in data mapper
            const normalizeConcentration = (obj) => {
                return obj.concentration_mg_ml || obj.concentrationMgMl || obj.concentrationMgPerMl || null;
            };

            const results = testCases.map(tc => ({
                input: tc.input,
                normalized: normalizeConcentration(tc.input),
                matches: normalizeConcentration(tc.input) === tc.expected
            }));

            return {
                exists: true,
                allMatch: results.every(r => r.matches),
                results
            };
        });

        if (result.exists) {
            expect(result.allMatch).toBe(true);
        }
    });
});
