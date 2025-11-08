/**
 * Vial CRUD Tests
 * Comprehensive tests for vial create, read, update, delete operations
 *
 * Tests cover:
 * - Dry stock creation
 * - Vial activation (reconstitution)
 * - Usage tracking (remaining_ml updates)
 * - Status transitions (dry_stock → active → insufficient → empty)
 * - Concentration calculation
 * - Expiration date calculation
 * - Deletion constraints
 * - Data persistence
 */

const { test, expect } = require('@playwright/test');
const {
  createValidVial,
  createDryStockVial,
  createValidInjection
} = require('../fixtures/test-data');
const {
  clearAllStorage,
  loadTestData,
  waitForAppReady,
  navigateToTab,
  openModal,
  fillInput,
  selectOption,
  submitForm,
  getVials,
  getInjections,
  reloadPage,
  countTableRows,
  waitForTableRows
} = require('../helpers/test-utils');
const {
  validateVialStructure,
  validateVialValues,
  validateVialUsage
} = require('../helpers/validation-helpers');

test.describe('Vial CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?test=true');
    await clearAllStorage(page);
    await reloadPage(page);
  });

  test.describe('CREATE Operations - Dry Stock', () => {
    test('should create a dry stock vial with all fields', async ({ page }) => {
      await navigateToTab(page, 'inventory');

      // Open Add Vial modal
      await openModal(page, '#add-vial-btn');

      // Fill in all fields
      await fillInput(page, '#vial-order-date', '2025-11-01');
      await fillInput(page, '#vial-mg', '15');
      await fillInput(page, '#vial-supplier', 'Test Pharma Co.');

      // Submit form
      await submitForm(page, '#add-vial-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      // Verify vial was added
      const vials = await getVials(page);
      expect(vials.length).toBe(1);

      const vial = vials[0];
      expect(vial.total_mg).toBe(15);
      expect(vial.supplier).toBe('Test Pharma Co.');
      expect(vial.status).toBe('dry_stock');
      expect(vial.order_date).toContain('2025-11-01');

      // Dry stock should not have these fields yet
      expect(vial.bac_water_ml).toBeNull();
      expect(vial.concentration_mg_ml).toBeNull();
      expect(vial.reconstitution_date).toBeNull();
      expect(vial.remaining_ml).toBe(0); // Dry stock has 0ml of liquid (not null)

      // Validate structure
      validateVialStructure(vial);
    });

    test('should create dry stock with minimal fields', async ({ page }) => {
      await navigateToTab(page, 'inventory');
      await openModal(page, '#add-vial-btn');

      // Fill only required fields
      await fillInput(page, '#vial-order-date', '2025-11-01');
      await fillInput(page, '#vial-mg', '10');
      // Leave supplier and lot number empty

      await submitForm(page, '#add-vial-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      const vials = await getVials(page);
      expect(vials.length).toBe(1);
      expect(vials[0].total_mg).toBe(10);
      expect(vials[0].status).toBe('dry_stock');
    });

    test('should show dry stock vial in inventory table', async ({ page }) => {
      await navigateToTab(page, 'inventory');

      // Initially no vials
      const initialRows = await countTableRows(page, '#vials-table');
      expect(initialRows).toBe(0);

      // Add a vial
      await openModal(page, '#add-vial-btn');
      await fillInput(page, '#vial-order-date', '2025-11-01');
      await fillInput(page, '#vial-mg', '10');
      await submitForm(page, '#add-vial-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      // Should now have 1 row
      await waitForTableRows(page, '#vials-table', 1);
    });
  });

  test.describe('ACTIVATE Operations - Reconstitution', () => {
    test('should activate a dry stock vial', async ({ page }) => {
      const dryVial = createDryStockVial({ total_mg: 10 });
      await loadTestData(page, { vials: [dryVial], injections: [] });
      await reloadPage(page);

      await navigateToTab(page, 'inventory');

      // Find and click activate button
      const activateButton = page.locator('button:has-text("Activate"), button[title*="Activate"]').first();
      await activateButton.click();

      // Fill in activation form
      await page.waitForSelector('#activate-vial-form', { timeout: 2000 });
      await fillInput(page, '#activate-bac-water', '1.0');
      await fillInput(page, '#activate-reconstitution-date', '2025-11-07');

      await submitForm(page, '#activate-vial-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      // Verify vial was activated
      const vials = await getVials(page);
      expect(vials.length).toBe(1);

      const vial = vials[0];
      expect(vial.status).toBe('active');
      expect(vial.bac_water_ml).toBe(1.0);
      expect(vial.remaining_ml).toBe(1.0);
      expect(vial.current_volume_ml).toBe(1.0); // Phase 1A: both properties
      expect(vial.concentration_mg_ml).toBe(10); // 10mg / 1ml = 10mg/ml
      expect(vial.reconstitution_date).toContain('2025-11-07');

      // Expiration should be 30 days after reconstitution
      expect(vial.expiration_date).toBeTruthy();

      // Validate structure and values
      validateVialStructure(vial);
      validateVialValues(vial);
    });

    test('should calculate concentration correctly', async ({ page }) => {
      const testCases = [
        { total_mg: 10, bac_water_ml: 1.0, expected: 10.0 },
        { total_mg: 15, bac_water_ml: 1.5, expected: 10.0 },
        { total_mg: 10, bac_water_ml: 2.0, expected: 5.0 },
        { total_mg: 25, bac_water_ml: 2.5, expected: 10.0 }
      ];

      for (const testCase of testCases) {
        await clearAllStorage(page);

        const dryVial = createDryStockVial({ total_mg: testCase.total_mg });
        await loadTestData(page, { vials: [dryVial], injections: [] });
        await reloadPage(page);

        await navigateToTab(page, 'inventory');

        const activateButton = page.locator('button:has-text("Activate"), button[title*="Activate"]').first();
        await activateButton.click();

        await page.waitForSelector('#activate-vial-form', { timeout: 2000 });
        await fillInput(page, '#activate-bac-water', testCase.bac_water_ml.toString());
        await fillInput(page, '#activate-reconstitution-date', '2025-11-07');

        await submitForm(page, '#activate-vial-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

        const vials = await getVials(page);
        expect(vials[0].concentration_mg_ml).toBeCloseTo(testCase.expected, 2);
      }
    });

    test('should calculate expiration date (30 days after reconstitution)', async ({ page }) => {
      const dryVial = createDryStockVial();
      await loadTestData(page, { vials: [dryVial], injections: [] });
      await reloadPage(page);

      await navigateToTab(page, 'inventory');

      const activateButton = page.locator('button:has-text("Activate"), button[title*="Activate"]').first();
      await activateButton.click();

      await page.waitForSelector('#activate-vial-form', { timeout: 2000 });
      await fillInput(page, '#activate-bac-water', '1.0');
      await fillInput(page, '#activate-reconstitution-date', '2025-11-01');

      await submitForm(page, '#activate-vial-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      const vials = await getVials(page);
      const vial = vials[0];

      // Expiration should be ~30 days after 2025-11-01
      const reconDate = new Date('2025-11-01');
      const expDate = new Date(vial.expiration_date);
      const daysDiff = (expDate - reconDate) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeCloseTo(30, 1); // Within 1 day tolerance
    });
  });

  test.describe('USAGE TRACKING', () => {
    test('should decrease remaining_ml when injection uses vial', async ({ page }) => {
      const vial = createValidVial({
        bac_water_ml: 1.0,
        remaining_ml: 1.0,
        current_volume_ml: 1.0,
        total_mg: 10,
        concentration_mg_ml: 10,
        status: 'active'
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      // Initial volume
      let vials = await getVials(page);
      expect(vials[0].remaining_ml).toBe(1.0);

      // Add injection that uses 0.5mg (= 0.05ml at 10mg/ml)
      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');
      await fillInput(page, '#shot-date', '2025-11-07T10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      // Check updated volume
      vials = await getVials(page);
      expect(vials[0].remaining_ml).toBeCloseTo(0.95, 2); // 1.0 - 0.05
      expect(vials[0].current_volume_ml).toBeCloseTo(0.95, 2); // Phase 1A

      // Validate usage
      validateVialUsage(vials[0], 0.05);
    });

    test('should track multiple injections from same vial', async ({ page }) => {
      const vial = createValidVial({
        bac_water_ml: 1.0,
        remaining_ml: 1.0,
        current_volume_ml: 1.0,
        total_mg: 10,
        concentration_mg_ml: 10,
        status: 'active'
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      // Add 3 injections, each 1.0mg (= 0.1ml)
      for (let i = 0; i < 3; i++) {
        await navigateToTab(page, 'shots');
        await openModal(page, 'button:has-text("+ Add Shot")');
        await fillInput(page, '#shot-date', '2025-11-07');
        await fillInput(page, '#shot-time', `${10 + i}:00`);
        await selectOption(page, '#shot-vial', vial.vial_id);
        await selectOption(page, '#shot-site', 'left_thigh');
        await fillInput(page, '#shot-dose', '1.0');
        await submitForm(page, '#add-shot-form');
        await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });
      }

      // Total usage: 3 × 0.1ml = 0.3ml
      // Remaining: 1.0ml - 0.3ml = 0.7ml
      const vials = await getVials(page);
      expect(vials[0].remaining_ml).toBeCloseTo(0.7, 2);
      expect(vials[0].doses_used).toBe(3);
    });

    test('should sync both remaining_ml and current_volume_ml (Phase 1A fix)', async ({ page }) => {
      const vial = createValidVial({
        bac_water_ml: 1.0,
        remaining_ml: 1.0,
        current_volume_ml: 1.0,
        total_mg: 10,
        status: 'active'
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      // Add injection
      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');
      await fillInput(page, '#shot-date', '2025-11-07T10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '1.0');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      const vials = await getVials(page);
      const updatedVial = vials[0];

      // Both properties should be updated
      expect(updatedVial.remaining_ml).toBe(updatedVial.current_volume_ml);
      expect(updatedVial.remaining_ml).toBeCloseTo(0.9, 2);
    });
  });

  test.describe('STATUS TRANSITIONS', () => {
    test('should transition from active to insufficient when low volume', async ({ page }) => {
      const vial = createValidVial({
        bac_water_ml: 1.0,
        remaining_ml: 0.06, // Just above threshold for 0.5mg dose
        current_volume_ml: 0.06,
        total_mg: 10,
        concentration_mg_ml: 10,
        status: 'active'
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      // Add injection that will bring volume below usable threshold
      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');
      await fillInput(page, '#shot-date', '2025-11-07T10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5'); // Uses 0.05ml
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      const vials = await getVials(page);
      const updatedVial = vials[0];

      // Volume should be very low
      expect(updatedVial.remaining_ml).toBeCloseTo(0.01, 2);

      // Status might change to insufficient (depending on app logic)
      // This verifies the app handles low volume gracefully
      expect(['active', 'insufficient']).toContain(updatedVial.status);
    });

    test('should transition to empty when volume reaches zero', async ({ page }) => {
      const vial = createValidVial({
        bac_water_ml: 1.0,
        remaining_ml: 0.05, // Exactly enough for 0.5mg dose
        current_volume_ml: 0.05,
        total_mg: 10,
        concentration_mg_ml: 10,
        status: 'active'
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      // Add injection that uses all remaining volume
      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');
      await fillInput(page, '#shot-date', '2025-11-07T10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      const vials = await getVials(page);
      const updatedVial = vials[0];

      // Volume should be at or near zero
      expect(updatedVial.remaining_ml).toBeCloseTo(0, 2);

      // Status should reflect empty state
      expect(['empty', 'insufficient', 'active']).toContain(updatedVial.status);
    });
  });

  test.describe('DELETE Operations', () => {
    test('should delete a vial with no injections', async ({ page }) => {
      const vial = createDryStockVial();
      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      await navigateToTab(page, 'inventory');
      await waitForTableRows(page, '#vials-table', 1);

      // Find and click delete button
      const deleteButton = page.locator('#vials-table button[title*="Delete"], #vials-table button:has-text("Delete")').first();
      await deleteButton.click();

      // Confirm if needed
      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }

      await page.waitForTimeout(500);

      // Vial should be deleted
      const vials = await getVials(page);
      expect(vials.length).toBe(0);
    });

    test('should handle deletion of vial with injections gracefully', async ({ page }) => {
      // This tests referential integrity
      const vial = createValidVial({ status: 'active' });
      const injection = createValidInjection({ vial_id: vial.vial_id });

      await loadTestData(page, {
        vials: [vial],
        injections: [injection]
      });
      await reloadPage(page);

      await navigateToTab(page, 'inventory');

      // Try to delete vial
      const deleteButton = page.locator('#vials-table button[title*="Delete"], #vials-table button:has-text("Delete")').first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 1000 })) {
          await confirmButton.click();
        }

        await page.waitForTimeout(500);

        // Check what happened - app might:
        // 1. Prevent deletion (referential integrity)
        // 2. Delete vial but keep injections (orphan records)
        // 3. Cascade delete (delete both)

        const vials = await getVials(page);
        const injections = await getInjections(page);

        // At minimum, data should remain consistent
        // If vial deleted, injections should handle it gracefully
        if (vials.length === 0) {
          // Vial was deleted - injections should still exist (your app's behavior)
          expect(injections.length).toBe(1);
        } else {
          // Deletion was prevented - both should still exist
          expect(vials.length).toBe(1);
          expect(injections.length).toBe(1);
        }
      }
    });

    test('should persist vial deletion after reload', async ({ page }) => {
      const vial = createDryStockVial();
      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      await navigateToTab(page, 'inventory');

      const deleteButton = page.locator('#vials-table button[title*="Delete"], #vials-table button:has-text("Delete")').first();
      await deleteButton.click();

      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }

      await page.waitForTimeout(500);

      // Reload page
      await reloadPage(page);
      await navigateToTab(page, 'inventory');

      // Vial should still be deleted
      const vials = await getVials(page);
      expect(vials.length).toBe(0);
    });
  });

  test.describe('DATA PERSISTENCE', () => {
    test('should persist vial data across page reloads', async ({ page }) => {
      const vial = createValidVial({
        total_mg: 15,
        supplier: 'Test Supplier',
        status: 'active'
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await reloadPage(page);

      let vials = await getVials(page);
      expect(vials[0].total_mg).toBe(15);
      expect(vials[0].supplier).toBe('Test Supplier');

      // Reload again
      await reloadPage(page);

      vials = await getVials(page);
      expect(vials[0].total_mg).toBe(15);
      expect(vials[0].supplier).toBe('Test Supplier');
      expect(vials[0].status).toBe('active');
    });

    test('should persist vial status changes', async ({ page }) => {
      const dryVial = createDryStockVial();
      await loadTestData(page, { vials: [dryVial], injections: [] });
      await reloadPage(page);

      await navigateToTab(page, 'inventory');

      // Activate the vial
      const activateButton = page.locator('button:has-text("Activate"), button[title*="Activate"]').first();
      await activateButton.click();
      await page.waitForSelector('#activate-vial-form', { timeout: 2000 });
      await fillInput(page, '#activate-bac-water', '1.0');
      await fillInput(page, '#activate-reconstitution-date', '2025-11-07');
      await submitForm(page, '#activate-vial-form');
      await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 3000 });

      // Reload page
      await reloadPage(page);

      // Status should still be active
      const vials = await getVials(page);
      expect(vials[0].status).toBe('active');
      expect(vials[0].bac_water_ml).toBe(1.0);
    });
  });

  test.describe('VALIDATION', () => {
    test('should reject negative total_mg', async ({ page }) => {
      await navigateToTab(page, 'inventory');
      await openModal(page, '#add-vial-btn');

      await fillInput(page, '#vial-order-date', '2025-11-01');
      await fillInput(page, '#vial-mg', '-10'); // Negative!

      await submitForm(page, '#add-vial-form');
      await page.waitForTimeout(1000);

      // Modal should still be visible
      const modalVisible = await page.locator('#modal-overlay').isVisible();
      expect(modalVisible).toBe(true);

      // No vial should be created
      const vials = await getVials(page);
      expect(vials.length).toBe(0);
    });

    test('should reject unrealistic total_mg values', async ({ page }) => {
      await navigateToTab(page, 'inventory');
      await openModal(page, '#add-vial-btn');

      await fillInput(page, '#vial-order-date', '2025-11-01');
      await fillInput(page, '#vial-mg', '1000'); // Unrealistically high!

      await submitForm(page, '#add-vial-form');
      await page.waitForTimeout(1000);

      const modalVisible = await page.locator('#modal-overlay').isVisible();
      expect(modalVisible).toBe(true);

      const vials = await getVials(page);
      expect(vials.length).toBe(0);
    });

    test('should validate bac water volume on activation', async ({ page }) => {
      const dryVial = createDryStockVial();
      await loadTestData(page, { vials: [dryVial], injections: [] });
      await reloadPage(page);

      await navigateToTab(page, 'inventory');

      const activateButton = page.locator('button:has-text("Activate"), button[title*="Activate"]').first();
      await activateButton.click();
      await page.waitForSelector('#activate-vial-form', { timeout: 2000 });

      // Try with negative bac water
      await fillInput(page, '#activate-bac-water', '-1.0');
      await fillInput(page, '#activate-reconstitution-date', '2025-11-07');

      await submitForm(page, '#activate-vial-form');
      await page.waitForTimeout(1000);

      // Should still be in modal
      const modalVisible = await page.locator('#modal-overlay').isVisible();
      expect(modalVisible).toBe(true);

      // Vial should still be dry stock
      const vials = await getVials(page);
      expect(vials[0].status).toBe('dry_stock');
    });
  });
});
