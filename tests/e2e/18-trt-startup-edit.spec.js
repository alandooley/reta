/**
 * TRT Startup and Edit Tests
 * Tests for TRT mode startup behavior and vial edit functionality
 *
 * What's Tested:
 * - TRT mode loads correctly on app startup when saved as currentApp
 * - TRT data displays immediately without needing to switch tabs
 * - TRT dashboard shows data on initial load
 * - Edit button appears on TRT vial items
 * - Edit modal opens and pre-fills with existing vial data
 * - Vial updates persist after editing
 * - Modal title and button text change for edit mode
 *
 * These tests address the issues:
 * 1. App not showing TRT data until switching tabs
 * 2. Missing edit capability for TRT inventory
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    waitForAppReady,
    navigateToTab,
    reloadPage,
    fillInput,
    selectOption,
    submitForm
} = require('../helpers/test-utils');

const {
    createTrtVial,
    createTrtInjection
} = require('../fixtures/test-data');

/**
 * Set currentApp to TRT before page reload
 */
async function setTrtModeInStorage(page) {
    await page.evaluate(() => {
        localStorage.setItem('currentApp', 'trt');
    });
}

/**
 * Load test data with TRT mode active
 */
async function loadTrtTestData(page, data, setTrtMode = true) {
    const appData = {
        injections: data.injections || [],
        vials: data.vials || [],
        weights: data.weights || [],
        settings: data.settings || {},
        trtVials: data.trtVials || [],
        trtInjections: data.trtInjections || [],
        trtSymptoms: data.trtSymptoms || [],
        trtSettings: data.trtSettings || {}
    };

    await page.evaluate(({ testData, trtMode }) => {
        localStorage.setItem('injectionTrackerData', JSON.stringify(testData));
        if (trtMode) {
            localStorage.setItem('currentApp', 'trt');
        }
    }, { testData: appData, trtMode: setTrtMode });
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
 * Check which app mode is visible
 */
async function getVisibleAppMode(page) {
    return await page.evaluate(() => {
        const trtDashboard = document.getElementById('trt-dashboard-tab');
        const retaSummary = document.getElementById('summary-tab');

        if (trtDashboard && trtDashboard.style.display !== 'none') {
            return 'trt';
        }
        if (retaSummary && retaSummary.style.display !== 'none') {
            return 'reta';
        }
        return 'unknown';
    });
}

test.describe('TRT Startup Behavior', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
    });

    test('should load TRT mode on startup when saved as currentApp', async ({ page }) => {
        // Create test data with TRT vial
        const testVial = createTrtVial({ status: 'active' });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);

        // Reload page to trigger startup
        await page.reload();
        await waitForAppReady(page);

        // Verify TRT mode is visible
        const visibleMode = await getVisibleAppMode(page);
        expect(visibleMode).toBe('trt');
    });

    test('should show TRT dashboard tab as default when in TRT mode', async ({ page }) => {
        await loadTrtTestData(page, {}, true);
        await page.reload();
        await waitForAppReady(page);

        // Check TRT dashboard is visible
        const dashboardVisible = await page.isVisible('#trt-dashboard-tab');
        expect(dashboardVisible).toBe(true);
    });

    test('should display TRT data immediately without switching tabs', async ({ page }) => {
        // Create a TRT injection to populate dashboard
        const testVial = createTrtVial({ id: 'test-vial-1', status: 'active' });
        const testInjection = createTrtInjection({
            vial_id: 'test-vial-1',
            dose_mg: 100,
            volume_ml: 0.5
        });

        await loadTrtTestData(page, {
            trtVials: [testVial],
            trtInjections: [testInjection]
        }, true);

        // Reload and wait
        await page.reload();
        await waitForAppReady(page);
        await page.waitForTimeout(500);

        // Check that dashboard shows injection count
        const totalInjections = await page.textContent('#trt-total-injections');
        expect(totalInjections).toBe('1');
    });

    test('should show TRT app switcher as active when starting in TRT mode', async ({ page }) => {
        await loadTrtTestData(page, {}, true);
        await page.reload();
        await waitForAppReady(page);

        // Verify TRT button in app switcher has active class
        const trtSwitcherActive = await page.$('.app-switcher-btn[data-app="trt"].active');
        expect(trtSwitcherActive).not.toBeNull();
    });

    test('should show TRT navigation buttons when starting in TRT mode', async ({ page }) => {
        await loadTrtTestData(page, {}, true);
        await page.reload();
        await waitForAppReady(page);

        // TRT nav buttons should be visible
        const trtDashboardNav = await page.$('.nav-btn[data-tab="trt-dashboard"]');
        const isVisible = await trtDashboardNav.isVisible();
        expect(isVisible).toBe(true);

        // Reta nav buttons should be hidden
        const retaSummaryNav = await page.$('.nav-btn[data-tab="summary"]');
        const isRetaVisible = await retaSummaryNav.isVisible();
        expect(isRetaVisible).toBe(false);
    });

    test('should default to Reta mode when no currentApp saved', async ({ page }) => {
        // Don't set currentApp, just reload
        await page.reload();
        await waitForAppReady(page);

        // Verify Reta mode is visible
        const summaryVisible = await page.isVisible('#summary-tab');
        expect(summaryVisible).toBe(true);
    });
});

