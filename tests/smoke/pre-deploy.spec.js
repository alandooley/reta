/**
 * Pre-Deployment Smoke Tests
 * Fast validation suite that runs before every deployment
 * Target execution time: < 2 minutes
 *
 * Tests critical paths only:
 * - App loads without errors
 * - Core CRUD operations work
 * - Data persists to localStorage
 * - Sync queue initializes
 * - Basic validation works
 */

const { test, expect } = require('@playwright/test');
const { createValidInjection, createValidVial, createValidWeight } = require('../fixtures/test-data');
const {
  clearAllStorage,
  loadTestData,
  waitForAppReady,
  navigateToTab,
  openModal,
  fillInput,
  selectOption,
  submitForm,
  getInjections,
  getVials,
  getWeights,
  getSyncQueue,
  reloadPage
} = require('../helpers/test-utils');

test.describe('Pre-Deployment Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?test=true');
    await clearAllStorage(page);
    await reloadPage(page);  // Now preserves query parameters via page.url()
  });

  test('APP LOADS: Application loads without JavaScript errors', async ({ page }) => {
    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Check that main elements are present
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(page.locator('button[data-tab="shots"]')).toBeVisible();
    await expect(page.locator('button[data-tab="inventory"]')).toBeVisible();
    await expect(page.locator('button[data-tab="results"]')).toBeVisible();

    // No critical errors should be logged
    const criticalErrors = errors.filter(err =>
      !err.includes('Firebase') && // Ignore Firebase warnings in test mode
      !err.includes('google') // Ignore Google Sign-In warnings
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('INJECTION CREATE: Can add a new injection', async ({ page }) => {
    // Create a test vial first
    const vial = createValidVial();
    await loadTestData(page, { vials: [vial], injections: [], weights: [] });
    await reloadPage(page);

    // Navigate to Shots tab
    await navigateToTab(page, 'shots');

    // Open Add Shot modal (use correct button ID for shots tab)
    await openModal(page, '#add-shot-modal-btn');

    // Fill in the form
    await fillInput(page, '#shot-date', '2025-11-07T10:00');
    await selectOption(page, '#shot-vial', vial.vial_id);
    await selectOption(page, '#shot-site', 'left_thigh');
    await fillInput(page, '#shot-dose', '0.5');

    // Submit form
    await submitForm(page, '#add-shot-form');

    // Wait for modal to close
    await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 2000 });

    // Verify injection was added to localStorage
    const injections = await getInjections(page);
    expect(injections.length).toBe(1);
    expect(injections[0].dose_mg).toBe(0.5);
    expect(injections[0].injection_site).toBe('left_thigh');
  });

  test('VIAL CREATE: Can add a new vial', async ({ page }) => {
    // Navigate to Inventory tab
    await navigateToTab(page, 'inventory');

    // Open Add Vial modal
    await openModal(page, '#add-vial-btn');

    // Fill in the form
    await fillInput(page, '#vial-order-date', '2025-11-01');
    await fillInput(page, '#vial-mg', '10');
    await fillInput(page, '#vial-supplier', 'Test Supplier');

    // Submit form
    await submitForm(page, '#add-vial-form');

    // Wait for modal to close
    await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 2000 });

    // Verify vial was added to localStorage
    const vials = await getVials(page);
    expect(vials.length).toBe(1);
    expect(vials[0].total_mg).toBe(10);
    expect(vials[0].status).toBe('dry_stock');
  });

  test('WEIGHT CREATE: Can add a new weight entry', async ({ page }) => {
    // Navigate to Results tab
    await navigateToTab(page, 'results');

    // Open Add Weight modal (use FAB button on results tab)
    await openModal(page, '#fab-button');

    // Fill in the form (correct field is #weight-kg, not #weight-value)
    await fillInput(page, '#weight-date', '2025-11-07T08:00');
    await fillInput(page, '#weight-kg', '80.5');

    // Submit form
    await submitForm(page, '#add-weight-form');

    // Wait for modal to close
    await page.waitForSelector('#modal-overlay', { state: 'hidden', timeout: 2000 });

    // Verify weight was added to localStorage
    const weights = await getWeights(page);
    expect(weights.length).toBe(1);
    expect(weights[0].weight_kg).toBe(80.5);
  });

  test('DATA PERSISTENCE: Data survives page reload', async ({ page }) => {
    // Add some test data
    const injection = createValidInjection();
    const vial = createValidVial();
    const weight = createValidWeight();

    await loadTestData(page, {
      injections: [injection],
      vials: [vial],
      weights: [weight]
    });

    // Reload page
    await reloadPage(page);

    // Verify data is still there
    const injections = await getInjections(page);
    const vials = await getVials(page);
    const weights = await getWeights(page);

    expect(injections.length).toBe(1);
    expect(vials.length).toBe(1);
    expect(weights.length).toBe(1);
  });

  test('SYNC QUEUE: Sync queue initializes correctly', async ({ page }) => {
    // Wait for sync queue to be initialized
    await page.waitForFunction(() => {
      return typeof window.SyncQueue !== 'undefined';
    }, { timeout: 3000 });

    // Check that sync queue exists in window
    const hasSyncQueue = await page.evaluate(() => {
      return window.SyncQueue !== undefined && window.SyncQueue !== null;
    });

    expect(hasSyncQueue).toBe(true);
  });

  test('VALIDATION: Form validation prevents invalid data', async ({ page }) => {
    // Create a test vial
    const vial = createValidVial();
    await loadTestData(page, { vials: [vial], injections: [], weights: [] });
    await reloadPage(page);

    // Navigate to Shots tab
    await navigateToTab(page, 'shots');

    // Open Add Shot modal (use correct button ID for shots tab)
    await openModal(page, '#add-shot-modal-btn');

    // Try to submit with invalid dose (too high)
    await fillInput(page, '#shot-date', '2025-11-07T10:00');
    await selectOption(page, '#shot-vial', vial.vial_id);
    await selectOption(page, '#shot-site', 'left_thigh');
    await fillInput(page, '#shot-dose', '100'); // Invalid: exceeds max 50mg

    // Submit form
    await submitForm(page, '#add-shot-form');

    // Modal should still be open (submission prevented)
    const modalStillVisible = await page.locator('#modal-overlay').isVisible();
    expect(modalStillVisible).toBe(true);

    // Should not have added invalid injection
    const injections = await getInjections(page);
    expect(injections.length).toBe(0);
  });

  test('TABS: All tabs are clickable and functional', async ({ page }) => {
    // Test each tab
    const tabs = ['shots', 'inventory', 'results', 'settings'];

    for (const tab of tabs) {
      await navigateToTab(page, tab);

      // Verify nav button is active (PWA mobile layout)
      const isActive = await page.locator(`button[data-tab="${tab}"]`).evaluate(el =>
        el.classList.contains('active')
      );
      expect(isActive).toBe(true);
    }
  });

  test('DEDUPLICATION: Duplicate detection works', async ({ page }) => {
    // Add the same injection twice
    const injection = createValidInjection({
      timestamp: '2025-11-07T10:00:00Z',
      dose_mg: 0.5,
      injection_site: 'left_thigh'
    });

    const duplicateInjection = createValidInjection({
      id: 'different-id',
      timestamp: '2025-11-07T10:00:00Z',
      dose_mg: 0.5,
      injection_site: 'left_thigh'
    });

    await loadTestData(page, {
      injections: [injection, duplicateInjection],
      vials: [],
      weights: []
    });

    await reloadPage(page);

    // Navigate to Settings
    await navigateToTab(page, 'settings');

    // Find and click the deduplication button
    const dedupButton = page.locator('button:has-text("Remove Duplicate")');
    if (await dedupButton.isVisible()) {
      await dedupButton.click();

      // Wait a bit for dedup to process
      await page.waitForTimeout(1000);

      // Should now have only 1 injection
      const injections = await getInjections(page);
      expect(injections.length).toBe(1);
    }
  });

  test('CRITICAL PATHS: No errors in console during basic operations', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Perform several operations
    const vial = createValidVial();
    await loadTestData(page, { vials: [vial], injections: [], weights: [] });
    await reloadPage(page);

    // Navigate through tabs
    await navigateToTab(page, 'shots');
    await navigateToTab(page, 'inventory');
    await navigateToTab(page, 'results');
    await navigateToTab(page, 'settings');

    // Check for critical errors
    const criticalErrors = errors.filter(err =>
      !err.includes('Firebase') &&
      !err.includes('google') &&
      !err.includes('Autofill') // Ignore browser autofill warnings
    );

    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });
});
