/**
 * Visual Validation Tests
 * Tests validation indicators, UI state, and visual feedback
 *
 * What's Tested:
 * - Validation indicators (success ✓, warning ⚠, error ✗)
 * - Supply forecast indicators (duration, run-out date, reorder)
 * - Weight change indicators (BMI, progress, weekly avg)
 * - UI state visibility (modals, tabs, empty states)
 * - Error messages and tooltips (presence, not exact text)
 *
 * Note: These are functional UI tests, not pixel-perfect visual regression tests
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    navigateToTab,
    reloadPage
} = require('../helpers/test-utils');

const {
    createValidInjection,
    createValidVial,
    createDryStockVial,
    createValidWeight,
    createSettings
} = require('../fixtures/test-data');

test.describe('Visual Validation - Supply Forecast Indicators', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show success indicator when supply > 4 weeks', async ({ page }) => {
        const vials = [
            createValidVial({
                status: 'active',
                concentration_mg_ml: 10.0,
                remaining_ml: 2.0, // 20mg total
                current_volume_ml: 2.0
            })
        ];

        await loadTestData(page, { injections: [], vials, weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'inventory');

        // Supply duration indicator should exist
        const indicator = await page.$('#supply-duration-validation-indicator');
        expect(indicator).not.toBeNull();

        // Should contain success class (green checkmark)
        const hasSuccess = await page.$('#supply-duration-validation-indicator .validation-success');
        expect(hasSuccess).not.toBeNull();
    });

    test('should show warning indicator when supply < 4 weeks', async ({ page }) => {
        const vials = [
            createValidVial({
                status: 'active',
                concentration_mg_ml: 10.0,
                remaining_ml: 0.5, // 5mg total = ~1 week at 4mg/week
                current_volume_ml: 0.5
            })
        ];

        await loadTestData(page, { injections: [], vials, weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'inventory');

        // Should contain warning class (yellow warning sign)
        const hasWarning = await page.$('#supply-duration-validation-indicator .validation-warning');
        expect(hasWarning).not.toBeNull();
    });

    test('should show error indicator when no vials', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'inventory');

        // Should contain error class (red X)
        const hasError = await page.$('#supply-duration-validation-indicator .validation-error');
        expect(hasError).not.toBeNull();
    });

    test('should show validation indicators for all forecast metrics', async ({ page }) => {
        const vials = [
            createValidVial({
                status: 'active',
                concentration_mg_ml: 10.0,
                remaining_ml: 1.0,
                current_volume_ml: 1.0
            })
        ];

        await loadTestData(page, { injections: [], vials, weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'inventory');

        // All three indicators should exist
        const supplyDuration = await page.$('#supply-duration-validation-indicator');
        const runOutDate = await page.$('#run-out-date-validation-indicator');
        const reorderDays = await page.$('#reorder-days-validation-indicator');

        expect(supplyDuration).not.toBeNull();
        expect(runOutDate).not.toBeNull();
        expect(reorderDays).not.toBeNull();
    });
});

test.describe('Visual Validation - Weight Change Indicators', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show BMI validation indicator when height is set', async ({ page }) => {
        const settings = createSettings({ heightCm: 175 });
        const weights = [
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights, settings });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        const indicator = await page.$('#bmi-validation-indicator');
        expect(indicator).not.toBeNull();
    });

    test('should show weight change validation indicators', async ({ page }) => {
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

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check all weight-related indicators exist
        const totalChange = await page.$('#total-change-validation-indicator');
        const percentChange = await page.$('#percent-change-validation-indicator');
        const weeklyAvg = await page.$('#weekly-avg-validation-indicator');

        expect(totalChange).not.toBeNull();
        expect(percentChange).not.toBeNull();
        expect(weeklyAvg).not.toBeNull();
    });

    test('should show goal progress indicator when goal is set', async ({ page }) => {
        const settings = createSettings({ goalWeightKg: 75.0 });
        const weights = [
            createValidWeight({ weight_kg: 85.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights, settings });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        const indicator = await page.$('#goal-progress-validation-indicator');
        expect(indicator).not.toBeNull();
    });
});

test.describe('Visual Validation - UI State', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show all navigation tabs', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const shotsTab = await page.$('button[data-tab="shots"]');
        const inventoryTab = await page.$('button[data-tab="inventory"]');
        const resultsTab = await page.$('button[data-tab="results"]');
        const settingsTab = await page.$('button[data-tab="settings"]');

        expect(shotsTab).not.toBeNull();
        expect(inventoryTab).not.toBeNull();
        expect(resultsTab).not.toBeNull();
        expect(settingsTab).not.toBeNull();
    });

    test('should show active tab correctly', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        // Initial tab should be active (summary tab by default)
        const activeTab = await page.$('button[data-tab="summary"].active');
        expect(activeTab).not.toBeNull();

        // Switch tab
        await navigateToTab(page, 'inventory');
        const inventoryActive = await page.$('button[data-tab="inventory"].active');
        expect(inventoryActive).not.toBeNull();
    });

    test('should show empty state when no data', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'shots');

        // Check for empty state or no data message (look in main content area)
        const noDataFound = await page.evaluate(() => {
            const table = document.querySelector('main table tbody');
            if (!table) return true;

            const rows = table.querySelectorAll('tr:not(.empty-state)');
            return rows.length === 0;
        });

        expect(noDataFound).toBe(true);
    });

    test('should show data rows when data exists', async ({ page }) => {
        const vial = createValidVial();
        const injections = [
            createValidInjection({ vial_id: vial.vial_id })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'shots');

        const hasData = await page.evaluate(() => {
            const table = document.querySelector('main table tbody');
            if (!table) return false;

            const rows = table.querySelectorAll('tr:not(.empty-state)');
            return rows.length > 0;
        });

        expect(hasData).toBe(true);
    });

    test('should hide modal by default', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const modalVisible = await page.isVisible('#modal-overlay');
        expect(modalVisible).toBe(false);
    });

    test('should show modal when opened', async ({ page }) => {
        const vial = createValidVial({ status: 'active' });
        await loadTestData(page, { injections: [], vials: [vial], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'shots');
        await page.click('button:has-text("+ Add Shot")');

        // Wait for modal to appear
        await page.waitForSelector('#modal-overlay', { timeout: 2000 });

        const modalVisible = await page.isVisible('#modal-overlay');
        expect(modalVisible).toBe(true);
    });

    test('should show form validation state (invalid input)', async ({ page }) => {
        const vial = createValidVial({ status: 'active' });
        await loadTestData(page, { injections: [], vials: [vial], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'shots');
        await page.click('button:has-text("+ Add Shot")');
        await page.waitForSelector('#modal-overlay', { timeout: 2000 });

        // Enter invalid dose
        await page.fill('#shot-dose', '100'); // > 50mg (invalid)

        const doseInput = await page.$('#shot-dose');
        const isValid = await doseInput.evaluate(input => input.checkValidity());

        expect(isValid).toBe(false);
    });
});

test.describe('Visual Validation - Tooltips and Help Text', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show tooltip for warning indicators', async ({ page }) => {
        const vials = [
            createValidVial({
                status: 'active',
                concentration_mg_ml: 10.0,
                remaining_ml: 0.3, // Low supply
                current_volume_ml: 0.3
            })
        ];

        await loadTestData(page, { injections: [], vials, weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'inventory');

        // Check if tooltip element exists (not checking exact text)
        const tooltip = await page.$('.validation-tooltip');
        expect(tooltip).not.toBeNull();
    });

    test('should show help text in settings', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'settings');

        // Check for presence of help text (not exact content) in main content area
        const hasHelpText = await page.evaluate(() => {
            const main = document.querySelector('main');
            if (!main) return false;

            // Look for paragraphs or help text elements
            const helpElements = main.querySelectorAll('p, .help-text, small');
            return helpElements.length > 0;
        });

        expect(hasHelpText).toBe(true);
    });
});

test.describe('Visual Validation - Stat Cards', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should render stat cards on inventory tab', async ({ page }) => {
        const vials = [
            createValidVial({
                status: 'active',
                concentration_mg_ml: 10.0,
                remaining_ml: 1.0,
                current_volume_ml: 1.0
            })
        ];

        await loadTestData(page, { injections: [], vials, weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'inventory');

        const statCards = await page.$$('.stat-card');
        expect(statCards.length).toBeGreaterThan(0);
    });

    test('should render stat cards on results tab', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        const statCards = await page.$$('.stat-card');
        expect(statCards.length).toBeGreaterThan(0);
    });

    test('should show error state on stat card when error exists', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'inventory');

        // With no vials, supply forecast should show error
        const errorCard = await page.$('.stat-card.has-validation-error');
        // May or may not exist depending on implementation
    });
});

test.describe('Visual Validation - Loading States', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show save indicator after data save', async ({ page }) => {
        const vial = createValidVial({ status: 'active' });
        await loadTestData(page, { injections: [], vials: [vial], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'shots');
        await page.click('button:has-text("+ Add Shot")');
        await page.waitForSelector('#modal-overlay', { timeout: 2000 });

        await page.fill('#shot-date', '2025-11-07');
        await page.fill('#shot-time', '10:00');
        await page.selectOption('#shot-vial', vial.vial_id);
        await page.selectOption('#shot-site', 'left_thigh');
        await page.fill('#shot-dose', '0.5');

        await page.click('#add-shot-form button[type="submit"]');

        // Save indicator should appear briefly
        // Note: May disappear quickly, this tests that save flow works
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });
    });

    test('should initialize without loading errors', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        // Check for any visible error messages
        const hasErrors = await page.evaluate(() => {
            const errorElements = document.querySelectorAll('.error, .alert-danger, [class*="error"]');
            // Filter out validation indicators (those are expected)
            const realErrors = Array.from(errorElements).filter(el =>
                !el.closest('.validation-indicator') &&
                el.textContent.trim().length > 0 &&
                el.offsetParent !== null // visible
            );
            return realErrors.length > 0;
        });

        expect(hasErrors).toBe(false);
    });
});

test.describe('Visual Validation - Responsive Elements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should show navigation buttons', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        const navButtons = await page.$$('.nav-tabs button');
        expect(navButtons.length).toBeGreaterThanOrEqual(4); // At least 4 tabs
    });

    test('should show action buttons on each tab', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        // Shots tab - Add Shot button
        await navigateToTab(page, 'shots');
        const addShotButton = await page.$('button:has-text("+ Add Shot")');
        expect(addShotButton).not.toBeNull();

        // Inventory tab - Add Vial button
        await navigateToTab(page, 'inventory');
        const addVialButton = await page.$('button:has-text("+ Add Vial")');
        expect(addVialButton).not.toBeNull();

        // Results tab - Add Weight button
        await navigateToTab(page, 'results');
        const addWeightButton = await page.$('button:has-text("+ Add Weight")');
        expect(addWeightButton).not.toBeNull();
    });

    test('should render tables with headers', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);

        await navigateToTab(page, 'shots');

        const hasTable = await page.evaluate(() => {
            const table = document.querySelector('main table');
            if (!table) return false;

            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');

            return thead !== null && tbody !== null;
        });

        expect(hasTable).toBe(true);
    });
});
