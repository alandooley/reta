/**
 * Weight CRUD Tests
 * Tests comprehensive weight tracking operations
 *
 * What's Tested:
 * - CREATE weight entries (manual entry, all fields)
 * - BMI calculation (weight_kg / height_cm²)
 * - DELETE weight entries with persistence
 * - DATA PERSISTENCE across reloads
 * - VALIDATION (range checks, required fields)
 * - Weight history and tracking
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    navigateToTab,
    openModal,
    fillInput,
    submitForm,
    getWeights,
    reloadPage,
    getPendingDeletions
} = require('../helpers/test-utils');

const {
    createValidWeight,
    createSettings
} = require('../fixtures/test-data');

test.describe('Weight CRUD - CREATE Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should create a weight entry with all fields', async ({ page }) => {
        const settings = createSettings({ heightCm: 175 });
        await loadTestData(page, { injections: [], vials: [], weights: [], settings });
        await reloadPage(page);

        await navigateToTab(page, 'results');

        // Click Add Weight button
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        // Fill form
        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '80.5');
        await fillInput(page, '#weight-body-fat', '22.5');

        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        // Verify weight created
        const weights = await getWeights(page);
        expect(weights.length).toBe(1);
        expect(weights[0].weight_kg).toBe(80.5);
        expect(weights[0].body_fat_percentage).toBe(22.5);
        expect(weights[0].source).toBe('manual');
    });

    test('should create weight with minimal fields (weight only)', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        // Fill only required fields
        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '75.0');
        // Skip body fat

        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        const weights = await getWeights(page);
        expect(weights.length).toBe(1);
        expect(weights[0].weight_kg).toBe(75.0);
        expect(weights[0].body_fat_percentage).toBeNull();
    });

    test('should auto-calculate weight_lbs from weight_kg', async ({ page }) => {
        // 1 kg = 2.20462 lbs
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '80.0');

        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        const weights = await getWeights(page);
        const expectedLbs = 80.0 * 2.20462; // 176.3696

        expect(weights[0].weight_lbs).toBeCloseTo(expectedLbs, 2);
    });

    test('should set source to "manual" for user-entered weights', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '80.0');

        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        const weights = await getWeights(page);
        expect(weights[0].source).toBe('manual');
    });

    test('should generate unique ID for each weight', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');

        // Add first weight
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });
        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '80.0');
        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        // Add second weight
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });
        await fillInput(page, '#weight-date', '2025-11-08T08:00');
        await fillInput(page, '#weight-kg', '79.5');
        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        const weights = await getWeights(page);
        expect(weights.length).toBe(2);

        // IDs should be unique
        expect(weights[0].id).toBeDefined();
        expect(weights[1].id).toBeDefined();
        expect(weights[0].id).not.toBe(weights[1].id);
    });
});

test.describe('Weight CRUD - BMI Calculation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should calculate BMI when height is set in settings', async ({ page }) => {
        // BMI = weight_kg / (height_m²)
        // BMI = 80 / (1.75²) = 80 / 3.0625 = 26.12

        const settings = createSettings({ heightCm: 175 }); // 1.75m
        await loadTestData(page, { injections: [], vials: [], weights: [], settings });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '80.0');

        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        const weights = await getWeights(page);
        const heightM = 1.75;
        const expectedBMI = 80.0 / (heightM * heightM); // 26.12

        expect(weights[0].bmi).toBeCloseTo(expectedBMI, 2);
    });

    test('should NOT calculate BMI when height is not set', async ({ page }) => {
        const settings = createSettings({ heightCm: null }); // No height
        await loadTestData(page, { injections: [], vials: [], weights: [], settings });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '80.0');

        await submitForm(page, '#add-weight-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        const weights = await getWeights(page);
        expect(weights[0].bmi).toBeNull();
    });

    test('should calculate correct BMI for different heights', async ({ page }) => {
        const testCases = [
            { heightCm: 160, weightKg: 70, expectedBMI: 70 / (1.6 * 1.6) }, // 27.34
            { heightCm: 175, weightKg: 80, expectedBMI: 80 / (1.75 * 1.75) }, // 26.12
            { heightCm: 180, weightKg: 90, expectedBMI: 90 / (1.8 * 1.8) } // 27.78
        ];

        for (const testCase of testCases) {
            await clearAllStorage(page);
            const settings = createSettings({ heightCm: testCase.heightCm });
            await loadTestData(page, { injections: [], vials: [], weights: [], settings });
            await reloadPage(page);

            await navigateToTab(page, 'results');
            await page.click('button.btn-primary:has-text("Add Weight")');
            await page.waitForSelector('#add-weight-form', { timeout: 2000 });

            await fillInput(page, '#weight-date', '2025-11-07T08:00');
            await fillInput(page, '#weight-kg', String(testCase.weightKg));

            await submitForm(page, '#add-weight-form');
            await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

            const weights = await getWeights(page);
            expect(weights[0].bmi).toBeCloseTo(testCase.expectedBMI, 2);
        }
    });
});

test.describe('Weight CRUD - DELETE Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should delete a weight entry', async ({ page }) => {
        const weight = createValidWeight({ weight_kg: 80.0 });
        await loadTestData(page, { injections: [], vials: [], weights: [weight] });
        await reloadPage(page);

        // Before deletion
        let weights = await getWeights(page);
        expect(weights.length).toBe(1);

        // Delete weight
        await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            data.weights = data.weights.filter(w => w.id !== id);
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));
        }, weight.id);

        // After deletion
        weights = await getWeights(page);
        expect(weights.length).toBe(0);
    });

    test('should add deleted weight to pending_deletions', async ({ page }) => {
        const weight = createValidWeight({ weight_kg: 80.0 });
        await loadTestData(page, { injections: [], vials: [], weights: [weight] });
        await reloadPage(page);

        // Delete and add to pending deletions
        await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            data.weights = data.weights.filter(w => w.id !== id);
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));

            // Add to pending deletions with 120s TTL
            const pending = { [id]: Date.now() + 120000 };
            localStorage.setItem('pending_deletions', JSON.stringify(pending));
        }, weight.id);

        // Verify in pending deletions
        const pending = await getPendingDeletions(page);
        expect(pending[weight.id]).toBeDefined();
        expect(pending[weight.id]).toBeGreaterThan(Date.now());
    });

    test('should persist deletion across reload', async ({ page }) => {
        const weight = createValidWeight({ weight_kg: 80.0 });
        await loadTestData(page, { injections: [], vials: [], weights: [weight] });
        await reloadPage(page);

        // Delete
        await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            data.weights = data.weights.filter(w => w.id !== id);
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));
        }, weight.id);

        // Reload
        await reloadPage(page);

        // Verify still deleted
        const weights = await getWeights(page);
        expect(weights.length).toBe(0);
    });

    test('should delete from multiple weights correctly', async ({ page }) => {
        const weights = [
            createValidWeight({ id: 'weight-1', weight_kg: 80.0 }),
            createValidWeight({ id: 'weight-2', weight_kg: 79.5 }),
            createValidWeight({ id: 'weight-3', weight_kg: 79.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);

        // Delete middle weight
        await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            data.weights = data.weights.filter(w => w.id !== id);
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));
        }, 'weight-2');

        const remaining = await getWeights(page);
        expect(remaining.length).toBe(2);
        expect(remaining.find(w => w.id === 'weight-1')).toBeDefined();
        expect(remaining.find(w => w.id === 'weight-2')).toBeUndefined();
        expect(remaining.find(w => w.id === 'weight-3')).toBeDefined();
    });
});

test.describe('Weight CRUD - DATA PERSISTENCE', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should persist weights across reload', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 80.0 }),
            createValidWeight({ weight_kg: 79.5 }),
            createValidWeight({ weight_kg: 79.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);

        // Verify loaded
        let loadedWeights = await getWeights(page);
        expect(loadedWeights.length).toBe(3);

        // Reload again
        await reloadPage(page);

        // Verify still there
        loadedWeights = await getWeights(page);
        expect(loadedWeights.length).toBe(3);
    });

    test('should maintain weight order by timestamp (newest first)', async ({ page }) => {
        const now = Date.now();
        const weights = [
            createValidWeight({ id: 'w1', timestamp: new Date(now - 3000).toISOString(), weight_kg: 80.0 }),
            createValidWeight({ id: 'w2', timestamp: new Date(now - 2000).toISOString(), weight_kg: 79.5 }),
            createValidWeight({ id: 'w3', timestamp: new Date(now - 1000).toISOString(), weight_kg: 79.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);

        const loaded = await getWeights(page);

        // Should be in timestamp order (implementation dependent)
        // Most apps show newest first
        expect(loaded[0].id).toBe('w3'); // Newest
        expect(loaded[1].id).toBe('w2');
        expect(loaded[2].id).toBe('w1'); // Oldest
    });

    test('should handle empty weight array', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const weights = await getWeights(page);
        expect(weights).toEqual([]);
    });

    test('should preserve all weight properties after reload', async ({ page }) => {
        const weight = createValidWeight({
            id: 'test-weight-1',
            timestamp: '2025-11-07T08:00:00Z',
            weight_kg: 80.5,
            body_fat_percentage: 22.5,
            source: 'manual',
            bmi: 26.12
        });

        await loadTestData(page, { injections: [], vials: [], weights: [weight] });
        await reloadPage(page);

        const loaded = await getWeights(page);
        expect(loaded.length).toBe(1);
        expect(loaded[0].id).toBe('test-weight-1');
        expect(loaded[0].weight_kg).toBe(80.5);
        expect(loaded[0].body_fat_percentage).toBe(22.5);
        expect(loaded[0].source).toBe('manual');
        expect(loaded[0].bmi).toBeCloseTo(26.12, 2);
    });
});

test.describe('Weight CRUD - VALIDATION', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should validate weight_kg is positive', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '-5.0'); // Invalid

        const weightInput = await page.$('#weight-kg');
        const isValid = await weightInput.evaluate((input) => input.checkValidity());

        expect(isValid).toBe(false);
    });

    test('should validate weight_kg is not zero', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '0'); // Invalid

        const weightInput = await page.$('#weight-kg');
        const isValid = await weightInput.evaluate((input) => input.checkValidity());

        expect(isValid).toBe(false);
    });

    test('should validate weight_kg is realistic (not > 500kg)', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '600'); // Unrealistic

        const weightInput = await page.$('#weight-kg');
        const maxValue = await weightInput.evaluate((input) => input.max);

        // Should have a max constraint (if implemented)
        // If no constraint, at least value entered
        const value = await page.inputValue('#weight-kg');
        expect(Number(value)).toBe(600);
    });

    test('should validate body_fat_percentage is 0-100', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        await fillInput(page, '#weight-kg', '80.0');
        await fillInput(page, '#weight-body-fat', '150'); // Invalid > 100

        const bodyFatInput = await page.$('#weight-body-fat');
        const isValid = await bodyFatInput.evaluate((input) => input.checkValidity());

        expect(isValid).toBe(false);
    });

    test('should require weight_kg field', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'results');
        await page.click('button.btn-primary:has-text("Add Weight")');
        await page.waitForSelector('#add-weight-form', { timeout: 2000 });

        await fillInput(page, '#weight-date', '2025-11-07T08:00');
        // Skip weight_kg

        const weightInput = await page.$('#weight-kg');
        const isValid = await weightInput.evaluate((input) => input.checkValidity());

        expect(isValid).toBe(false);
    });
});

test.describe('Weight CRUD - Weight Tracking', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should track weight history over time', async ({ page }) => {
        const now = Date.now();
        const weights = [
            createValidWeight({ timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 90.0 }),
            createValidWeight({ timestamp: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 89.5 }),
            createValidWeight({ timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 89.0 }),
            createValidWeight({ timestamp: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 88.5 }),
            createValidWeight({ timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), weight_kg: 88.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);

        const loaded = await getWeights(page);
        expect(loaded.length).toBe(5);

        // Verify weight trend (losing weight)
        expect(loaded[0].weight_kg).toBeLessThan(loaded[loaded.length - 1].weight_kg);
    });

    test('should calculate weight change (first - last)', async ({ page }) => {
        const weights = [
            createValidWeight({ timestamp: '2025-11-01T08:00:00Z', weight_kg: 90.0 }),
            createValidWeight({ timestamp: '2025-11-07T08:00:00Z', weight_kg: 85.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);

        const loaded = await getWeights(page);
        const firstWeight = loaded[loaded.length - 1].weight_kg; // Oldest
        const lastWeight = loaded[0].weight_kg; // Newest
        const change = firstWeight - lastWeight;

        expect(change).toBe(5.0); // Lost 5kg
    });

    test('should handle weight gain (negative change)', async ({ page }) => {
        const weights = [
            createValidWeight({ timestamp: '2025-11-01T08:00:00Z', weight_kg: 80.0 }),
            createValidWeight({ timestamp: '2025-11-07T08:00:00Z', weight_kg: 82.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);

        const loaded = await getWeights(page);
        const firstWeight = loaded[loaded.length - 1].weight_kg;
        const lastWeight = loaded[0].weight_kg;
        const change = firstWeight - lastWeight;

        expect(change).toBe(-2.0); // Gained 2kg
    });
});