test.describe('TRT Vial Edit Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
    });

    test('should show edit button on TRT vial items', async ({ page }) => {
        const testVial = createTrtVial({ status: 'active' });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        // Navigate to inventory
        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        // Check for edit button
        const editBtn = await page.$('#trt-vials-list .edit-btn');
        expect(editBtn).not.toBeNull();
    });

    test('should open edit modal when edit button clicked', async ({ page }) => {
        const testVial = createTrtVial({
            status: 'active',
            concentration_mg_ml: 250,
            lot_number: 'TEST123'
        });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        // Click edit button
        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Verify modal is open
        const modalVisible = await page.isVisible('#add-trt-vial-modal');
        expect(modalVisible).toBe(true);
    });

    test('should pre-fill form with existing vial data in edit mode', async ({ page }) => {
        const testVial = createTrtVial({
            status: 'active',
            concentration_mg_ml: 250,
            volume_ml: 5,
            lot_number: 'LOT-EDIT-TEST',
            notes: 'Test notes for editing'
        });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        // Click edit button
        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Verify form fields are pre-filled
        const concentration = await page.$eval('#trt-vial-concentration', el => el.value);
        const volume = await page.$eval('#trt-vial-volume', el => el.value);
        const lotNumber = await page.$eval('#trt-vial-lot', el => el.value);
        const notes = await page.$eval('#trt-vial-notes', el => el.value);

        expect(concentration).toBe('250');
        expect(volume).toBe('5');
        expect(lotNumber).toBe('LOT-EDIT-TEST');
        expect(notes).toBe('Test notes for editing');
    });

    test('should show "Edit TRT Vial" title in edit mode', async ({ page }) => {
        const testVial = createTrtVial({ status: 'active' });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Check modal title
        const modalTitle = await page.textContent('#add-trt-vial-modal-title');
        expect(modalTitle).toBe('Edit TRT Vial');
    });

    test('should show "Save Changes" button in edit mode', async ({ page }) => {
        const testVial = createTrtVial({ status: 'active' });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Check submit button text
        const submitBtnText = await page.textContent('#trt-vial-submit-btn');
        expect(submitBtnText).toBe('Save Changes');
    });

    test('should update vial when edit form is submitted', async ({ page }) => {
        const testVial = createTrtVial({
            status: 'active',
            concentration_mg_ml: 200,
            lot_number: 'ORIGINAL-LOT'
        });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        // Click edit button
        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Update some fields
        await page.fill('#trt-vial-lot', 'UPDATED-LOT');
        await page.fill('#trt-vial-notes', 'Updated notes');

        // Submit form
        await submitForm(page, '#add-trt-vial-form');
        await page.waitForTimeout(500);

        // Verify vial was updated
        const vials = await getTrtVials(page);
        expect(vials.length).toBe(1);
        expect(vials[0].lot_number).toBe('UPDATED-LOT');
        expect(vials[0].notes).toBe('Updated notes');
        expect(vials[0].concentration_mg_ml).toBe(200); // Unchanged
    });

    test('should reset modal to "Add" mode after closing edit modal', async ({ page }) => {
        const testVial = createTrtVial({ status: 'active' });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        // Open edit modal
        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Close modal (click overlay)
        await page.click('#modal-overlay');
        await page.waitForTimeout(500);

        // Reopen modal via Add button
        await page.click('#add-trt-vial-btn');
        await page.waitForTimeout(300);

        // Check modal is in add mode
        const modalTitle = await page.textContent('#add-trt-vial-modal-title');
        const submitBtnText = await page.textContent('#trt-vial-submit-btn');

        expect(modalTitle).toBe('Add TRT Vial');
        expect(submitBtnText).toBe('Add Vial');
    });

    test('should show remaining volume field for active vials in edit mode', async ({ page }) => {
        const testVial = createTrtVial({
            status: 'active',
            remaining_ml: 7.5
        });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Remaining volume field should be visible for active vials
        const remainingGroup = await page.$('#trt-vial-remaining-group');
        const isVisible = await remainingGroup.isVisible();
        expect(isVisible).toBe(true);

        // Check the value is pre-filled
        const remainingValue = await page.$eval('#trt-vial-remaining', el => el.value);
        expect(remainingValue).toBe('7.5');
    });

    test('should update vial status from dry_stock to active in edit mode', async ({ page }) => {
        const testVial = createTrtVial({
            status: 'dry_stock',
            concentration_mg_ml: 200,
            volume_ml: 10
        });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        // Click edit button
        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Change status to active
        await selectOption(page, '#trt-vial-status', 'active');
        await page.waitForTimeout(300);

        // Fill in opened date
        const today = new Date().toISOString().split('T')[0];
        await fillInput(page, '#trt-vial-opened', today);

        // Submit form
        await submitForm(page, '#add-trt-vial-form');
        await page.waitForTimeout(500);

        // Verify status was updated
        const vials = await getTrtVials(page);
        expect(vials[0].status).toBe('active');
        expect(vials[0].opened_date).toBeTruthy();
    });

    test('should preserve remaining_ml when editing active vial without changing it', async ({ page }) => {
        const testVial = createTrtVial({
            status: 'active',
            remaining_ml: 5.25
        });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        await page.click('#trt-vials-list .edit-btn');
        await page.waitForTimeout(300);

        // Only update notes, leave remaining_ml as is
        await page.fill('#trt-vial-notes', 'Updated without changing volume');

        await submitForm(page, '#add-trt-vial-form');
        await page.waitForTimeout(500);

        // Verify remaining_ml is preserved
        const vials = await getTrtVials(page);
        expect(vials[0].remaining_ml).toBe(5.25);
    });
});

