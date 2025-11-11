/**
 * Enhanced Vial CRUD Tests with Transaction Rollback
 *
 * Tests vial creation, reading, updating, and deletion with:
 * - Automatic transaction rollback for cleanup
 * - API mocking to prevent cloud sync
 * - Custom assertions for better readability
 * - Comprehensive coverage of all vial operations
 */

const { test, expect } = require('../helpers/test-fixtures');
const { TestDataBuilder } = require('../helpers/test-data-builder');
const {
    singleDryVial,
    singleActiveVial,
    multipleVials,
} = require('../fixtures/test-data');

test.describe('Vial CRUD Operations (Enhanced)', () => {

    /**
     * CREATE: Dry Stock Vial
     */
    test('should create a new dry stock vial', async ({ isolated }) => {
        const { page } = isolated;

        // Navigate to vials page
        await page.click('text=Vials');
        await page.waitForLoadState('networkidle');

        // Click "Add Vial" button
        await page.click('button:has-text("Add Vial")');
        await page.waitForSelector('#vial-modal', { state: 'visible' });

        // Fill in vial details
        const orderDate = '2024-11-01';
        const totalMg = 10;
        const supplier = 'Test Supplier';

        await page.fill('#vial-order-date', orderDate);
        await page.fill('#vial-total-mg', totalMg.toString());
        await page.fill('#vial-supplier', supplier);

        // Submit form
        await page.click('#vial-modal button:has-text("Save")');
        await page.waitForSelector('#vial-modal', { state: 'hidden' });

        // Verify vial was created in localStorage
        const vials = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials || [];
        });

        expect(vials.length).toBe(1);
        expect(vials[0].order_date).toBe(orderDate);
        expect(vials[0].total_mg).toBe(totalMg);
        expect(vials[0].supplier).toBe(supplier);
        expect(vials[0].status).toBe('dry_stock');

        // Verify vial appears in UI
        const vialCard = page.locator('.vial-card').first();
        await expect(vialCard).toContainText('Test Supplier');
        await expect(vialCard).toContainText('10 mg');
        await expect(vialCard).toContainText('Dry Stock');
    });

    /**
     * CREATE: Bulk Vials (Multiple at Once)
     */
    test('should create multiple vials at once', async ({ isolated }) => {
        const { page } = isolated;

        await page.click('text=Vials');

        // Create 5 vials
        for (let i = 0; i < 5; i++) {
            await page.click('button:has-text("Add Vial")');
            await page.fill('#vial-order-date', `2024-11-0${i + 1}`);
            await page.fill('#vial-total-mg', '10');
            await page.fill('#vial-supplier', `Supplier ${i + 1}`);
            await page.click('#vial-modal button:has-text("Save")');
            await page.waitForSelector('#vial-modal', { state: 'hidden' });
        }

        // Verify all 5 vials exist
        const vialCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials?.length || 0;
        });

        expect(vialCount).toBe(5);

        // Verify all 5 appear in UI
        const vialCards = page.locator('.vial-card');
        await expect(vialCards).toHaveCount(5);
    });

    /**
     * UPDATE: Activate a Dry Stock Vial
     */
    test('should activate a dry stock vial', async ({ isolated }) => {
        const { page } = isolated;

        // Load test data with one dry vial
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleDryVial);

        await page.reload();
        await page.click('text=Vials');

        // Click "Activate" button on the vial
        const vialCard = page.locator('.vial-card').first();
        await vialCard.click(); // Opens vial details

        // Or click edit button if separate
        await page.click('button:has-text("Activate")');

        // Fill in activation details
        const reconDate = '2024-11-05';
        const bacWater = 1;

        await page.fill('#vial-reconstitution-date', reconDate);
        await page.fill('#vial-bac-water-ml', bacWater.toString());

        // Save activation
        await page.click('button:has-text("Save")');

        // Verify vial status changed
        const vialId = singleDryVial.vials[0].vial_id;
        await expect(page).toHaveVial(vialId, {
            status: 'active',
            reconstitution_date: reconDate,
            bac_water_ml: bacWater,
        });

        // Verify UI updated
        await expect(vialCard).toContainText('Active');
        await expect(vialCard).not.toContainText('Dry Stock');
    });

    /**
     * UPDATE: Edit Vial Volume Manually
     */
    test('should manually edit vial volume', async ({ isolated }) => {
        const { page } = isolated;

        // Load active vial
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        await page.reload();
        await page.click('text=Vials');

        const vialId = singleActiveVial.vials[0].vial_id;

        // Open edit modal
        await page.click('.vial-card >> button:has-text("Edit")');
        await page.waitForSelector('#vial-modal', { state: 'visible' });

        // Change current volume
        const newVolume = 0.5;
        await page.fill('#vial-current-volume-ml', newVolume.toString());

        await page.click('#vial-modal button:has-text("Save")');
        await page.waitForSelector('#vial-modal', { state: 'hidden' });

        // Verify volume changed
        await expect(page).toHaveVialVolume(vialId, newVolume, 0.01);

        // Verify UI shows new volume
        const vialCard = page.locator('.vial-card').first();
        await expect(vialCard).toContainText('0.5 ml');
    });

    /**
     * DELETE: Delete a Single Vial
     */
    test('should delete a vial', async ({ isolated }) => {
        const { page } = isolated;

        // Load test data
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        await page.reload();
        await page.click('text=Vials');

        const vialId = singleActiveVial.vials[0].vial_id;

        // Verify vial exists before deletion
        await expect(page).toHaveVial(vialId);

        // Click delete button
        const vialCard = page.locator('.vial-card').first();
        await vialCard.hover();
        await page.click('button:has-text("Delete")');

        // Confirm deletion (if confirmation dialog exists)
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
            await confirmButton.click();
        }

        // Verify vial was deleted from localStorage
        const vialExists = await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials?.some(v => v.vial_id === id) || false;
        }, vialId);

        expect(vialExists).toBe(false);

        // Verify UI updated
        const vialCount = await page.locator('.vial-card').count();
        expect(vialCount).toBe(0);
    });

    /**
     * DELETE: Cannot delete vial with injections
     */
    test('should prevent deletion of vial with injections', async ({ isolated }) => {
        const { page } = isolated;

        // Create vial with injections
        const dataWithInjections = new TestDataBuilder()
            .withActiveVial({ total_mg: 10, bac_water_ml: 1 })
            .withInjection(0, { dose_mg: 2.5 })
            .withInjection(0, { dose_mg: 2.5 })
            .build();

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, dataWithInjections);

        await page.reload();
        await page.click('text=Vials');

        // Try to delete vial
        await page.click('button:has-text("Delete")');

        // Should show error message
        const errorMessage = page.locator('.error-message, .alert-danger');
        await expect(errorMessage).toContainText(/cannot delete.*injections/i);

        // Vial should still exist
        const vialId = dataWithInjections.vials[0].vial_id;
        await expect(page).toHaveVial(vialId);
    });

    /**
     * READ: List All Vials with Filtering
     */
    test('should filter vials by status', async ({ isolated }) => {
        const { page } = isolated;

        // Load multiple vials with different statuses
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, multipleVials);

        await page.reload();
        await page.click('text=Vials');

        // multipleVials has: 2 empty, 1 active, 2 dry
        const allCards = page.locator('.vial-card');
        await expect(allCards).toHaveCount(5);

        // Filter to show only active
        await page.click('button:has-text("Filter")');
        await page.check('input[value="active"]');
        await page.click('button:has-text("Apply")');

        const activeCards = page.locator('.vial-card');
        await expect(activeCards).toHaveCount(1);
        await expect(activeCards.first()).toContainText('Active');

        // Filter to show only dry stock
        await page.click('button:has-text("Filter")');
        await page.uncheck('input[value="active"]');
        await page.check('input[value="dry_stock"]');
        await page.click('button:has-text("Apply")');

        const dryCards = page.locator('.vial-card');
        await expect(dryCards).toHaveCount(2);
    });

    /**
     * PERSISTENCE: Data persists across page reload
     */
    test('should persist vial data across page reload', async ({ isolated }) => {
        const { page } = isolated;

        // Create a vial
        await page.click('text=Vials');
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-order-date', '2024-11-10');
        await page.fill('#vial-total-mg', '15');
        await page.fill('#vial-supplier', 'Persistence Test');
        await page.click('#vial-modal button:has-text("Save")');

        // Get vial ID
        const vialId = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.vials[0]?.vial_id;
        });

        // Reload page
        await page.reload();
        await page.click('text=Vials');

        // Verify vial still exists
        await expect(page).toHaveVial(vialId, {
            total_mg: 15,
            supplier: 'Persistence Test'
        });

        const vialCard = page.locator('.vial-card').first();
        await expect(vialCard).toContainText('Persistence Test');
    });
});
