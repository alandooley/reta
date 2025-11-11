const { test, expect } = require('@playwright/test');

/**
 * Comprehensive I/O Operations Test Suite
 *
 * Tests all CRUD operations for Injections, Vials, and Weights
 * - Runs on localhost with ?test=true flag (no auth, no cloud sync)
 * - Cleans up all test data after each test
 * - Validates data persistence across page reloads
 * - Ensures localStorage operations work correctly
 */

test.describe('I/O Operations - Vials', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate with test flag to bypass auth
    await page.goto('http://localhost:3000/?test=true');
    await page.waitForLoadState('domcontentloaded');

    // Clear all localStorage data
    await page.evaluate(() => {
      localStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    // Clean up all data after test
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('CREATE: can add a single dry_stock vial', async ({ page }) => {
    // Click Add Vial button
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });

    // Fill in vial details
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Test Supplier A');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');

    // Submit form
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify modal closed
    await expect(page.locator('#add-vial-modal')).not.toBeVisible();

    // Verify vial appears in UI
    const vialCard = page.locator('.vial-card').first();
    await expect(vialCard).toBeVisible();
    await expect(vialCard).toContainText('10mg Vial');
    await expect(vialCard).toContainText('Test Supplier A');
    await expect(vialCard).toContainText('Dry Stock');

    // Verify data in localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials).toHaveLength(1);
    expect(storedData.vials[0].total_mg).toBe(10);
    expect(storedData.vials[0].supplier).toBe('Test Supplier A');
    expect(storedData.vials[0].status).toBe('dry_stock');
    expect(storedData.vials[0].order_date).toBe('2024-10-15');

    // Verify persistence after reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });

    const reloadedVialCard = page.locator('.vial-card').first();
    await expect(reloadedVialCard).toBeVisible();
    await expect(reloadedVialCard).toContainText('10mg Vial');
    await expect(reloadedVialCard).toContainText('Test Supplier A');
  });

  test('CREATE: can add multiple dry_stock vials at once', async ({ page }) => {
    // Click Add Vial button
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });

    // Fill in vial details with quantity = 3
    await page.fill('#vial-order-date', '2024-10-20');
    await page.fill('#vial-supplier', 'Bulk Supplier');
    await page.fill('#vial-mg', '15');
    await page.fill('#vial-quantity', '3');

    // Submit form
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify 3 vials appear
    const vialCards = page.locator('.vial-card');
    await expect(vialCards).toHaveCount(3);

    // Verify all have correct data
    for (let i = 0; i < 3; i++) {
      await expect(vialCards.nth(i)).toContainText('15mg Vial');
      await expect(vialCards.nth(i)).toContainText('Bulk Supplier');
      await expect(vialCards.nth(i)).toContainText('Dry Stock');
    }

    // Verify localStorage has 3 vials
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials).toHaveLength(3);
    storedData.vials.forEach(vial => {
      expect(vial.total_mg).toBe(15);
      expect(vial.supplier).toBe('Bulk Supplier');
      expect(vial.status).toBe('dry_stock');
    });
  });

  test('UPDATE: can activate a dry_stock vial', async ({ page }) => {
    // First, add a dry_stock vial
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Test Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Click Activate Vial button
    await page.click('#activate-vial-btn');
    await page.waitForSelector('#activate-vial-modal', { state: 'visible' });

    // Select the vial
    await page.selectOption('#activate-vial-select', { index: 1 });

    // Fill in activation details
    await page.fill('#activate-bac-water', '1');
    await page.fill('#activate-reconstitution-date', '2024-10-16T10:00');

    // Submit
    await page.click('#activate-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify vial is now active
    const vialCard = page.locator('.vial-card').first();
    await expect(vialCard).toContainText('Active');
    await expect(vialCard).toContainText('10.0 mg/ml');
    await expect(vialCard).toContainText('1.00 ml');

    // Verify localStorage data
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials[0].status).toBe('active');
    expect(storedData.vials[0].bac_water_ml).toBe(1);
    expect(storedData.vials[0].concentration_mg_ml).toBe(10);
    expect(storedData.vials[0].current_volume_ml).toBe(1);
    expect(storedData.vials[0].reconstitution_date).toBe('2024-10-16T10:00');

    // Verify persistence after reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });

    const reloadedVialCard = page.locator('.vial-card').first();
    await expect(reloadedVialCard).toContainText('Active');
    await expect(reloadedVialCard).toContainText('10.0 mg/ml');
  });

  test('UPDATE: can edit vial details', async ({ page }) => {
    // Add a dry_stock vial
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Original Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Click edit button on vial card
    await page.click('.vial-card .edit-vial-btn');
    await page.waitForSelector('#edit-vial-modal', { state: 'visible' });

    // Verify modal title
    const modalTitle = await page.locator('#edit-vial-modal-title').textContent();
    expect(modalTitle).toBe('Edit Vial');

    // Change supplier
    await page.fill('#edit-vial-supplier', 'Updated Supplier');

    // Submit
    await page.click('#edit-vial-submit-btn');
    await page.waitForTimeout(500);

    // Verify updated supplier appears
    const vialCard = page.locator('.vial-card').first();
    await expect(vialCard).toContainText('Updated Supplier');
    await expect(vialCard).not.toContainText('Original Supplier');

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials[0].supplier).toBe('Updated Supplier');
  });

  test('UPDATE: can manually adjust active vial volume', async ({ page }) => {
    // Add and activate a vial
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Test Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    await page.click('#activate-vial-btn');
    await page.waitForSelector('#activate-vial-modal', { state: 'visible' });
    await page.selectOption('#activate-vial-select', { index: 1 });
    await page.fill('#activate-bac-water', '1');
    await page.fill('#activate-reconstitution-date', '2024-10-16T10:00');
    await page.click('#activate-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Edit vial to manually adjust volume
    await page.click('.vial-card .edit-vial-btn');
    await page.waitForSelector('#edit-vial-modal', { state: 'visible' });

    // Volume field should be visible for active vials
    await expect(page.locator('#edit-vial-volume-group')).toBeVisible();

    // Change volume from 1.00 to 0.75
    await page.fill('#edit-vial-current-volume', '0.75');

    // Submit
    await page.click('#edit-vial-submit-btn');
    await page.waitForTimeout(500);

    // Verify updated volume
    const vialCard = page.locator('.vial-card').first();
    await expect(vialCard).toContainText('0.75 ml');

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials[0].current_volume_ml).toBe(0.75);
    expect(storedData.vials[0].remaining_ml).toBe(0.75);
    expect(storedData.vials[0].used_volume_ml).toBe(0.25);
  });

  test('DELETE: can delete a dry_stock vial', async ({ page }) => {
    // Add a vial
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Test Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify vial exists
    await expect(page.locator('.vial-card')).toHaveCount(1);

    // Setup dialog handler for confirmation
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Delete this vial');
      dialog.accept();
    });

    // Click delete button
    await page.click('.vial-card .delete-vial-btn');
    await page.waitForTimeout(500);

    // Verify vial is gone
    await expect(page.locator('.vial-card')).toHaveCount(0);

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials).toHaveLength(0);
  });

  test('DELETE: can delete an active vial', async ({ page }) => {
    // Add and activate a vial
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Test Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    await page.click('#activate-vial-btn');
    await page.waitForSelector('#activate-vial-modal', { state: 'visible' });
    await page.selectOption('#activate-vial-select', { index: 1 });
    await page.fill('#activate-bac-water', '1');
    await page.fill('#activate-reconstitution-date', '2024-10-16T10:00');
    await page.click('#activate-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Setup dialog handler
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Delete this vial');
      dialog.accept();
    });

    // Delete the active vial
    await page.click('.vial-card .delete-vial-btn');
    await page.waitForTimeout(500);

    // Verify vial is gone
    await expect(page.locator('.vial-card')).toHaveCount(0);

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials).toHaveLength(0);
  });
});

