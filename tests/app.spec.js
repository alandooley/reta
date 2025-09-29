const { test, expect } = require('@playwright/test');

test.describe('Retatrutide Tracker App', () => {

  test.beforeEach(async ({ page }) => {
    // Load with test parameter to prevent sample data loading
    await page.goto('/?test=true');

    // Clear localStorage after page loads
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Reload with test parameter to apply clean state
    await page.reload();

    // Wait for app to initialize
    await page.waitForTimeout(1000);
  });

  test('app loads and displays main interface', async ({ page }) => {
    // Check header elements
    await expect(page.locator('#app-header')).toBeVisible();
    await expect(page.locator('#menu-btn')).toBeVisible();
    await expect(page.locator('#add-shot-btn')).toBeVisible();
    await expect(page.locator('#current-date')).toBeVisible();

    // Check bottom navigation
    await expect(page.locator('.bottom-nav')).toBeVisible();
    const navButtons = page.locator('.nav-btn');
    await expect(navButtons).toHaveCount(5);

    // Check Summary tab is active by default
    const summaryTab = page.locator('#summary-tab');
    await expect(summaryTab).toBeVisible();
  });

  test('navigation between tabs works', async ({ page }) => {
    // Navigate to each tab
    const tabs = ['shots', 'results', 'inventory', 'settings'];

    for (const tab of tabs) {
      await page.click(`[data-tab="${tab}"]`);
      const tabContent = page.locator(`#${tab}-tab`);
      await expect(tabContent).toBeVisible();

      // Check that nav button is active
      const navBtn = page.locator(`[data-tab="${tab}"]`);
      await expect(navBtn).toHaveClass(/active/);
    }

    // Return to summary
    await page.click('[data-tab="summary"]');
    await expect(page.locator('#summary-tab')).toBeVisible();
  });

  test('can add a vial', async ({ page }) => {
    // Navigate to inventory tab
    await page.click('[data-tab="inventory"]');
    await expect(page.locator('#inventory-tab')).toBeVisible();

    // Click add vial button
    await page.click('#add-vial-btn');

    // Wait for modal
    await expect(page.locator('#add-vial-modal')).toBeVisible();

    // Fill in vial form
    const today = new Date().toISOString().split('T')[0];
    await page.fill('#vial-order-date', today);
    await page.fill('#vial-supplier', 'Test Pharmacy');
    await page.fill('#vial-lot', 'TEST123');
    await page.fill('#vial-cost', '299.99');
    await page.fill('#vial-mg', '15');
    await page.fill('#vial-bac-water', '1.5');

    // Set reconstitution date
    const reconDate = new Date().toISOString().slice(0, 16);
    await page.fill('#vial-reconstitution-date', reconDate);

    // Submit form
    await page.click('#add-vial-form button[type="submit"]');

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Verify vial appears in list
    const vialsList = page.locator('#vials-list .vial-item');
    await expect(vialsList).toHaveCount(1);

    // Verify vial details
    await expect(page.locator('.vial-title').first()).toContainText('15mg Vial');
    await expect(page.locator('.vial-subtitle').first()).toContainText('Test Pharmacy');
  });

  test('can add an injection', async ({ page }) => {
    // First add a vial
    await page.click('[data-tab="inventory"]');
    await page.click('#add-vial-btn');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('#vial-order-date', today);
    await page.fill('#vial-supplier', 'Test Pharmacy');
    await page.fill('#vial-mg', '15');
    await page.fill('#vial-bac-water', '1.5');
    const reconDate = new Date().toISOString().slice(0, 16);
    await page.fill('#vial-reconstitution-date', reconDate);
    await page.click('#add-vial-form button[type="submit"]');
    await page.waitForTimeout(500);

    // Navigate to shots tab
    await page.click('[data-tab="shots"]');

    // Click add shot button
    await page.click('#add-shot-modal-btn');

    // Wait for modal
    await expect(page.locator('#add-shot-modal')).toBeVisible();

    // Fill in shot form
    const shotDate = new Date().toISOString().slice(0, 16);
    await page.fill('#shot-date', shotDate);
    await page.fill('#shot-dose', '2.5');
    await page.selectOption('#shot-site', 'left_thigh');

    // Select the vial we just created
    await page.selectOption('#shot-vial', { index: 1 }); // First option after placeholder

    // Add optional weight
    await page.fill('#shot-weight', '82.5');
    await page.fill('#shot-notes', 'Test injection');

    // Submit form
    await page.click('#add-shot-form button[type="submit"]');

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Verify injection appears in list
    const shotsList = page.locator('#shots-list .shot-item');
    await expect(shotsList).toHaveCount(1);

    // Verify injection details
    await expect(page.locator('.shot-dose').first()).toContainText('2.5 mg');
    await expect(page.locator('.shot-details').first()).toContainText('left_thigh');
  });

  test('summary tab shows correct statistics', async ({ page }) => {
    // Add a vial and injection first
    await page.click('[data-tab="inventory"]');
    await page.click('#add-vial-btn');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('#vial-order-date', today);
    await page.fill('#vial-mg', '15');
    await page.fill('#vial-bac-water', '1.5');
    const reconDate = new Date().toISOString().slice(0, 16);
    await page.fill('#vial-reconstitution-date', reconDate);
    await page.click('#add-vial-form button[type="submit"]');
    await page.waitForTimeout(500);

    // Add injection
    await page.click('[data-tab="shots"]');
    await page.click('#add-shot-modal-btn');
    const shotDate = new Date().toISOString().slice(0, 16);
    await page.fill('#shot-date', shotDate);
    await page.fill('#shot-dose', '2.0');
    await page.selectOption('#shot-site', 'left_thigh');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-form button[type="submit"]');
    await page.waitForTimeout(500);

    // Navigate to summary tab
    await page.click('[data-tab="summary"]');

    // Check statistics
    const totalShots = page.locator('#total-shots');
    await expect(totalShots).toContainText('1');

    const lastDose = page.locator('#last-dose');
    await expect(lastDose).toContainText('2 mg');

    // Check that countdown is visible
    await expect(page.locator('.countdown-container')).toBeVisible();
    await expect(page.locator('#countdown-days')).toBeVisible();
  });

  test('can add weight entry', async ({ page }) => {
    // Navigate to results tab
    await page.click('[data-tab="results"]');

    // Click add weight button (dynamically created)
    await page.waitForSelector('.btn-secondary:has-text("Add Weight")', { timeout: 5000 });
    await page.click('.btn-secondary:has-text("Add Weight")');

    // Wait for modal
    await expect(page.locator('#add-weight-modal')).toBeVisible();

    // Fill in weight form
    const weightDate = new Date().toISOString().slice(0, 16);
    await page.fill('#weight-date', weightDate);
    await page.fill('#weight-kg', '82.5');
    await page.fill('#weight-body-fat', '18.5');

    // Submit form
    await page.click('#add-weight-form button[type="submit"]');

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Verify weight is recorded (check in localStorage since no direct display)
    const data = await page.evaluate(() => {
      const stored = localStorage.getItem('retatrutide_data');
      return stored ? JSON.parse(stored) : null;
    });

    expect(data).toBeTruthy();
    expect(data.weights).toHaveLength(1);
    expect(data.weights[0].weight_kg).toBe(82.5);
    expect(data.weights[0].body_fat_percentage).toBe(18.5);
  });

  test('inventory analytics updates correctly', async ({ page }) => {
    // Add a vial
    await page.click('[data-tab="inventory"]');
    await page.click('#add-vial-btn');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('#vial-order-date', today);
    await page.fill('#vial-mg', '15');
    await page.fill('#vial-bac-water', '1.5');
    await page.fill('#vial-cost', '299.99');
    const reconDate = new Date().toISOString().slice(0, 16);
    await page.fill('#vial-reconstitution-date', reconDate);
    await page.click('#add-vial-form button[type="submit"]');
    await page.waitForTimeout(500);

    // Check inventory stats
    const totalStock = page.locator('#total-stock');
    await expect(totalStock).toBeVisible();
    const stockValue = await totalStock.textContent();
    expect(parseInt(stockValue)).toBeGreaterThan(0);

    const daysRemaining = page.locator('#days-remaining');
    await expect(daysRemaining).toBeVisible();

    const costPerDose = page.locator('#cost-per-dose');
    await expect(costPerDose).toContainText('$');

    // Check analytics cards
    const reorderAlert = page.locator('#reorder-alert');
    await expect(reorderAlert).toBeVisible();

    const usageRate = page.locator('#usage-rate');
    await expect(usageRate).toBeVisible();
  });

  test('settings can be modified', async ({ page }) => {
    // Navigate to settings tab
    await page.click('[data-tab="settings"]');

    // Change injection frequency
    await page.selectOption('#injection-frequency', '14');

    // Verify setting is saved
    const data = await page.evaluate(() => {
      const stored = localStorage.getItem('retatrutide_data');
      return stored ? JSON.parse(stored) : null;
    });

    expect(data.settings.injectionFrequency).toBe(14);
  });

  test('data export works', async ({ page }) => {
    // Navigate to settings
    await page.click('[data-tab="settings"]');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('#export-data-btn');

    // Wait for download
    const download = await downloadPromise;

    // Verify download filename contains expected pattern
    expect(download.suggestedFilename()).toContain('retatrutide_data_');
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('modal close buttons work', async ({ page }) => {
    // Test shot modal
    await page.click('[data-tab="shots"]');
    await page.click('#add-shot-modal-btn');
    await expect(page.locator('#add-shot-modal')).toBeVisible();

    // Click cancel button
    await page.click('#add-shot-modal button:has-text("Cancel")');
    await page.waitForTimeout(500);
    await expect(page.locator('#add-shot-modal')).not.toBeVisible();

    // Test vial modal
    await page.click('[data-tab="inventory"]');
    await page.click('#add-vial-btn');
    await expect(page.locator('#add-vial-modal')).toBeVisible();

    // Click close X button
    await page.click('#add-vial-modal .modal-close');
    await page.waitForTimeout(500);
    await expect(page.locator('#add-vial-modal')).not.toBeVisible();
  });

  test('countdown timer updates', async ({ page }) => {
    // Add an injection to start countdown
    await page.click('[data-tab="inventory"]');
    await page.click('#add-vial-btn');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('#vial-order-date', today);
    await page.fill('#vial-mg', '15');
    await page.fill('#vial-bac-water', '1.5');
    const reconDate = new Date().toISOString().slice(0, 16);
    await page.fill('#vial-reconstitution-date', reconDate);
    await page.click('#add-vial-form button[type="submit"]');
    await page.waitForTimeout(500);

    await page.click('[data-tab="shots"]');
    await page.click('#add-shot-modal-btn');
    const shotDate = new Date().toISOString().slice(0, 16);
    await page.fill('#shot-date', shotDate);
    await page.fill('#shot-dose', '2.0');
    await page.selectOption('#shot-site', 'left_thigh');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.click('#add-shot-form button[type="submit"]');
    await page.waitForTimeout(500);

    // Go to summary tab
    await page.click('[data-tab="summary"]');

    // Check countdown is displayed
    const countdownDays = page.locator('#countdown-days');
    await expect(countdownDays).toBeVisible();

    const countdownTime = page.locator('#countdown-time');
    await expect(countdownTime).toBeVisible();

    // Get initial time
    const initialTime = await countdownTime.textContent();

    // Wait 2 seconds
    await page.waitForTimeout(2000);

    // Check time has changed
    const updatedTime = await countdownTime.textContent();
    expect(updatedTime).not.toBe(initialTime);
  });

  test('localStorage persists data', async ({ page }) => {
    // Add a vial
    await page.click('[data-tab="inventory"]');
    await page.click('#add-vial-btn');

    const today = new Date().toISOString().split('T')[0];
    await page.fill('#vial-order-date', today);
    await page.fill('#vial-supplier', 'Persistent Pharmacy');
    await page.fill('#vial-mg', '20');
    await page.fill('#vial-bac-water', '2.0');
    const reconDate = new Date().toISOString().slice(0, 16);
    await page.fill('#vial-reconstitution-date', reconDate);
    await page.click('#add-vial-form button[type="submit"]');
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Navigate to inventory and check vial persisted
    await page.click('[data-tab="inventory"]');
    await expect(page.locator('.vial-title').first()).toContainText('20mg Vial');
    await expect(page.locator('.vial-subtitle').first()).toContainText('Persistent Pharmacy');
  });

  test('sample data loads on fresh start', async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Reload page WITHOUT test parameter to trigger sample data
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Check that sample data is loaded
    const data = await page.evaluate(() => {
      const stored = localStorage.getItem('retatrutide_data');
      return stored ? JSON.parse(stored) : null;
    });

    expect(data).toBeTruthy();
    expect(data.vials.length).toBeGreaterThan(0);
    expect(data.weights.length).toBeGreaterThan(0);
    expect(data.injections.length).toBeGreaterThan(0);

    // Verify UI shows sample data
    await expect(page.locator('#total-shots')).not.toContainText('0');
  });

  test('chart containers are rendered', async ({ page }) => {
    // Check medication chart on summary tab
    await page.click('[data-tab="summary"]');
    const medChart = page.locator('#medication-chart');
    await expect(medChart).toBeVisible();

    // Check weight chart on results tab
    await page.click('[data-tab="results"]');
    const weightChart = page.locator('#weight-chart');
    await expect(weightChart).toBeVisible();
  });

  test('responsive design works on mobile viewport', async ({ page }) => {
    // Viewport is already set to mobile in config
    // Check that elements are properly displayed

    // Bottom nav should be visible
    await expect(page.locator('.bottom-nav')).toBeVisible();

    // Check that nav buttons stack properly
    const navButtons = page.locator('.nav-btn');
    const firstButton = await navButtons.first().boundingBox();
    const lastButton = await navButtons.last().boundingBox();

    // They should be on the same horizontal line (approximately same Y position)
    expect(Math.abs(firstButton.y - lastButton.y)).toBeLessThan(5);

    // Check stats grid responds to mobile
    await page.click('[data-tab="summary"]');
    const statsGrid = page.locator('.stats-grid');
    await expect(statsGrid).toBeVisible();
  });
});