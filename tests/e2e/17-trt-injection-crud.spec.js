/**
 * TRT Injection CRUD Tests
 * Tests for TRT injection create, read, update (skip), delete operations
 *
 * What's Tested:
 * - Create injection with all fields
 * - Vial remaining volume updates after injection
 * - Skip TRT injection week
 * - Delete injection
 * - Injection list display
 *
 * Note: Tests require TRT mode to be active and at least one vial
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    navigateToTab,
    reloadPage,
    openModal,
    closeModal,
    fillInput,
    selectOption,
    submitForm
} = require('../helpers/test-utils');

const {
    createTrtVial,
    createTrtInjection,
    TRT_INJECTION_SITES
} = require('../fixtures/test-data');

/**
 * Switch to TRT mode in the app
 */
async function switchToTrtMode(page) {
    await page.click('#app-switcher-toggle');
    await page.waitForTimeout(300);
}

/**
 * Get TRT vials from localStorage
 */
async function getTrtVials(page) {
    return await page.evaluate(() => {
        const data = localStorage.getItem('injectionTrackerData');
        if (!data) return [];
        try {
            const parsed = JSON.parse(data);
            return parsed.trtVials || [];
        } catch (e) {
            return [];
        }
    });
}

/**
 * Get TRT injections from localStorage
 */
async function getTrtInjections(page) {
    return await page.evaluate(() => {
        const data = localStorage.getItem('injectionTrackerData');
        if (!data) return [];
        try {
            const parsed = JSON.parse(data);
            return parsed.trtInjections || [];
        } catch (e) {
            return [];
        }
    });
}

/**
 * Load test data with TRT vials and injections
 */
async function loadTrtTestData(page, data) {
    const appData = {
        injections: data.injections || [],
        vials: data.vials || [],
        weights: data.weights || [],
        settings: data.settings || {},
        trtVials: data.trtVials || [],
        trtInjections: data.trtInjections || [],
        trtSymptoms: data.trtSymptoms || [],
        trtSettings: data.trtSettings || {
            weeklyDoseMg: 150,
            injectionDay: 'Monday',
            preferredTime: 'morning'
        }
    };

    await page.evaluate((testData) => {
        localStorage.setItem('injectionTrackerData', JSON.stringify(testData));
        if (window.app && window.app.data) {
            window.app.data = testData;
        }
    }, appData);
}