test.describe('TRT Inventory Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
    });

    test('should display vials immediately when navigating to inventory tab', async ({ page }) => {
        const testVial = createTrtVial({
            status: 'active',
            concentration_mg_ml: 200,
            volume_ml: 10
        });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        // Navigate directly to inventory
        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(300);

        // Vial should be visible
        const vialItems = await page.$$('#trt-vials-list .vial-item');
        expect(vialItems.length).toBe(1);
    });

    test('should show both edit and delete buttons on vial items', async ({ page }) => {
        const testVial = createTrtVial({ status: 'active' });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        // Check for both buttons
        const editBtn = await page.$('#trt-vials-list .edit-btn');
        const deleteBtn = await page.$('#trt-vials-list .delete-btn');

        expect(editBtn).not.toBeNull();
        expect(deleteBtn).not.toBeNull();
    });

    test('should have edit button with proper aria-label for accessibility', async ({ page }) => {
        const testVial = createTrtVial({ status: 'active' });
        await loadTrtTestData(page, { trtVials: [testVial] }, true);
        await page.reload();
        await waitForAppReady(page);

        await navigateToTab(page, 'inventory');
        await page.waitForTimeout(500);

        const editBtn = await page.$('#trt-vials-list .edit-btn');
        const ariaLabel = await editBtn.getAttribute('aria-label');
        expect(ariaLabel).toBe('Edit vial');
    });
});
