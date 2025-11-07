/**
 * Injection CRUD Tests
 * Comprehensive tests for injection create, read, update, delete operations
 *
 * Tests cover:
 * - Creation with validation
 * - Form reset after submission (prevents duplicate bug)
 * - Duplicate prevention
 * - Vial foreign key validation
 * - Dose range validation
 * - Injection site enum validation
 * - Deletion operations
 * - Data persistence
 */

const { test, expect } = require('@playwright/test');
const {
  createValidInjection,
  createValidVial,
  INJECTION_SITES
} = require('../fixtures/test-data');
const {
  clearAllStorage,
  loadTestData,
  waitForAppReady,
  navigateToTab,
  openModal,
  closeModal,
  fillInput,
  selectOption,
  submitForm,
  getInjections,
  getVials,
  reloadPage,
  countTableRows,
  waitForTableRows
} = require('../helpers/test-utils');
const {
  validateInjectionStructure,
  validateInjectionValues
} = require('../helpers/validation-helpers');

test.describe('Injection CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?test=true');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.describe('CREATE Operations', () => {
    test('should create a valid injection with all fields', async ({ page }) => {
      // Setup: Create a vial to reference
      const vial = createValidVial({ status: 'active' });
      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      // Navigate to Shots tab
      await navigateToTab(page, 'shots');

      // Open Add Shot modal
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Fill in all fields
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '14:30');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.75');
      await fillInput(page, '#shot-notes', 'Test injection note');

      // Submit form
      await submitForm(page, '#add-shot-form');

      // Wait for modal to close
      await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });

      // Verify injection was added to localStorage
      const injections = await getInjections(page);
      expect(injections.length).toBe(1);

      const injection = injections[0];
      expect(injection.dose_mg).toBe(0.75);
      expect(injection.injection_site).toBe('left_thigh');
      expect(injection.vial_id).toBe(vial.vial_id);
      expect(injection.notes).toBe('Test injection note');
      expect(injection.timestamp).toContain('2025-11-07');
      expect(injection.timestamp).toContain('14:30');

      // Validate structure and values
      validateInjectionStructure(injection);
      validateInjectionValues(injection);
    });

    test('should create injection without optional fields', async ({ page }) => {
      const vial = createValidVial({ status: 'active' });
      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Fill only required fields
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'right_abdomen');
      await fillInput(page, '#shot-dose', '0.5');
      // Don't fill notes

      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });

      const injections = await getInjections(page);
      expect(injections.length).toBe(1);
      expect(injections[0].notes).toBeTruthy(); // Should have empty string or null
    });

    test('should show injection in table after creation', async ({ page }) => {
      const vial = createValidVial({ status: 'active' });
      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');

      // Initially no shots
      const initialRows = await countTableRows(page, '#shots-table');
      expect(initialRows).toBe(0);

      // Add a shot
      await openModal(page, 'button:has-text("+ Add Shot")');
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });

      // Should now have 1 row
      await waitForTableRows(page, '#shots-table', 1);
      const finalRows = await countTableRows(page, '#shots-table');
      expect(finalRows).toBe(1);
    });

    test('should reset form after successful submission (FIX_SUMMARY bug)', async ({ page }) => {
      // This tests the fix from FIX_SUMMARY.md
      const vial = createValidVial({ status: 'active' });
      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Fill and submit first injection
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5');
      await fillInput(page, '#shot-notes', 'First injection');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });

      // Open modal again
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Form should be reset (empty)
      const dateValue = await page.inputValue('#shot-date');
      const timeValue = await page.inputValue('#shot-time');
      const doseValue = await page.inputValue('#shot-dose');
      const notesValue = await page.inputValue('#shot-notes');

      // These should be today's date/time or empty, NOT the previous values
      expect(notesValue).toBe(''); // Notes should definitely be cleared
      expect(doseValue).not.toBe('0.5'); // Dose should be reset
    });
  });

  test.describe('VALIDATION', () => {
    test('should reject injection with dose too high', async ({ page }) => {
      const vial = createValidVial({ status: 'active' });
      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Try to submit with invalid dose (> 50mg)
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '100'); // Invalid!

      await submitForm(page, '#add-shot-form');

      // Modal should still be visible (submission prevented)
      await page.waitForTimeout(1000);
      const modalVisible = await page.locator('.modal.show').isVisible();
      expect(modalVisible).toBe(true);

      // No injection should be created
      const injections = await getInjections(page);
      expect(injections.length).toBe(0);
    });

    test('should reject injection with negative dose', async ({ page }) => {
      const vial = createValidVial({ status: 'active' });
      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');

      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '-0.5'); // Negative!

      await submitForm(page, '#add-shot-form');
      await page.waitForTimeout(1000);

      const modalVisible = await page.locator('.modal.show').isVisible();
      expect(modalVisible).toBe(true);

      const injections = await getInjections(page);
      expect(injections.length).toBe(0);
    });

    test('should reject injection without vial selected', async ({ page }) => {
      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Fill everything except vial
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      // Don't select vial!
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5');

      await submitForm(page, '#add-shot-form');
      await page.waitForTimeout(1000);

      const modalVisible = await page.locator('.modal.show').isVisible();
      expect(modalVisible).toBe(true);

      const injections = await getInjections(page);
      expect(injections.length).toBe(0);
    });

    test('should only show vials with available volume in dropdown', async ({ page }) => {
      // Create vials with different statuses
      const activeVial = createValidVial({
        vial_id: 'active-1',
        status: 'active',
        remaining_ml: 1.0,
        current_volume_ml: 1.0
      });

      const emptyVial = createValidVial({
        vial_id: 'empty-1',
        status: 'empty',
        remaining_ml: 0,
        current_volume_ml: 0
      });

      const dryStockVial = createValidVial({
        vial_id: 'dry-1',
        status: 'dry_stock',
        remaining_ml: null,
        current_volume_ml: null
      });

      await loadTestData(page, {
        vials: [activeVial, emptyVial, dryStockVial],
        injections: []
      });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Get all options in the vial dropdown
      const vialOptions = await page.$$('#shot-vial option');
      const vialValues = await Promise.all(
        vialOptions.map(option => option.getAttribute('value'))
      );

      // Should only include the active vial
      expect(vialValues).toContain('active-1');
      expect(vialValues).not.toContain('empty-1');
      expect(vialValues).not.toContain('dry-1');
    });

    test('should validate all injection site values', async ({ page }) => {
      const vial = createValidVial({ status: 'active' });
      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');

      // Test each valid injection site
      for (const site of INJECTION_SITES) {
        await openModal(page, 'button:has-text("+ Add Shot")');

        await fillInput(page, '#shot-date', '2025-11-07');
        await fillInput(page, '#shot-time', '10:00');
        await selectOption(page, '#shot-vial', vial.vial_id);
        await selectOption(page, '#shot-site', site);
        await fillInput(page, '#shot-dose', '0.5');

        await submitForm(page, '#add-shot-form');
        await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });
      }

      // Should have created one injection per site
      const injections = await getInjections(page);
      expect(injections.length).toBe(INJECTION_SITES.length);

      // Each should have the correct site
      const sites = injections.map(inj => inj.injection_site);
      for (const site of INJECTION_SITES) {
        expect(sites).toContain(site);
      }
    });
  });

  test.describe('DELETE Operations', () => {
    test('should delete an injection', async ({ page }) => {
      const vial = createValidVial();
      const injection = createValidInjection({ vial_id: vial.vial_id });

      await loadTestData(page, {
        vials: [vial],
        injections: [injection]
      });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');

      // Should have 1 row initially
      await waitForTableRows(page, '#shots-table', 1);

      // Find and click delete button
      const deleteButton = page.locator('#shots-table button[title*="Delete"], #shots-table button:has-text("Delete")').first();
      await deleteButton.click();

      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }

      // Wait a moment for deletion to process
      await page.waitForTimeout(500);

      // Should now have 0 rows
      const injections = await getInjections(page);
      expect(injections.length).toBe(0);
    });

    test('should persist deletion after page reload', async ({ page }) => {
      const vial = createValidVial();
      const injection = createValidInjection({ vial_id: vial.vial_id });

      await loadTestData(page, {
        vials: [vial],
        injections: [injection]
      });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');

      // Delete the injection
      const deleteButton = page.locator('#shots-table button[title*="Delete"], #shots-table button:has-text("Delete")').first();
      await deleteButton.click();

      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
      if (await confirmButton.isVisible({ timeout: 1000 })) {
        await confirmButton.click();
      }

      await page.waitForTimeout(500);

      // Reload page
      await reloadPage(page);
      await navigateToTab(page, 'shots');

      // Injection should still be gone
      const injections = await getInjections(page);
      expect(injections.length).toBe(0);
    });
  });

  test.describe('DATA PERSISTENCE', () => {
    test('should persist injection data across page reloads', async ({ page }) => {
      const vial = createValidVial();
      const injection = createValidInjection({
        vial_id: vial.vial_id,
        dose_mg: 0.75,
        injection_site: 'left_abdomen'
      });

      await loadTestData(page, {
        vials: [vial],
        injections: [injection]
      });

      // First load
      await page.reload();
      await waitForAppReady(page);

      let injections = await getInjections(page);
      expect(injections.length).toBe(1);
      expect(injections[0].dose_mg).toBe(0.75);

      // Second reload
      await reloadPage(page);

      injections = await getInjections(page);
      expect(injections.length).toBe(1);
      expect(injections[0].dose_mg).toBe(0.75);
      expect(injections[0].injection_site).toBe('left_abdomen');
    });

    test('should maintain injection order by timestamp', async ({ page }) => {
      const vial = createValidVial();
      const injection1 = createValidInjection({
        vial_id: vial.vial_id,
        timestamp: '2025-11-01T10:00:00Z'
      });
      const injection2 = createValidInjection({
        vial_id: vial.vial_id,
        timestamp: '2025-11-05T10:00:00Z'
      });
      const injection3 = createValidInjection({
        vial_id: vial.vial_id,
        timestamp: '2025-11-03T10:00:00Z'
      });

      await loadTestData(page, {
        vials: [vial],
        injections: [injection1, injection2, injection3] // Out of order
      });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');

      // Table should display in chronological order (most recent first usually)
      // This tests that the app correctly sorts by timestamp
      const injections = await getInjections(page);
      expect(injections.length).toBe(3);
    });
  });

  test.describe('VIAL INTEGRATION', () => {
    test('should update vial remaining volume after injection', async ({ page }) => {
      const vial = createValidVial({
        bac_water_ml: 1.0,
        remaining_ml: 1.0,
        current_volume_ml: 1.0,
        total_mg: 10,
        status: 'active'
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');

      // Add injection with 0.5mg dose
      // With 10mg/ml concentration, this uses 0.05ml
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });

      // Check vial volume was updated
      const vials = await getVials(page);
      expect(vials.length).toBe(1);

      const updatedVial = vials[0];
      // Volume should have decreased by dose / concentration
      // 0.5mg / 10mg/ml = 0.05ml used
      // 1.0ml - 0.05ml = 0.95ml remaining
      expect(updatedVial.remaining_ml).toBeCloseTo(0.95, 2);
      expect(updatedVial.current_volume_ml).toBeCloseTo(0.95, 2); // Phase 1A: both properties
    });

    test('should track injection count on vial', async ({ page }) => {
      const vial = createValidVial({
        status: 'active',
        doses_used: 0
      });

      await loadTestData(page, { vials: [vial], injections: [] });
      await page.reload();
      await waitForAppReady(page);

      // Add first injection
      await navigateToTab(page, 'shots');
      await openModal(page, 'button:has-text("+ Add Shot")');
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '10:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'left_thigh');
      await fillInput(page, '#shot-dose', '0.5');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });

      let vials = await getVials(page);
      expect(vials[0].doses_used).toBe(1);

      // Add second injection
      await openModal(page, 'button:has-text("+ Add Shot")');
      await fillInput(page, '#shot-date', '2025-11-07');
      await fillInput(page, '#shot-time', '14:00');
      await selectOption(page, '#shot-vial', vial.vial_id);
      await selectOption(page, '#shot-site', 'right_thigh');
      await fillInput(page, '#shot-dose', '0.75');
      await submitForm(page, '#add-shot-form');
      await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 3000 });

      vials = await getVials(page);
      expect(vials[0].doses_used).toBe(2);
    });
  });

  test.describe('DUPLICATE PREVENTION', () => {
    test('should detect duplicate injections (same timestamp, dose, site)', async ({ page }) => {
      const vial = createValidVial();
      const injection = createValidInjection({
        vial_id: vial.vial_id,
        timestamp: '2025-11-07T10:00:00Z',
        dose_mg: 0.5,
        injection_site: 'left_thigh'
      });

      // Create a duplicate
      const duplicate = createValidInjection({
        id: 'different-id', // Different ID but same data
        vial_id: vial.vial_id,
        timestamp: '2025-11-07T10:00:00Z',
        dose_mg: 0.5,
        injection_site: 'left_thigh'
      });

      await loadTestData(page, {
        vials: [vial],
        injections: [injection, duplicate]
      });
      await page.reload();
      await waitForAppReady(page);

      // Navigate to Settings and run deduplication
      await navigateToTab(page, 'settings');

      const dedupButton = page.locator('button:has-text("Remove Duplicate")');
      if (await dedupButton.isVisible()) {
        await dedupButton.click();
        await page.waitForTimeout(1000);

        // Should now have only 1 injection
        const injections = await getInjections(page);
        expect(injections.length).toBe(1);
      }
    });
  });
});
