/**
 * Verify Vials Data Test
 *
 * This test verifies that vial data is correctly displayed after cloud sync
 */

const { test, expect } = require('@playwright/test');

test.describe('Vials Data Verification', () => {
  test.setTimeout(60000); // 1 minute

  test('should display vials correctly with proper data', async ({ page }) => {
    console.log('Navigating to localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Wait for auth
    console.log('Waiting for authentication...');
    await page.waitForFunction(
      () => window.app && window.authManager && window.authManager.isAuthenticated(),
      { timeout: 30000 }
    );

    console.log('✓ Authenticated');

    // Wait for data sync
    await page.waitForTimeout(3000);

    // Navigate to Vials page
    console.log('Navigating to Vials page...');
    await page.click('button:has-text("Inventory")');
    await page.waitForTimeout(500);

    // Check vials data
    console.log('Checking vials data...');
    const vialsData = await page.evaluate(() => {
      const vials = window.app.data.vials || [];
      return {
        count: vials.length,
        vials: vials.map(v => ({
          vial_id: v.vial_id,
          status: v.status,
          total_mg: v.total_mg,
          concentration_mg_ml: v.concentration_mg_ml,
          order_date: v.order_date,
          has_valid_id: !!v.vial_id && v.vial_id !== 'undefined',
          has_valid_date: !!v.order_date && v.order_date !== 'Invalid Date'
        }))
      };
    });

    console.log('Vials count:', vialsData.count);
    console.log('Vials data:', JSON.stringify(vialsData.vials, null, 2));

    // Verify we have vials
    expect(vialsData.count).toBeGreaterThan(0);

    // Verify each vial has valid data
    for (const vial of vialsData.vials) {
      console.log(`Checking vial ${vial.vial_id}...`);

      expect(vial.has_valid_id, `Vial should have valid ID, got: ${vial.vial_id}`).toBe(true);
      expect(vial.has_valid_date, `Vial should have valid date, got: ${vial.order_date}`).toBe(true);

      // Active vials should have concentration
      if (vial.status === 'active') {
        expect(vial.concentration_mg_ml, 'Active vial should have concentration').toBeTruthy();
      }

      // Dry stock vials should have total_mg
      if (vial.status === 'dry_stock') {
        expect(vial.total_mg, 'Dry stock vial should have total_mg').toBeTruthy();
      }
    }

    // Check UI display
    console.log('Checking UI display...');
    const vialCards = page.locator('.vial-card, [class*="vial"]');
    const cardCount = await vialCards.count();

    console.log('Vial cards found:', cardCount);
    expect(cardCount).toBe(vialsData.count);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/vials-verification.png', fullPage: true });
    console.log('Screenshot saved to tests/screenshots/vials-verification.png');

    console.log('✓ All vials data verified successfully');
  });
});
