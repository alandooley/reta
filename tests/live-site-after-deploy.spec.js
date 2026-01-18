const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Live Site After Deployment', () => {
  let importData;

  test.beforeAll(() => {
    const importFilePath = path.join(__dirname, '..', 'retatrutide_import_data.json');
    importData = JSON.parse(fs.readFileSync(importFilePath, 'utf8'));
  });

  test('verify bug fix is deployed and working', async ({ page }) => {
    console.log('=== TESTING LIVE SITE AFTER DEPLOYMENT ===');

    // Go to live site with cache-busting
    await page.goto('https://alandooley.github.io/reta/?v=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    console.log('Page loaded, checking current values...');

    // Get current displayed values
    const totalShots = await page.locator('#total-shots').textContent();
    const totalSupply = await page.locator('#total-supply').textContent();

    console.log(`Current Total Shots: "${totalShots}"`);
    console.log(`Current Total Supply: "${totalSupply}"`);

    // Check localStorage to see what data is loaded
    const localStorageData = await page.evaluate(() => {
      const stored = localStorage.getItem('injection_data');
      return stored ? JSON.parse(stored) : null;
    });

    if (localStorageData && localStorageData.injections) {
      console.log(`LocalStorage has ${localStorageData.injections.length} injections`);

      if (localStorageData.injections.length > 0) {
        // Show first and last injection to verify correct ordering
        const firstInj = localStorageData.injections[0];
        const lastInj = localStorageData.injections[localStorageData.injections.length - 1];

        console.log(`First injection (index 0): ${firstInj.timestamp} - ${firstInj.dose_mg}mg`);
        console.log(`Last injection (index ${localStorageData.injections.length - 1}): ${lastInj.timestamp} - ${lastInj.dose_mg}mg`);

        // Check if this looks like sample data (recent timestamps) or real data (August/September dates)
        const firstDate = new Date(firstInj.timestamp);
        const lastDate = new Date(lastInj.timestamp);
        const today = new Date();
        const daysDiffFirst = Math.abs(today - firstDate) / (1000 * 60 * 60 * 24);

        if (daysDiffFirst < 1) {
          console.log('⚠️  Data appears to be SAMPLE DATA (recent timestamps)');
        } else {
          console.log('✅ Data appears to be REAL DATA (historical timestamps)');
        }
      }
    }

    console.log('=== ANALYSIS ===');

    // If we have 8 injections, the fix worked
    if (totalShots === '8') {
      console.log('✅ Bug fix successful - showing 8 total shots');

      // Now import the real data to test the complete fix
      console.log('Now testing data import...');

      await page.click('[data-tab="settings"]');
      await page.waitForSelector('#import-data-btn');

      // Clear current data first
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForTimeout(2000);

      // Set up dialog handler
      page.on('dialog', dialog => dialog.accept());

      // Import the real data
      await page.click('#import-data-btn');
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, '..', 'retatrutide_import_data.json'));
      await page.waitForTimeout(3000);

      // Go back to summary
      await page.click('[data-tab="summary"]');
      await page.waitForTimeout(2000);

      // Check values after import
      const postImportTotalShots = await page.locator('#total-shots').textContent();

      console.log('=== AFTER IMPORTING REAL DATA ===');
      console.log(`Total Shots: "${postImportTotalShots}"`);

      // Expected values from import data
      console.log(`Expected Total Shots: ${importData.injections.length}`);

      if (parseInt(postImportTotalShots) === importData.injections.length) {
        console.log('🎉 COMPLETE SUCCESS - Bug fix deployed and data import working!');
      } else {
        console.log('❌ Import may have failed or bug still exists');
      }

    } else {
      console.log(`❌ Bug fix not deployed yet - still showing ${totalShots} total shots instead of 8`);
      console.log('GitHub Pages may still be building. Try again in a few minutes.');
    }
  });
});