test.describe('TRT Injection CRUD Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test.describe('CREATE Operations', () => {
        test('should create a TRT injection with all fields', async ({ page }) => {
            // Setup: Create an active vial first
            const testVial = createTrtVial({ status: 'active', remaining_ml: 10 });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);

            // Navigate to Shots tab
            await navigateToTab(page, 'shots');

            // Open Add Injection modal
            await openModal(page, '#add-trt-injection-btn');

            // Fill in all fields
            const today = new Date().toISOString().slice(0, 16);
            await fillInput(page, '#trt-injection-date', today);
            await selectOption(page, '#trt-injection-vial', testVial.id);
            await fillInput(page, '#trt-injection-volume', '0.75');
            await selectOption(page, '#trt-injection-site', 'left_front_thigh');
            await fillInput(page, '#trt-injection-notes', 'Test injection');

            // Submit form
            await submitForm(page, '#add-trt-injection-form');

            // Wait for modal to close and data to save
            await page.waitForTimeout(500);

            // Verify injection was added
            const injections = await getTrtInjections(page);
            expect(injections.length).toBe(1);
            expect(injections[0].volume_ml).toBe(0.75);
            expect(injections[0].injection_site).toBe('left_front_thigh');
            expect(injections[0].vial_id).toBe(testVial.id);
        });

        test('should update vial remaining volume after injection', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active', remaining_ml: 10 });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            await openModal(page, '#add-trt-injection-btn');

            const today = new Date().toISOString().slice(0, 16);
            await fillInput(page, '#trt-injection-date', today);
            await selectOption(page, '#trt-injection-vial', testVial.id);
            await fillInput(page, '#trt-injection-volume', '0.5');
            await selectOption(page, '#trt-injection-site', 'right_front_thigh');

            await submitForm(page, '#add-trt-injection-form');
            await page.waitForTimeout(500);

            // Verify vial remaining volume decreased
            const vials = await getTrtVials(page);
            expect(vials[0].remaining_ml).toBeCloseTo(9.5, 2);
        });

        test('should calculate dose based on vial concentration', async ({ page }) => {
            const testVial = createTrtVial({
                status: 'active',
                remaining_ml: 10,
                concentration_mg_ml: 200
            });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            await openModal(page, '#add-trt-injection-btn');

            const today = new Date().toISOString().slice(0, 16);
            await fillInput(page, '#trt-injection-date', today);
            await selectOption(page, '#trt-injection-vial', testVial.id);
            await fillInput(page, '#trt-injection-volume', '0.75');
            await selectOption(page, '#trt-injection-site', 'left_front_thigh');

            await submitForm(page, '#add-trt-injection-form');
            await page.waitForTimeout(500);

            // Verify dose was calculated (0.75ml * 200mg/ml = 150mg)
            const injections = await getTrtInjections(page);
            expect(injections[0].dose_mg).toBe(150);
        });
    });

    test.describe('READ Operations', () => {
        test('should display injections in shots list', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            const testInjection = createTrtInjection({ vial_id: testVial.id });

            await loadTrtTestData(page, {
                trtVials: [testVial],
                trtInjections: [testInjection]
            });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            await page.waitForTimeout(500);

            // Check for injection in the list
            const injectionItems = await page.$$('#trt-injections-list .injection-item, #trt-injections-list .shot-item');
            expect(injectionItems.length).toBeGreaterThanOrEqual(1);
        });

        test('should show injection details in list', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active', concentration_mg_ml: 200 });
            const testInjection = createTrtInjection({
                vial_id: testVial.id,
                volume_ml: 0.75,
                dose_mg: 150,
                injection_site: 'left_front_thigh'
            });

            await loadTrtTestData(page, {
                trtVials: [testVial],
                trtInjections: [testInjection]
            });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');
            await page.waitForTimeout(500);

            // Check that dose is displayed
            const listContent = await page.textContent('#trt-injections-list');
            expect(listContent).toContain('150');
        });
    });

    test.describe('SKIP Operations', () => {
        test('should create a skipped injection record', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            // Open Skip modal
            await openModal(page, '#skip-trt-injection-btn');

            // Fill in skip reason
            await fillInput(page, '#skip-trt-reason', 'Traveling this week');

            // Submit form
            await submitForm(page, '#skip-trt-injection-form');
            await page.waitForTimeout(500);

            // Verify skipped injection was created
            const injections = await getTrtInjections(page);
            expect(injections.length).toBe(1);
            expect(injections[0].skipped).toBe(true);
            expect(injections[0].dose_mg).toBe(0);
        });

        test('skipped injection should NOT reduce vial volume', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active', remaining_ml: 10 });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            await openModal(page, '#skip-trt-injection-btn');
            await fillInput(page, '#skip-trt-reason', 'Doctor advised skip');
            await submitForm(page, '#skip-trt-injection-form');
            await page.waitForTimeout(500);

            // Verify vial remaining volume unchanged
            const vials = await getTrtVials(page);
            expect(vials[0].remaining_ml).toBe(10);
        });
    });

    test.describe('DELETE Operations', () => {
        test('should delete a TRT injection', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            const testInjection = createTrtInjection({ vial_id: testVial.id });

            await loadTrtTestData(page, {
                trtVials: [testVial],
                trtInjections: [testInjection]
            });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');
            await page.waitForTimeout(500);

            // Click delete button and accept confirmation
            page.on('dialog', dialog => dialog.accept());
            await page.click('#trt-injections-list .delete-btn');
            await page.waitForTimeout(500);

            // Verify injection was deleted
            const injections = await getTrtInjections(page);
            expect(injections.length).toBe(0);
        });

        test('should update UI after deleting injection', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            const testInjection = createTrtInjection({ vial_id: testVial.id });

            await loadTrtTestData(page, {
                trtVials: [testVial],
                trtInjections: [testInjection]
            });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');
            await page.waitForTimeout(500);

            const initialCount = (await page.$$('#trt-injections-list .injection-item, #trt-injections-list .shot-item')).length;

            page.on('dialog', dialog => dialog.accept());
            await page.click('#trt-injections-list .delete-btn');
            await page.waitForTimeout(500);

            const finalCount = (await page.$$('#trt-injections-list .injection-item, #trt-injections-list .shot-item')).length;
            expect(finalCount).toBeLessThan(initialCount);
        });
    });

    test.describe('Validation', () => {
        test('should require a vial to create injection', async ({ page }) => {
            // No vials in data
            await loadTrtTestData(page, { trtVials: [] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            await openModal(page, '#add-trt-injection-btn');

            // The vial dropdown should be empty or show no options
            const vialOptions = await page.$$('#trt-injection-vial option[value]:not([value=""])');
            expect(vialOptions.length).toBe(0);
        });

        test('should not allow negative volume', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            await openModal(page, '#add-trt-injection-btn');

            // Try to enter negative volume
            await fillInput(page, '#trt-injection-volume', '-0.5');

            // The min attribute should prevent this or validation should catch it
            const volumeValue = await page.$eval('#trt-injection-volume', el => el.value);
            // Browser may auto-correct to positive or empty
            expect(parseFloat(volumeValue)).toBeGreaterThanOrEqual(0);
        });
    });

    test.describe('Injection Sites', () => {
        test('should have correct TRT injection site options', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'shots');

            await openModal(page, '#add-trt-injection-btn');

            // Check that expected sites are available
            const siteOptions = await page.$$eval('#trt-injection-site option', options =>
                options.map(o => o.value).filter(v => v)
            );

            expect(siteOptions).toContain('left_front_thigh');
            expect(siteOptions).toContain('right_front_thigh');
        });
    });
});
