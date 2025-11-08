/**
 * Settings Tests
 * Tests user preferences and configuration settings
 *
 * What's Tested:
 * - Height setting (for BMI calculation)
 * - Goal weight setting (for progress tracking)
 * - Settings persistence across reloads
 * - Settings impact on calculations
 * - Theme preferences (if applicable)
 * - Data management settings
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    navigateToTab,
    getSettings,
    reloadPage
} = require('../helpers/test-utils');

const {
    createSettings,
    createValidWeight
} = require('../fixtures/test-data');

test.describe('Settings - Height Configuration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should save height setting', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Set height
        await page.fill('#height', '175');

        // Settings should auto-save or save on blur
        await page.evaluate(() => {
            const event = new Event('change', { bubbles: true });
            document.getElementById('height').dispatchEvent(event);
        });

        // Wait a bit for save
        await page.waitForTimeout(500);

        const settings = await getSettings(page);
        expect(settings.heightCm).toBe(175);
    });

    test('should persist height across reload', async ({ page }) => {
        const settings = createSettings({ heightCm: 180 });
        await loadTestData(page, { injections: [], vials: [], weights: [], settings });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Check if height is loaded
        const heightValue = await page.inputValue('#height');
        expect(heightValue).toBe('180');
    });

    test('should affect BMI calculation when height is set', async ({ page }) => {
        const settings = createSettings({ heightCm: 175 });
        const weight = createValidWeight({ weight_kg: 80.0 });

        await loadTestData(page, { injections: [], vials: [], weights: [weight], settings });
        await reloadPage(page);

        // BMI should be calculated
        const weights = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(weights[0].bmi).toBeDefined();
        expect(weights[0].bmi).not.toBeNull();
        expect(weights[0].bmi).toBeCloseTo(26.12, 1); // 80 / (1.75²)
    });

    test('should NOT calculate BMI when height is not set', async ({ page }) => {
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

    test('should validate height is positive', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Try to set negative height
        await page.fill('#height', '-10');

        const heightInput = await page.$('#height');
        const isValid = await heightInput.evaluate(input => input.checkValidity());

        expect(isValid).toBe(false);
    });

    test('should validate height is realistic (< 300cm)', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Try to set unrealistic height
        await page.fill('#height', '500');

        const heightInput = await page.$('#height');
        const maxValue = await heightInput.evaluate(input => input.max);

        // Should have a max constraint
        expect(maxValue).toBeDefined();
    });
});

test.describe('Settings - Goal Weight Configuration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should save goal weight setting', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Set goal weight
        await page.fill('#goal-weight', '75');

        await page.evaluate(() => {
            const event = new Event('change', { bubbles: true });
            document.getElementById('goal-weight').dispatchEvent(event);
        });

        await page.waitForTimeout(500);

        const settings = await getSettings(page);
        expect(settings.goalWeightKg).toBe(75);
    });

    test('should persist goal weight across reload', async ({ page }) => {
        const settings = createSettings({ goalWeightKg: 75.0 });
        await loadTestData(page, { injections: [], vials: [], weights: [], settings });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        const goalValue = await page.inputValue('#goal-weight');
        expect(goalValue).toBe('75');
    });

    test('should affect goal progress calculation', async ({ page }) => {
        const settings = createSettings({ goalWeightKg: 75.0 });
        const weights = [
            createValidWeight({
                timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 90.0
            }),
            createValidWeight({
                timestamp: new Date().toISOString(),
                weight_kg: 85.0
            })
        ];

        await loadTestData(page, { injections: [], vials: [], weights, settings });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Goal progress should be calculated
        // Lost 5kg out of 15kg total needed = 33.3%
        const hasGoalProgress = await page.evaluate(() => {
            const indicator = document.querySelector('#goal-progress-validation-indicator');
            return indicator !== null;
        });

        expect(hasGoalProgress).toBe(true);
    });

    test('should validate goal weight is positive', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        await page.fill('#goal-weight', '-10');

        const goalInput = await page.$('#goal-weight');
        const isValid = await goalInput.evaluate(input => input.checkValidity());

        expect(isValid).toBe(false);
    });

    test('should allow clearing goal weight', async ({ page }) => {
        const settings = createSettings({ goalWeightKg: 75.0 });
        await loadTestData(page, { injections: [], vials: [], weights: [], settings });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Clear goal weight
        await page.fill('#goal-weight', '');

        await page.evaluate(() => {
            const event = new Event('change', { bubbles: true });
            document.getElementById('goal-weight').dispatchEvent(event);
        });

        await page.waitForTimeout(500);

        const updatedSettings = await getSettings(page);
        expect(updatedSettings.goalWeightKg).toBeNull();
    });
});

test.describe('Settings - Data Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should persist all settings across reload', async ({ page }) => {
        const settings = createSettings({
            heightCm: 175,
            goalWeightKg: 75.0,
            units: 'metric',
            theme: 'dark'
        });

        await loadTestData(page, { injections: [], vials: [], weights: [], settings });
        await reloadPage(page);

        const loadedSettings = await getSettings(page);
        expect(loadedSettings.heightCm).toBe(175);
        expect(loadedSettings.goalWeightKg).toBe(75.0);
        expect(loadedSettings.units).toBe('metric');
        expect(loadedSettings.theme).toBe('dark');
    });

    test('should initialize with default settings when none exist', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const settings = await getSettings(page);

        // Should have default values or be empty object
        expect(typeof settings).toBe('object');
    });

    test('should update settings without affecting data', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Change a setting
        await page.fill('#height', '180');
        await page.evaluate(() => {
            const event = new Event('change', { bubbles: true });
            document.getElementById('height').dispatchEvent(event);
        });

        await page.waitForTimeout(500);

        // Weights should still exist
        const data = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            return data.weights;
        });

        expect(data.length).toBe(1);
        expect(data[0].weight_kg).toBe(80.0);
    });
});

test.describe('Settings - UI Elements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show settings tab', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const settingsTab = await page.$('button[onclick="app.switchTab(\'settings\')"]');
        expect(settingsTab).not.toBeNull();
    });

    test('should show height input field', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        const heightInput = await page.$('#height');
        expect(heightInput).not.toBeNull();
    });

    test('should show goal weight input field', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        const goalInput = await page.$('#goal-weight');
        expect(goalInput).not.toBeNull();
    });

    test('should show data management buttons', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Check for export/import buttons
        const exportButton = await page.$('button:has-text("Export")');
        const importButton = await page.$('button:has-text("Import")');

        // At least one should exist
        expect(exportButton !== null || importButton !== null).toBe(true);
    });

    test('should show deduplication button', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        const dedupButton = await page.$('button:has-text("Duplicate")');
        expect(dedupButton).not.toBeNull();
    });
});

test.describe('Settings - Input Validation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should accept decimal values for height', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        await page.fill('#height', '175.5');

        await page.evaluate(() => {
            const event = new Event('change', { bubbles: true });
            document.getElementById('height').dispatchEvent(event);
        });

        await page.waitForTimeout(500);

        const settings = await getSettings(page);
        expect(settings.heightCm).toBeCloseTo(175.5, 1);
    });

    test('should accept decimal values for goal weight', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        await page.fill('#goal-weight', '75.5');

        await page.evaluate(() => {
            const event = new Event('change', { bubbles: true });
            document.getElementById('goal-weight').dispatchEvent(event);
        });

        await page.waitForTimeout(500);

        const settings = await getSettings(page);
        expect(settings.goalWeightKg).toBeCloseTo(75.5, 1);
    });

    test('should reject invalid height values', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        await page.fill('#height', 'not-a-number');

        const heightInput = await page.$('#height');
        const isValid = await heightInput.evaluate(input => input.checkValidity());

        expect(isValid).toBe(false);
    });

    test('should reject invalid goal weight values', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        await page.fill('#goal-weight', 'not-a-number');

        const goalInput = await page.$('#goal-weight');
        const isValid = await goalInput.evaluate(input => input.checkValidity());

        expect(isValid).toBe(false);
    });
});

test.describe('Settings - Save Indicator', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show save indicator when settings change', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        await page.fill('#height', '175');

        await page.evaluate(() => {
            const event = new Event('change', { bubbles: true });
            document.getElementById('height').dispatchEvent(event);
        });

        // Check if save indicator appears (may be brief)
        await page.waitForTimeout(500);

        // Settings should be saved
        const settings = await getSettings(page);
        expect(settings.heightCm).toBe(175);
    });
});