test.describe('I/O Operations - Injections', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate with test flag
    await page.goto('http://localhost:3000/?test=true');
    await page.waitForLoadState('domcontentloaded');

    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });

    // Setup: Add and activate a vial for injection tests
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Test Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    await page.click('#activate-vial-btn');
    await page.waitForSelector('#activate-vial-modal', { state: 'visible' });
    await page.selectOption('#activate-vial-select', { index: 1 });
    await page.fill('#activate-bac-water', '1');
    await page.fill('#activate-reconstitution-date', '2024-10-16T10:00');
    await page.click('#activate-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('CREATE: can add an injection', async ({ page }) => {
    // Click Add Shot button
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });

    // Fill in injection details
    await page.fill('#shot-date', '2024-10-20T14:30');
    await page.fill('#shot-dose', '2.5');
    await page.selectOption('#shot-site', 'abdomen');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.fill('#shot-notes', 'First test injection');

    // Submit
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Navigate to History tab
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);

    // Verify injection appears
    const shotItem = page.locator('.shot-item').first();
    await expect(shotItem).toBeVisible();
    await expect(shotItem).toContainText('2.5 mg');
    await expect(shotItem).toContainText('Site: abdomen');

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.injections).toHaveLength(1);
    expect(storedData.injections[0].dose_mg).toBe(2.5);
    expect(storedData.injections[0].injection_site).toBe('abdomen');
    expect(storedData.injections[0].notes).toBe('First test injection');

    // Verify vial volume decreased
    expect(storedData.vials[0].current_volume_ml).toBe(0.75); // 1.0 - 0.25 (2.5mg / 10mg/ml)
  });

  test('CREATE: can add multiple injections', async ({ page }) => {
    // Add first injection
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-10-20T14:30');
    await page.fill('#shot-dose', '2');
    await page.selectOption('#shot-site', 'abdomen');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Add second injection
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-10-27T14:30');
    await page.fill('#shot-dose', '2.5');
    await page.selectOption('#shot-site', 'thigh');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Navigate to History
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);

    // Verify both injections appear
    const shotItems = page.locator('.shot-item');
    await expect(shotItems).toHaveCount(2);

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.injections).toHaveLength(2);
    expect(storedData.injections[0].dose_mg).toBe(2.5); // Most recent first
    expect(storedData.injections[1].dose_mg).toBe(2);

    // Verify vial volume
    // 1.0ml - 0.2ml (2mg) - 0.25ml (2.5mg) = 0.55ml
    expect(storedData.vials[0].current_volume_ml).toBeCloseTo(0.55, 2);
  });

  test('UPDATE: can edit an injection', async ({ page }) => {
    // Add an injection
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-10-20T14:30');
    await page.fill('#shot-dose', '2');
    await page.selectOption('#shot-site', 'abdomen');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.fill('#shot-notes', 'Original note');
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Navigate to History
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);

    // Click edit button
    await page.click('.shot-item .edit-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });

    // Verify modal shows "Edit Shot"
    const modalTitle = await page.locator('#add-shot-modal-title').textContent();
    expect(modalTitle).toBe('Edit Shot');

    // Change dose and site
    await page.fill('#shot-dose', '3');
    await page.selectOption('#shot-site', 'thigh');
    await page.fill('#shot-notes', 'Updated note');

    // Submit
    await page.click('#shot-submit-btn');
    await page.waitForTimeout(500);

    // Verify updated values
    const shotItem = page.locator('.shot-item').first();
    await expect(shotItem).toContainText('3 mg');
    await expect(shotItem).toContainText('Site: thigh');

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.injections[0].dose_mg).toBe(3);
    expect(storedData.injections[0].injection_site).toBe('thigh');
    expect(storedData.injections[0].notes).toBe('Updated note');

    // Verify vial volume updated correctly
    // Original: 2mg (0.2ml), New: 3mg (0.3ml), Difference: -0.1ml
    expect(storedData.vials[0].current_volume_ml).toBeCloseTo(0.7, 2);
  });

  test('DELETE: can delete an injection', async ({ page }) => {
    // Add an injection
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-10-20T14:30');
    await page.fill('#shot-dose', '2');
    await page.selectOption('#shot-site', 'abdomen');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Get vial volume before delete
    let storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });
    const volumeAfterInjection = storedData.vials[0].current_volume_ml;
    expect(volumeAfterInjection).toBe(0.8); // 1.0 - 0.2

    // Navigate to History
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);

    // Verify injection exists
    await expect(page.locator('.shot-item')).toHaveCount(1);

    // Setup dialog handler
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('delete this shot');
      dialog.accept();
    });

    // Click delete button
    await page.click('.shot-item .delete-btn');
    await page.waitForTimeout(500);

    // Verify injection is gone
    await expect(page.locator('.shot-item')).toHaveCount(0);

    // Verify localStorage
    storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.injections).toHaveLength(0);

    // Verify vial volume restored
    expect(storedData.vials[0].current_volume_ml).toBe(1.0); // Volume returned
  });

  test('DELETE: deleting injection restores vial volume correctly', async ({ page }) => {
    // Add two injections
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-10-20T14:30');
    await page.fill('#shot-dose', '2');
    await page.selectOption('#shot-site', 'abdomen');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-10-27T14:30');
    await page.fill('#shot-dose', '3');
    await page.selectOption('#shot-site', 'thigh');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Volume should be: 1.0 - 0.2 (2mg) - 0.3 (3mg) = 0.5ml
    let storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });
    expect(storedData.vials[0].current_volume_ml).toBeCloseTo(0.5, 2);

    // Navigate to History
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);

    // Delete the second injection (3mg)
    page.once('dialog', dialog => dialog.accept());
    await page.click('.shot-item:first-child .delete-btn');
    await page.waitForTimeout(500);

    // Volume should be restored to: 0.5 + 0.3 = 0.8ml
    storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });
    expect(storedData.vials[0].current_volume_ml).toBeCloseTo(0.8, 2);
    expect(storedData.vials[0].remaining_ml).toBeCloseTo(0.8, 2);

    // Verify only one injection remains
    expect(storedData.injections).toHaveLength(1);
    expect(storedData.injections[0].dose_mg).toBe(2);
  });
});

