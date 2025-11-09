const { test, expect } = require('@playwright/test');

test.describe('Edit Functionality', () => {

  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });

    // Navigate to page with test flag
    await page.goto('http://localhost:3000/?test=true');
    await page.waitForLoadState('domcontentloaded');

    // Clear localStorage and reload
    await page.evaluate(() => {
      localStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });
  });

  test('can edit an injection', async ({ page }) => {
    // First, add a vial
    await page.click('#add-vial-btn');
    await page.waitForSelector('#add-vial-modal', { state: 'visible' });
    await page.fill('#vial-order-date', '2024-01-15');
    await page.fill('#vial-supplier', 'Test Supplier');
    await page.fill('#vial-mg', '10');
    await page.fill('#vial-quantity', '1');
    await page.click('#add-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Activate the vial
    await page.click('#activate-vial-btn');
    await page.waitForSelector('#activate-vial-modal', { state: 'visible' });
    await page.selectOption('#activate-vial-select', { index: 1 });
    await page.fill('#activate-bac-water', '1');
    await page.fill('#activate-reconstitution-date', '2024-01-16T10:00');
    await page.click('#activate-vial-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Add an injection
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    await page.fill('#shot-date', '2024-01-20T14:30');
    await page.fill('#shot-dose', '4.0');
    await page.selectOption('#shot-site', 'abdomen');
    await page.selectOption('#shot-vial', { index: 1 });
    await page.fill('#shot-notes', 'Original injection note');
    await page.click('#add-shot-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Navigate to History tab to see the injection
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);

    // Click edit button on the injection
    const editBtn = page.locator('.shot-item .edit-btn').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Wait for modal to open with edit title
    await page.waitForSelector('#add-shot-modal', { state: 'visible' });
    const modalTitle = await page.locator('#add-shot-modal-title').textContent();
    expect(modalTitle).toBe('Edit Shot');

    // Verify form is pre-filled
    const dateValue = await page.inputValue('#shot-date');
    expect(dateValue).toBe('2024-01-20T14:30');
    const doseValue = await page.inputValue('#shot-dose');
    expect(doseValue).toBe('4');

    // Edit the injection
    await page.fill('#shot-dose', '5.0');
    await page.selectOption('#shot-site', 'thigh');
    await page.fill('#shot-notes', 'Updated injection note');

    // Submit the changes
    const submitBtn = await page.locator('#shot-submit-btn').textContent();
    expect(submitBtn).toBe('Save Changes');
    await page.click('#shot-submit-btn');
    await page.waitForTimeout(500);

    // Verify the injection was updated
    const shotItem = page.locator('.shot-item').first();
    await expect(shotItem).toContainText('5 mg');
    await expect(shotItem).toContainText('Site: thigh');

    // Verify data persists after reload
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });
    await page.click('[data-tab="history"]');
    await page.waitForTimeout(500);

    const reloadedShotItem = page.locator('.shot-item').first();
    await expect(reloadedShotItem).toContainText('5 mg');
    await expect(reloadedShotItem).toContainText('Site: thigh');
  });

  test('can edit a weight entry', async ({ page }) => {
    // Add a weight entry
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);

    // Click FAB button (which opens weight modal in results tab)
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    await page.fill('#weight-date', '2024-01-15T09:00');
    await page.fill('#weight-kg', '95.5');
    await page.fill('#weight-body-fat', '25');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Click edit button on the weight entry
    const editBtn = page.locator('.weight-item .edit-btn').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Wait for modal to open with edit title
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });
    const modalTitle = await page.locator('#add-weight-modal-title').textContent();
    expect(modalTitle).toBe('Edit Weight Entry');

    // Verify form is pre-filled
    const dateValue = await page.inputValue('#weight-date');
    expect(dateValue).toBe('2024-01-15T09:00');
    const weightValue = await page.inputValue('#weight-kg');
    expect(weightValue).toBe('95.5');
    const bodyFatValue = await page.inputValue('#weight-body-fat');
    expect(bodyFatValue).toBe('25');

    // Edit the weight entry
    await page.fill('#weight-kg', '94.2');
    await page.fill('#weight-body-fat', '24');

    // Submit the changes
    const submitBtn = await page.locator('#weight-submit-btn').textContent();
    expect(submitBtn).toBe('Save Changes');
    await page.click('#weight-submit-btn');
    await page.waitForTimeout(500);

    // Verify the weight was updated
    const weightItem = page.locator('.weight-item').first();
    await expect(weightItem).toContainText('94.2 kg');
    await expect(weightItem).toContainText('Body Fat: 24%');

    // Verify data persists after reload
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.waitForSelector('#loading-screen', { state: 'hidden', timeout: 10000 });
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);

    const reloadedWeightItem = page.locator('.weight-item').first();
    await expect(reloadedWeightItem).toContainText('94.2 kg');
    await expect(reloadedWeightItem).toContainText('Body Fat: 24%');
  });

  test('can cancel edit without saving', async ({ page }) => {
    // Add a weight entry
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);

    // Click FAB button (which opens weight modal in results tab)
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    await page.fill('#weight-date', '2024-01-15T09:00');
    await page.fill('#weight-kg', '95.5');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Click edit button
    const editBtn = page.locator('.weight-item .edit-btn').first();
    await editBtn.click();
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    // Change the value
    await page.fill('#weight-kg', '100.0');

    // Cancel instead of saving
    await page.click('.modal-close');
    await page.waitForTimeout(300);

    // Verify the original value is still there
    const weightItem = page.locator('.weight-item').first();
    await expect(weightItem).toContainText('95.5 kg');
    await expect(weightItem).not.toContainText('100.0 kg');
  });

  test('validates required fields during edit', async ({ page }) => {
    // Add a weight entry
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);

    // Click FAB button (which opens weight modal in results tab)
    await page.click('#add-shot-btn');
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    await page.fill('#weight-date', '2024-01-15T09:00');
    await page.fill('#weight-kg', '95.5');
    await page.click('#add-weight-modal button[type="submit"]');
    await page.waitForTimeout(500);

    // Click edit button
    const editBtn = page.locator('.weight-item .edit-btn').first();
    await editBtn.click();
    await page.waitForSelector('#add-weight-modal', { state: 'visible' });

    // Clear required field
    await page.fill('#weight-kg', '');

    // Try to submit - should fail validation
    await page.click('#weight-submit-btn');

    // Modal should still be visible (form validation failed)
    await expect(page.locator('#add-weight-modal')).toBeVisible();

    // Cancel and verify original data intact
    await page.click('.modal-close');
    await page.waitForTimeout(300);

    const weightItem = page.locator('.weight-item').first();
    await expect(weightItem).toContainText('95.5 kg');
  });

  test('edit buttons are visible on all items', async ({ page }) => {
    // Add multiple weight entries
    await page.click('[data-tab="results"]');
    await page.waitForTimeout(500);

    for (let i = 0; i < 3; i++) {
      // Click FAB button (which opens weight modal in results tab)
      await page.click('#add-shot-btn');
      await page.waitForSelector('#add-weight-modal', { state: 'visible' });

      await page.fill('#weight-date', `2024-01-${15 + i}T09:00`);
      await page.fill('#weight-kg', `${95 - i}`);
      await page.click('#add-weight-modal button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // Verify all weight items have edit buttons
    const editButtons = page.locator('.weight-item .edit-btn');
    const count = await editButtons.count();
    expect(count).toBe(3);

    // Verify all edit buttons are visible
    for (let i = 0; i < count; i++) {
      await expect(editButtons.nth(i)).toBeVisible();
    }
  });
});
