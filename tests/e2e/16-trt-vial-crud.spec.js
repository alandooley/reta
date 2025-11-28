/**
 * TRT Vial CRUD Tests
 * Tests for TRT vial create, read, update, delete operations
 *
 * What's Tested:
 * - Create vial with all fields (full form)
 * - Quick-add vial with defaults (200mg/ml, 10ml, active)
 * - Finish vial (mark as empty)
 * - Delete vial
 * - Vial list display
 * - Form reset after modal closes
 *
 * Note: Tests require TRT mode to be active
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
    createTrtVial
} = require('../fixtures/test-data');

/**
 * Switch to TRT mode in the app
 */
async function switchToTrtMode(page) {
    // Click TRT button in app switcher
    await page.click('.app-switcher-btn[data-app="trt"]');
    await page.waitForTimeout(500);
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
 * Load test data with TRT vials
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
        trtSettings: data.trtSettings || {}
    };

    await page.evaluate((testData) => {
        localStorage.setItem('injectionTrackerData', JSON.stringify(testData));
        if (window.app && window.app.data) {
            window.app.data = testData;
        }
    }, appData);
}

test.describe('TRT Vial CRUD Operations', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
        await switchToTrtMode(page);
    });

    test.describe('CREATE Operations', () => {
        test('should create a TRT vial with all fields', async ({ page }) => {
            // Navigate to TRT Inventory
            await navigateToTab(page, 'inventory');

            // Open Add TRT Vial modal
            await openModal(page, '#add-trt-vial-btn');

            // Fill in all fields
            await fillInput(page, '#trt-vial-concentration', '200');
            await fillInput(page, '#trt-vial-volume', '10');
            await fillInput(page, '#trt-vial-lot', 'LOT12345');

            // Set expiry date to 1 year from now
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            const expiryStr = expiryDate.toISOString().split('T')[0];
            await fillInput(page, '#trt-vial-expiry', expiryStr);

            await selectOption(page, '#trt-vial-status', 'dry_stock');
            await fillInput(page, '#trt-vial-notes', 'Test vial notes');

            // Submit form
            await submitForm(page, '#add-trt-vial-form');

            // Wait for modal to close
            await page.waitForTimeout(500);

            // Verify vial was added
            const vials = await getTrtVials(page);
            expect(vials.length).toBe(1);
            expect(vials[0].concentration_mg_ml).toBe(200);
            expect(vials[0].volume_ml).toBe(10);
            expect(vials[0].lot_number).toBe('LOT12345');
            expect(vials[0].status).toBe('dry_stock');
        });

        test('should create an active vial with opened date', async ({ page }) => {
            await navigateToTab(page, 'inventory');
            await openModal(page, '#add-trt-vial-btn');

            await fillInput(page, '#trt-vial-concentration', '250');
            await fillInput(page, '#trt-vial-volume', '5');

            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            await fillInput(page, '#trt-vial-expiry', expiryDate.toISOString().split('T')[0]);

            await selectOption(page, '#trt-vial-status', 'active');

            // Wait for opened date field to appear
            await page.waitForTimeout(300);

            // Fill opened date
            const openedDate = new Date().toISOString().split('T')[0];
            await fillInput(page, '#trt-vial-opened', openedDate);

            await submitForm(page, '#add-trt-vial-form');
            await page.waitForTimeout(500);

            const vials = await getTrtVials(page);
            expect(vials.length).toBe(1);
            expect(vials[0].status).toBe('active');
            expect(vials[0].opened_date).toBeTruthy();
        });

        test('should quick-add a vial with default values', async ({ page }) => {
            await navigateToTab(page, 'inventory');
            await openModal(page, '#add-trt-vial-btn');

            // Click Quick Add button
            await page.click('#trt-vial-quick-add-btn');

            // Wait for modal to close and data to save
            await page.waitForTimeout(500);

            // Verify vial was added with defaults
            const vials = await getTrtVials(page);
            expect(vials.length).toBe(1);
            expect(vials[0].concentration_mg_ml).toBe(200);
            expect(vials[0].volume_ml).toBe(10);
            expect(vials[0].remaining_ml).toBe(10);
            expect(vials[0].status).toBe('active');
            expect(vials[0].notes).toContain('Quick-added');
        });

        test('quick-add should create vial with expiry date', async ({ page }) => {
            await navigateToTab(page, 'inventory');
            await openModal(page, '#add-trt-vial-btn');

            await page.click('#trt-vial-quick-add-btn');
            await page.waitForTimeout(500);

            const vials = await getTrtVials(page);
            expect(vials.length).toBe(1);
            expect(vials[0].expiry_date).toBeTruthy();

            // Verify expiry is approximately 1 year from now
            const expiryDate = new Date(vials[0].expiry_date);
            const now = new Date();
            const daysDiff = (expiryDate - now) / (1000 * 60 * 60 * 24);
            expect(daysDiff).toBeGreaterThan(360);
            expect(daysDiff).toBeLessThan(370);
        });
    });

    test.describe('READ Operations', () => {
        test('should display vials in inventory list', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');

            // Wait for list to render
            await page.waitForTimeout(500);

            // Check for vial in the list
            const vialsList = await page.$('#trt-vials-list');
            expect(vialsList).not.toBeNull();

            const vialItems = await page.$$('#trt-vials-list .vial-item');
            expect(vialItems.length).toBe(1);
        });

        test('should show correct status badge for active vial', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            const activeBadge = await page.$('#trt-vials-list .status-badge.active');
            expect(activeBadge).not.toBeNull();
        });

        test('should show remaining volume for active vials', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active', remaining_ml: 7.5 });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            const vialContent = await page.textContent('#trt-vials-list .vial-item');
            expect(vialContent).toContain('7.50ml');
        });
    });

    test.describe('UPDATE Operations - Finish Vial', () => {
        test('should show Finish Vial button for active vials', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            const finishBtn = await page.$('#trt-vials-list .finish-vial-btn');
            expect(finishBtn).not.toBeNull();
        });

        test('should NOT show Finish Vial button for dry stock vials', async ({ page }) => {
            const testVial = createTrtVial({ status: 'dry_stock' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            const finishBtn = await page.$('#trt-vials-list .finish-vial-btn');
            expect(finishBtn).toBeNull();
        });

        test('should mark vial as empty when Finish Vial is clicked', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active', remaining_ml: 5.0 });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            // Click Finish Vial and accept confirmation
            page.on('dialog', dialog => dialog.accept());
            await page.click('#trt-vials-list .finish-vial-btn');
            await page.waitForTimeout(500);

            // Verify vial is now empty
            const vials = await getTrtVials(page);
            expect(vials[0].status).toBe('empty');
            expect(vials[0].remaining_ml).toBe(0);
            expect(vials[0].finished_date).toBeTruthy();
        });

        test('should update UI after finishing vial', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            page.on('dialog', dialog => dialog.accept());
            await page.click('#trt-vials-list .finish-vial-btn');
            await page.waitForTimeout(500);

            // Check that status badge changed to empty
            const emptyBadge = await page.$('#trt-vials-list .status-badge.empty');
            expect(emptyBadge).not.toBeNull();
        });
    });

    test.describe('DELETE Operations', () => {
        test('should delete a TRT vial', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            // Click delete button and accept confirmation
            page.on('dialog', dialog => dialog.accept());
            await page.click('#trt-vials-list .delete-btn');
            await page.waitForTimeout(500);

            // Verify vial was deleted
            const vials = await getTrtVials(page);
            expect(vials.length).toBe(0);
        });

        test('should update UI after deleting vial', async ({ page }) => {
            const testVial = createTrtVial({ status: 'active' });
            await loadTrtTestData(page, { trtVials: [testVial] });
            await reloadPage(page);
            await switchToTrtMode(page);
            await navigateToTab(page, 'inventory');
            await page.waitForTimeout(500);

            page.on('dialog', dialog => dialog.accept());
            await page.click('#trt-vials-list .delete-btn');
            await page.waitForTimeout(500);

            // Check that list is now empty
            const vialItems = await page.$$('#trt-vials-list .vial-item');
            expect(vialItems.length).toBe(0);
        });
    });

    test.describe('Form Behavior', () => {
        test('should reset form when modal reopens', async ({ page }) => {
            await navigateToTab(page, 'inventory');

            // Open modal and fill some fields
            await openModal(page, '#add-trt-vial-btn');
            await fillInput(page, '#trt-vial-concentration', '999');
            await fillInput(page, '#trt-vial-lot', 'TESTLOT');

            // Close modal without submitting
            await closeModal(page);
            await page.waitForTimeout(500);

            // Reopen modal
            await openModal(page, '#add-trt-vial-btn');

            // Check that fields are reset
            const concentration = await page.$eval('#trt-vial-concentration', el => el.value);
            expect(concentration).toBe('200'); // Default value
        });

        test('should show/hide opened date based on status', async ({ page }) => {
            await navigateToTab(page, 'inventory');
            await openModal(page, '#add-trt-vial-btn');

            // Initially dry_stock, opened date should be hidden
            await selectOption(page, '#trt-vial-status', 'dry_stock');
            await page.waitForTimeout(300);
            let openedGroup = await page.$('#trt-vial-opened-group');
            let openedDisplay = await openedGroup.evaluate(el => getComputedStyle(el).display);
            expect(openedDisplay).toBe('none');

            // Switch to active, opened date should show
            await selectOption(page, '#trt-vial-status', 'active');
            await page.waitForTimeout(300);
            openedDisplay = await openedGroup.evaluate(el => getComputedStyle(el).display);
            expect(openedDisplay).toBe('block');
        });
    });
});