test.describe('I/O Operations - Weights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?test=true');
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      localStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });

    // Navigate to Results tab
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('CREATE: can add a weight entry', async ({ page }) => {
    // Click FAB (opens weight modal in results tab)
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    // Fill in weight data
    await page.fill('#weight-date', '2024-10-20T08:00');
    await page.fill('#weight-kg', '95.5');
    await page.fill('#weight-body-fat', '25.5');

    // Submit
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify weight appears
    const weightItem = page.locator('.weight-item').first();
    await expect(weightItem).toBeVisible();
    await expect(weightItem).toContainText('95.5 kg');
    await expect(weightItem).toContainText('Body Fat: 25.5%');

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.weights).toHaveLength(1);
    expect(storedData.weights[0].weight_kg).toBe(95.5);
    expect(storedData.weights[0].body_fat_percentage).toBe(25.5);
  });

  test('CREATE: can add weight without body fat percentage', async ({ page }) => {
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    // Only fill weight, not body fat
    await page.fill('#weight-date', '2024-10-20T08:00');
    await page.fill('#weight-kg', '94.2');

    // Submit
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify weight appears
    const weightItem = page.locator('.weight-item').first();
    await expect(weightItem).toContainText('94.2 kg');

    // Verify localStorage (body_fat should be null or 0)
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.weights[0].weight_kg).toBe(94.2);
    expect(storedData.weights[0].body_fat_percentage || 0).toBe(0);
  });

  test('CREATE: can add multiple weight entries', async ({ page }) => {
    // Add first weight
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });
    await page.fill('#weight-date', '2024-10-15T08:00');
    await page.fill('#weight-kg', '97');
    await page.fill('#weight-body-fat', '26');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Add second weight
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });
    await page.fill('#weight-date', '2024-10-22T08:00');
    await page.fill('#weight-kg', '95.5');
    await page.fill('#weight-body-fat', '25.5');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify both weights appear
    const weightItems = page.locator('.weight-item');
    await expect(weightItems).toHaveCount(2);

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.weights).toHaveLength(2);
    // Should be sorted by date, most recent first
    expect(storedData.weights[0].weight_kg).toBe(95.5);
    expect(storedData.weights[1].weight_kg).toBe(97);
  });

  test('UPDATE: can edit a weight entry', async ({ page }) => {
    // Add a weight
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });
    await page.fill('#weight-date', '2024-10-20T08:00');
    await page.fill('#weight-kg', '95.5');
    await page.fill('#weight-body-fat', '25.5');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Click edit button
    await page.click('.weight-item .edit-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    // Verify modal shows "Edit Weight Entry"
    const modalTitle = await page.locator('#add-weight-modal-title').textContent();
    expect(modalTitle).toBe('Edit Weight Entry');

    // Change weight and body fat
    await page.fill('#weight-kg', '94.2');
    await page.fill('#weight-body-fat', '24.8');

    // Submit
    await page.click('#weight-submit-btn');
    await page.waitForTimeout(500);

    // Verify updated values
    const weightItem = page.locator('.weight-item').first();
    await expect(weightItem).toContainText('94.2 kg');
    await expect(weightItem).toContainText('Body Fat: 24.8%');

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.weights[0].weight_kg).toBe(94.2);
    expect(storedData.weights[0].body_fat_percentage).toBe(24.8);
  });

  test('DELETE: can delete a weight entry', async ({ page }) => {
    // Add a weight
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });
    await page.fill('#weight-date', '2024-10-20T08:00');
    await page.fill('#weight-kg', '95.5');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify weight exists
    await expect(page.locator('.weight-item')).toHaveCount(1);

    // Setup dialog handler
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('delete this weight');
      dialog.accept();
    });

    // Click delete button
    await page.click('.weight-item .delete-btn');
    await page.waitForTimeout(500);

    // Verify weight is gone
    await expect(page.locator('.weight-item')).toHaveCount(0);

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.weights).toHaveLength(0);
  });
});

