/**
 * Enhanced Injection CRUD Tests with Transaction Rollback
 *
 * Tests injection creation, reading, updating, and deletion with:
 * - Automatic vial volume tracking
 * - Transaction rollback for cleanup
 * - API mocking to prevent cloud sync
 * - Validation of business rules
 */

const { test, expect } = require('../helpers/test-fixtures');
const { TestDataBuilder } = require('../helpers/test-data-builder');
const {
    singleActiveVial,
    vialWithOneInjection,
    vialWithMultipleInjections,
} = require('../fixtures/test-data');

test.describe('Injection CRUD Operations (Enhanced)', () => {

    /**
     * CREATE: Add injection with automatic vial volume deduction
     */
    test('should create injection and deduct from vial volume', async ({ isolated }) => {
        const { page } = isolated;

        // Load active vial with 1ml volume
        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        const vialId = singleActiveVial.vials[0].vial_id;
        const initialVolume = singleActiveVial.vials[0].current_volume_ml;

        await page.reload();
        await page.click('text=Home');

        // Add injection
        await page.click('button:has-text("Add Injection")');
        await page.waitForSelector('#injection-modal', { state: 'visible' });

        const doseMg = 2.5;
        const concentration = 10; // mg/ml
        const expectedVolumeUsed = doseMg / concentration; // 0.25ml

        await page.fill('#injection-dose-mg', doseMg.toString());
        await page.fill('#injection-date', '2024-11-10');

        await page.click('#injection-modal button:has-text("Save")');
        await page.waitForSelector('#injection-modal', { state: 'hidden' });

        // Verify injection was created
        const injections = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.injections || [];
        });

        expect(injections.length).toBe(1);
        expect(injections[0].dose_mg).toBe(doseMg);

        // Verify vial volume was deducted
        const newVolume = initialVolume - expectedVolumeUsed;
        await expect(page).toHaveVialVolume(vialId, newVolume, 0.01);
    });

    /**
     * CREATE: Cannot create injection with insufficient vial volume
     */
    test('should prevent injection exceeding vial volume', async ({ isolated }) => {
        const { page } = isolated;

        // Create vial with very little volume remaining (0.1ml)
        const lowVolumeVial = new TestDataBuilder()
            .withActiveVial({
                total_mg: 10,
                bac_water_ml: 1,
                current_volume_ml: 0.1,
                remaining_ml: 0.1,
                used_volume_ml: 0.9
            })
            .build();

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, lowVolumeVial);

        await page.reload();
        await page.click('text=Home');

        // Try to add injection requiring 0.25ml
        await page.click('button:has-text("Add Injection")');
        await page.fill('#injection-dose-mg', '2.5'); // 2.5mg / 10mg/ml = 0.25ml
        await page.fill('#injection-date', '2024-11-10');
        await page.click('#injection-modal button:has-text("Save")');

        // Should show error message
        const errorMessage = page.locator('.error-message, .alert-danger');
        await expect(errorMessage).toContainText(/insufficient.*volume/i);

        // Injection should not be created
        const injectionCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.injections?.length || 0;
        });

        expect(injectionCount).toBe(0);
    });

    /**
     * CREATE: Multiple injections from same vial
     */
    test('should create multiple injections and track cumulative volume', async ({ isolated }) => {
        const { page } = isolated;

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        const vialId = singleActiveVial.vials[0].vial_id;
        const initialVolume = 1.0;
        const concentration = 10;

        await page.reload();

        // Add 3 injections
        const doses = [2.0, 2.5, 3.0]; // Total: 7.5mg = 0.75ml
        let totalVolumeUsed = 0;

        for (const dose of doses) {
            await page.click('button:has-text("Add Injection")');
            await page.fill('#injection-dose-mg', dose.toString());
            await page.fill('#injection-date', '2024-11-10');
            await page.click('#injection-modal button:has-text("Save")');
            await page.waitForSelector('#injection-modal', { state: 'hidden' });

            totalVolumeUsed += dose / concentration;
        }

        // Verify all 3 injections exist
        const injectionCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.injections?.length || 0;
        });

        expect(injectionCount).toBe(3);

        // Verify cumulative volume deduction
        const expectedRemainingVolume = initialVolume - totalVolumeUsed; // 1.0 - 0.75 = 0.25ml
        await expect(page).toHaveVialVolume(vialId, expectedRemainingVolume, 0.01);
    });

    /**
     * READ: List injections sorted by date
     */
    test('should display injections in chronological order', async ({ isolated }) => {
        const { page } = isolated;

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, vialWithMultipleInjections);

        await page.reload();
        await page.click('text=Injections');

        // Verify injections are sorted (most recent first)
        const injectionDates = await page.locator('.injection-card .date').allTextContents();

        // Should be in descending order
        for (let i = 0; i < injectionDates.length - 1; i++) {
            const currentDate = new Date(injectionDates[i]);
            const nextDate = new Date(injectionDates[i + 1]);
            expect(currentDate >= nextDate).toBe(true);
        }
    });

    /**
     * UPDATE: Edit injection dose
     */
    test('should edit injection and recalculate vial volume', async ({ isolated }) => {
        const { page } = isolated;

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, vialWithOneInjection);

        const injectionId = vialWithOneInjection.injections[0].id;
        const vialId = vialWithOneInjection.vials[0].vial_id;
        const originalDose = vialWithOneInjection.injections[0].dose_mg;

        await page.reload();
        await page.click('text=Injections');

        // Click edit button
        const injectionCard = page.locator('.injection-card').first();
        await injectionCard.click();

        // Or find specific edit button
        await page.click(`button[data-injection-id="${injectionId}"]:has-text("Edit")`);

        // Change dose from 2.5mg to 3.5mg
        const newDose = 3.5;
        await page.fill('#injection-dose-mg', '');
        await page.fill('#injection-dose-mg', newDose.toString());
        await page.click('button:has-text("Save")');

        // Verify injection was updated
        await expect(page).toHaveInjection(injectionId, { dose_mg: newDose });

        // Verify vial volume was recalculated
        // Volume change: (3.5 - 2.5) / 10 = 0.1ml additional
        // Original volume after 2.5mg injection would be ~0.75ml
        // New volume after 3.5mg should be ~0.65ml
        const concentration = 10;
        const additionalVolumeUsed = (newDose - originalDose) / concentration;

        // Get current volume
        const currentVolume = await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            const vial = data.vials.find(v => v.vial_id === id);
            return vial?.current_volume_ml || 0;
        }, vialId);

        // Should be less than before
        expect(currentVolume).toBeLessThan(1.0 - (originalDose / concentration));
    });

    /**
     * DELETE: Delete injection and restore vial volume
     */
    test('should delete injection and restore vial volume', async ({ isolated }) => {
        const { page } = isolated;

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, vialWithOneInjection);

        const injectionId = vialWithOneInjection.injections[0].id;
        const vialId = vialWithOneInjection.vials[0].vial_id;
        const doseMg = vialWithOneInjection.injections[0].dose_mg;
        const concentration = 10;

        // Get vial volume before deletion
        const volumeBeforeDeletion = await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            const vial = data.vials.find(v => v.vial_id === id);
            return vial?.current_volume_ml || 0;
        }, vialId);

        await page.reload();
        await page.click('text=Injections');

        // Delete injection
        await page.click(`button[data-injection-id="${injectionId}"]:has-text("Delete")`);

        // Confirm if needed
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
            await confirmButton.click();
        }

        // Verify injection was deleted
        const injectionExists = await page.evaluate((id) => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.injections?.some(inj => inj.id === id) || false;
        }, injectionId);

        expect(injectionExists).toBe(false);

        // Verify vial volume was restored
        const volumeUsed = doseMg / concentration;
        const expectedRestoredVolume = volumeBeforeDeletion + volumeUsed;

        await expect(page).toHaveVialVolume(vialId, expectedRestoredVolume, 0.01);
    });

    /**
     * VALIDATION: Date cannot be in the future
     */
    test('should prevent injection with future date', async ({ isolated }) => {
        const { page } = isolated;

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        await page.reload();

        // Try to add injection with future date
        await page.click('button:has-text("Add Injection")');

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        await page.fill('#injection-dose-mg', '2.5');
        await page.fill('#injection-date', futureDateStr);
        await page.click('#injection-modal button:has-text("Save")');

        // Should show error
        const errorMessage = page.locator('.error-message, .alert-danger');
        await expect(errorMessage).toContainText(/future.*date/i);

        // Injection should not be created
        const injectionCount = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.injections?.length || 0;
        });

        expect(injectionCount).toBe(0);
    });

    /**
     * PERSISTENCE: Injections persist across reload
     */
    test('should persist injection data across page reload', async ({ isolated }) => {
        const { page } = isolated;

        await page.evaluate((data) => {
            localStorage.setItem('retatrutide_data', JSON.stringify(data));
        }, singleActiveVial);

        await page.reload();

        // Create injection
        await page.click('button:has-text("Add Injection")');
        await page.fill('#injection-dose-mg', '2.75');
        await page.fill('#injection-date', '2024-11-10');
        await page.click('#injection-modal button:has-text("Save")');

        // Get injection ID
        const injectionId = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            return data.injections[0]?.id;
        });

        // Reload page
        await page.reload();
        await page.click('text=Injections');

        // Verify injection still exists
        await expect(page).toHaveInjection(injectionId, { dose_mg: 2.75 });
    });
});
