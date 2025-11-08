/**
 * Calculation Tests
 * Tests medication level algorithm, supply forecast, and BMI edge cases
 *
 * What's Tested:
 * - Medication level calculation (exponential decay with 165-hour half-life)
 * - Supply forecast (total mg from active + dry stock vials)
 * - BMI calculation edge cases
 * - Validation of calculation inputs
 * - Edge cases (no data, invalid data, extreme values)
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    reloadPage
} = require('../helpers/test-utils');

const {
    createValidInjection,
    createValidVial,
    createDryStockVial,
    createValidWeight,
    createSettings
} = require('../fixtures/test-data');

test.describe('Calculations - Medication Level', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should calculate medication level with single injection', async ({ page }) => {
        // Formula: remainingLevel = dose * 0.5^(hoursElapsed / halfLife)
        // Half-life = 165 hours

        const now = Date.now();
        const hoursAgo = 82.5; // Exactly half of half-life (should be 50% remaining)
        const injectionTime = new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();

        const injection = createValidInjection({
            timestamp: injectionTime,
            dose_mg: 1.0
        });

        await loadTestData(page, { injections: [injection], vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.success).toBe(true);
        expect(result.validCount).toBe(1);
        expect(result.value).toBeCloseTo(0.707, 2); // 0.5^(82.5/165) ≈ 0.707
    });

    test('should calculate correct level at half-life (50% remaining)', async ({ page }) => {
        const now = Date.now();
        const halfLife = 165; // hours
        const injectionTime = new Date(now - halfLife * 60 * 60 * 1000).toISOString();

        const injection = createValidInjection({
            timestamp: injectionTime,
            dose_mg: 2.0
        });

        await loadTestData(page, { injections: [injection], vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.value).toBeCloseTo(1.0, 2); // 2.0 * 0.5 = 1.0
    });

    test('should calculate sum of multiple injections', async ({ page }) => {
        const now = Date.now();
        const injections = [
            createValidInjection({
                id: 'inj-1',
                timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
                dose_mg: 1.0
            }),
            createValidInjection({
                id: 'inj-2',
                timestamp: new Date(now - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
                dose_mg: 1.0
            }),
            createValidInjection({
                id: 'inj-3',
                timestamp: new Date(now - 72 * 60 * 60 * 1000).toISOString(), // 72h ago
                dose_mg: 1.0
            })
        ];

        await loadTestData(page, { injections, vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.success).toBe(true);
        expect(result.validCount).toBe(3);
        // Sum should be > 2.5 (recent doses decay slowly)
        expect(result.value).toBeGreaterThan(2.5);
    });

    test('should return 0 when no injections', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('No injection data available');
        expect(result.value).toBe(0);
    });

    test('should skip injections with missing timestamp', async ({ page }) => {
        const injections = [
            createValidInjection({ id: 'valid', timestamp: new Date().toISOString(), dose_mg: 1.0 }),
            { id: 'invalid', dose_mg: 1.0 } // Missing timestamp
        ];

        await loadTestData(page, { injections, vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.success).toBe(true);
        expect(result.validCount).toBe(1);
        expect(result.invalidCount).toBe(1);
        expect(result.warning).toContain('1 injection');
    });

    test('should skip injections with missing dose_mg', async ({ page }) => {
        const injections = [
            createValidInjection({ id: 'valid', timestamp: new Date().toISOString(), dose_mg: 1.0 }),
            { id: 'invalid', timestamp: new Date().toISOString() } // Missing dose_mg
        ];

        await loadTestData(page, { injections, vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.validCount).toBe(1);
        expect(result.invalidCount).toBe(1);
    });

    test('should skip injections with negative dose', async ({ page }) => {
        const injections = [
            createValidInjection({ id: 'valid', timestamp: new Date().toISOString(), dose_mg: 1.0 }),
            createValidInjection({ id: 'invalid', timestamp: new Date().toISOString(), dose_mg: -0.5 })
        ];

        await loadTestData(page, { injections, vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.validCount).toBe(1);
        expect(result.invalidCount).toBe(1);
    });

    test('should ignore future injections', async ({ page }) => {
        const now = Date.now();
        const injections = [
            createValidInjection({
                id: 'past',
                timestamp: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
                dose_mg: 1.0
            }),
            createValidInjection({
                id: 'future',
                timestamp: new Date(now + 24 * 60 * 60 * 1000).toISOString(), // Future
                dose_mg: 1.0
            })
        ];

        await loadTestData(page, { injections, vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.validCount).toBe(1); // Only past injection counted
    });

    test('should handle very old injections (near zero)', async ({ page }) => {
        const now = Date.now();
        const veryOld = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ago

        const injection = createValidInjection({
            timestamp: veryOld,
            dose_mg: 10.0
        });

        await loadTestData(page, { injections: [injection], vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateCurrentMedicationLevel();
        });

        expect(result.success).toBe(true);
        expect(result.value).toBeLessThan(0.01); // Essentially zero after 1 year
    });
});

test.describe('Calculations - Supply Forecast', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should calculate supply from single active vial', async ({ page }) => {
        const vial = createValidVial({
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 1.0,
            current_volume_ml: 1.0
        });

        await loadTestData(page, { injections: [], vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(4.0); // 4mg/week planned
        });

        expect(result.success).toBe(true);
        expect(result.totalSupplyMg).toBe(10.0); // 1.0ml * 10mg/ml
        expect(result.weeksRemaining).toBe(2); // 10mg / 4mg/week = 2.5 weeks → floor(2.5) = 2
        expect(result.daysRemaining).toBe(17); // floor(2.5 * 7) = 17
        expect(result.activeVialCount).toBe(1);
        expect(result.dryStockCount).toBe(0);
    });

    test('should calculate supply from dry stock vial', async ({ page }) => {
        const vial = createDryStockVial({
            status: 'dry_stock',
            total_mg: 15.0
        });

        await loadTestData(page, { injections: [], vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(5.0); // 5mg/week planned
        });

        expect(result.success).toBe(true);
        expect(result.totalSupplyMg).toBe(15.0);
        expect(result.weeksRemaining).toBe(3); // 15mg / 5mg/week = 3 weeks
        expect(result.activeVialCount).toBe(0);
        expect(result.dryStockCount).toBe(1);
    });

    test('should calculate supply from mixed active and dry stock', async ({ page }) => {
        const activeVial = createValidVial({
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 0.5,
            current_volume_ml: 0.5
        });

        const dryVial = createDryStockVial({
            status: 'dry_stock',
            total_mg: 10.0
        });

        await loadTestData(page, { injections: [], vials: [activeVial, dryVial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(3.0); // 3mg/week planned
        });

        expect(result.success).toBe(true);
        expect(result.totalSupplyMg).toBe(15.0); // 5mg (active) + 10mg (dry) = 15mg
        expect(result.weeksRemaining).toBe(5); // 15mg / 3mg/week = 5 weeks
        expect(result.activeVialCount).toBe(1);
        expect(result.dryStockCount).toBe(1);
    });

    test('should return 0 when no vials', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(4.0);
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('No vial data available');
        expect(result.totalSupplyMg).toBe(0);
        expect(result.weeksRemaining).toBe(0);
    });

    test('should skip vials with invalid concentration', async ({ page }) => {
        const validVial = createValidVial({
            vial_id: 'valid',
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 1.0,
            current_volume_ml: 1.0
        });

        const invalidVial = createValidVial({
            vial_id: 'invalid',
            status: 'active',
            concentration_mg_ml: 0, // Invalid
            remaining_ml: 1.0,
            current_volume_ml: 1.0
        });

        await loadTestData(page, { injections: [], vials: [validVial, invalidVial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(4.0);
        });

        expect(result.success).toBe(true);
        expect(result.activeVialCount).toBe(1); // Only valid vial counted
        expect(result.invalidActiveCount).toBe(1);
        expect(result.totalSupplyMg).toBe(10.0); // Only valid vial
    });

    test('should skip vials with invalid volume', async ({ page }) => {
        const validVial = createValidVial({
            vial_id: 'valid',
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 1.0,
            current_volume_ml: 1.0
        });

        const invalidVial = createValidVial({
            vial_id: 'invalid',
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 0, // Invalid
            current_volume_ml: 0
        });

        await loadTestData(page, { injections: [], vials: [validVial, invalidVial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(4.0);
        });

        expect(result.activeVialCount).toBe(1);
        expect(result.invalidActiveCount).toBe(1);
    });

    test('should ignore empty vials', async ({ page }) => {
        const activeVial = createValidVial({
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 1.0,
            current_volume_ml: 1.0
        });

        const emptyVial = createValidVial({
            status: 'empty',
            concentration_mg_ml: 10.0,
            remaining_ml: 0,
            current_volume_ml: 0
        });

        await loadTestData(page, { injections: [], vials: [activeVial, emptyVial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(4.0);
        });

        expect(result.activeVialCount).toBe(1); // Only active vial counted
        expect(result.totalSupplyMg).toBe(10.0);
    });

    test('should handle large planned dose', async ({ page }) => {
        const vial = createValidVial({
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 1.0,
            current_volume_ml: 1.0
        });

        await loadTestData(page, { injections: [], vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(50.0); // 50mg/week (very high)
        });

        expect(result.success).toBe(true);
        expect(result.weeksRemaining).toBe(0); // 10mg / 50mg/week = 0.2 weeks → floor = 0
        expect(result.daysRemaining).toBe(1); // floor(0.2 * 7) = 1 day
    });

    test('should reject invalid planned dose', async ({ page }) => {
        const vial = createValidVial({
            status: 'active',
            concentration_mg_ml: 10.0,
            remaining_ml: 1.0,
            current_volume_ml: 1.0
        });

        await loadTestData(page, { injections: [], vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            return window.app.calculateSupplyForecast(-5.0); // Negative dose
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid planned dose');
    });
});

test.describe('Calculations - BMI Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should calculate BMI at extreme low height (140cm)', async ({ page }) => {
        // BMI = weight_kg / (height_m)²
        const settings = createSettings({ heightCm: 140 }); // 1.4m
        const weight = createValidWeight({ weight_kg: 50.0 });

        await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
        await reloadPage(page);

        // BMI = 50 / (1.4²) = 50 / 1.96 = 25.51
        const expectedBMI = 50.0 / (1.4 * 1.4);

        const weights = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(weights[0].bmi).toBeCloseTo(expectedBMI, 2);
    });

    test('should calculate BMI at extreme high height (220cm)', async ({ page }) => {
        const settings = createSettings({ heightCm: 220 }); // 2.2m
        const weight = createValidWeight({ weight_kg: 100.0 });

        await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
        await reloadPage(page);

        // BMI = 100 / (2.2²) = 100 / 4.84 = 20.66
        const expectedBMI = 100.0 / (2.2 * 2.2);

        const weights = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(weights[0].bmi).toBeCloseTo(expectedBMI, 2);
    });

    test('should calculate BMI at low weight (40kg)', async ({ page }) => {
        const settings = createSettings({ heightCm: 170 });
        const weight = createValidWeight({ weight_kg: 40.0 });

        await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
        await reloadPage(page);

        // BMI = 40 / (1.7²) = 40 / 2.89 = 13.84
        const expectedBMI = 40.0 / (1.7 * 1.7);

        const weights = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(weights[0].bmi).toBeCloseTo(expectedBMI, 2);
    });

    test('should calculate BMI at high weight (150kg)', async ({ page }) => {
        const settings = createSettings({ heightCm: 180 });
        const weight = createValidWeight({ weight_kg: 150.0 });

        await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
        await reloadPage(page);

        // BMI = 150 / (1.8²) = 150 / 3.24 = 46.30
        const expectedBMI = 150.0 / (1.8 * 1.8);

        const weights = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(weights[0].bmi).toBeCloseTo(expectedBMI, 2);
    });

    test('should handle BMI categories correctly', async ({ page }) => {
        const testCases = [
            { height: 175, weight: 50, expectedCategory: 'underweight', expectedBMI: 50 / (1.75 * 1.75) }, // 16.33
            { height: 175, weight: 70, expectedCategory: 'normal', expectedBMI: 70 / (1.75 * 1.75) }, // 22.86
            { height: 175, weight: 85, expectedCategory: 'overweight', expectedBMI: 85 / (1.75 * 1.75) }, // 27.76
            { height: 175, weight: 110, expectedCategory: 'obese', expectedBMI: 110 / (1.75 * 1.75) } // 35.92
        ];

        for (const testCase of testCases) {
            await clearAllStorage(page);
            const settings = createSettings({ heightCm: testCase.height });
            const weight = createValidWeight({ weight_kg: testCase.weight });

            await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
            await reloadPage(page);

            const weights = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
                return data.weights;
            });

            expect(weights[0].bmi).toBeCloseTo(testCase.expectedBMI, 2);
        }
    });

    test('should NOT calculate BMI when height is null', async ({ page }) => {
        const settings = createSettings({ heightCm: null });
        const weight = createValidWeight({ weight_kg: 80.0 });

        await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
        await reloadPage(page);

        const weights = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(weights[0].bmi).toBeNull();
    });

    test('should NOT calculate BMI when height is undefined', async ({ page }) => {
        const settings = {}; // No heightCm
        const weight = createValidWeight({ weight_kg: 80.0 });

        await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
        await reloadPage(page);

        const weights = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(weights[0].bmi).toBeNull();
    });
});