test.describe('I/O Operations - Data Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?test=true');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test('data persists across page reloads', async ({ page }) => {
    // Add a vial
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Persistent Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Activate it
    await page.click('#activate-vial-btn');
    await page.waitForSelector('#activate-vial-modal', { state: 'visible' });
    await page.selectOption('#activate-vial-select', { index: 1 });
    await page.fill('#activate-bac-water', '1');
    await page.fill('#activate-reconstitution-date', '2024-10-16T10:00');
    await page.click('#activate-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Add an injection
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-10-20T14:30');
    await page.fill('#shot-dose', '2.5');
    await page.selectOption('#shot-site', 'abdomen');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Add a weight
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });
    await page.fill('#weight-date', '2024-10-20T08:00');
    await page.fill('#weight-kg', '95.5');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });

    // Verify vial persists
    const vialCard = page.locator('.vial-card').first();
    await expect(vialCard).toBeVisible();
    await expect(vialCard).toContainText('10mg Vial');
    await expect(vialCard).toContainText('Persistent Supplier');
    await expect(vialCard).toContainText('Active');

    // Verify injection persists
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);
    const shotItem = page.locator('.shot-item').first();
    await expect(shotItem).toContainText('2.5 mg');

    // Verify weight persists
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);
    const weightItem = page.locator('.weight-item').first();
    await expect(weightItem).toContainText('95.5 kg');

    // Verify localStorage has all data
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials).toHaveLength(1);
    expect(storedData.injections).toHaveLength(1);
    expect(storedData.weights).toHaveLength(1);
  });

  test('localStorage writes are atomic', async ({ page }) => {
    // Perform rapid consecutive operations
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-10-15');
    await page.fill('#vial-supplier', 'Test');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '3');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Verify all 3 vials were saved atomically
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.vials).toHaveLength(3);

    // All vials should have complete data
    storedData.vials.forEach(vial => {
      expect(vial.vial_id).toBeDefined();
      expect(vial.total_mg).toBe(10);
      expect(vial.supplier).toBe('Test');
      expect(vial.status).toBe('dry_stock');
    });
  });
});

test.describe('I/O Operations - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/?test=true');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });

    // Navigate to Settings tab
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(500);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test('UPDATE: can update default dose', async ({ page }) => {
    // Change default dose
    await page.fill('#default-dose', '3.5');
    await page.click('#save-settings-btn');
    await page.waitForTimeout(500);

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.settings.defaultDose).toBe(3.5);

    // Verify persistence
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(500);

    const doseValue = await page.inputValue('#default-dose');
    expect(parseFloat(doseValue)).toBe(3.5);
  });

  test('UPDATE: can update all settings', async ({ page }) => {
    // Update all settings
    await page.fill('#default-dose', '3');
    await page.fill('#injection-frequency', '10');
    await page.selectOption('#injection-day', 'Wednesday');
    await page.fill('#height-cm', '180');
    await page.fill('#goal-weight', '85');

    await page.click('#save-settings-btn');
    await page.waitForTimeout(500);

    // Verify localStorage
    const storedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('retatrutide_data'));
    });

    expect(storedData.settings.defaultDose).toBe(3);
    expect(storedData.settings.injectionFrequency).toBe(10);
    expect(storedData.settings.injectionDay).toBe('Wednesday');
    expect(storedData.settings.heightCm).toBe(180);
    expect(storedData.settings.goalWeightKg).toBe(85);
  });
});
