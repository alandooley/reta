const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Live Site Values Check', () => {
  let importData;

  test.beforeAll(() => {
    // Load the import data to compare against
    const importFilePath = path.join(__dirname, '..', 'retatrutide_import_data.json');
    importData = JSON.parse(fs.readFileSync(importFilePath, 'utf8'));
  });

  test('check live site values at https://alandooley.github.io/reta/', async ({ page }) => {
    console.log('=== ANALYZING EXPECTED VALUES FROM IMPORT DATA ===');

    // Analyze import data to determine expected values
    const totalExpectedShots = importData.injections.length;
    const sortedInjections = importData.injections.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const lastInjection = sortedInjections[sortedInjections.length - 1]; // Most recent
    const expectedLastDose = lastInjection.dose_mg;
    const expectedLevel = lastInjection.medication_level_at_injection;

    console.log(`Expected Total Shots: ${totalExpectedShots}`);
    console.log(`Expected Last Dose: ${expectedLastDose} mg`);
    console.log(`Expected Level at Last Shot: ${expectedLevel} mg`);
    console.log(`Last injection timestamp: ${lastInjection.timestamp}`);

    // Calculate expected next shot
    const lastShotDate = new Date(lastInjection.timestamp);
    const expectedNextShotDate = new Date(lastShotDate);
    expectedNextShotDate.setDate(expectedNextShotDate.getDate() + importData.settings.injectionFrequency);
    const now = new Date();
    const daysDiff = Math.ceil((expectedNextShotDate - now) / (1000 * 60 * 60 * 24));

    console.log(`Expected next shot date: ${expectedNextShotDate.toISOString()}`);
    console.log(`Expected days until next shot: ${daysDiff}`);
    console.log(`Today: ${now.toISOString()}`);

    // Calculate expected total supply
    const totalSupplyMg = importData.vials.reduce((total, vial) => {
      const remainingMg = vial.remaining_ml * (vial.concentration_mg_ml || 0);
      return total + remainingMg;
    }, 0);
    console.log(`Expected total supply: ${totalSupplyMg} mg`);

    console.log('=== TESTING LIVE SITE ===');

    // Go to live site
    await page.goto('https://alandooley.github.io/reta/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Give extra time for everything to load

    console.log('Page loaded, checking for elements...');

    // Check if we can find the main elements
    const summaryTabExists = await page.locator('#summary-tab').isVisible();
    console.log(`Summary tab visible: ${summaryTabExists}`);

    if (!summaryTabExists) {
      console.log('Summary tab not found, checking page content...');
      const pageContent = await page.content();
      console.log('Page title:', await page.title());
      console.log('Page has injection data:', pageContent.includes('Total Shots'));
    }

    // Try to get the displayed values
    try {
      const totalShotsElement = page.locator('#total-shots');
      const totalShots = await totalShotsElement.textContent({ timeout: 10000 });
      console.log(`Live site Total Shots: "${totalShots}"`);

      const totalSupplyElement = page.locator('#total-supply');
      const totalSupply = await totalSupplyElement.textContent({ timeout: 10000 });
      console.log(`Live site Total Supply: "${totalSupply}"`);

      console.log('=== COMPARISON ===');
      console.log(`Total Shots - Expected: ${totalExpectedShots}, Actual: "${totalShots}"`);
      console.log(`Total Supply - Expected: ${totalSupplyMg} mg, Actual: "${totalSupply}"`);

      // Check what data is actually loaded
      const localStorageData = await page.evaluate(() => {
        const stored = localStorage.getItem('injection_data');
        return stored ? JSON.parse(stored) : null;
      });

      if (localStorageData) {
        console.log('=== LIVE SITE LOCALSTORAGE DATA ===');
        console.log(`Injections in localStorage: ${localStorageData.injections?.length || 0}`);
        console.log(`Vials in localStorage: ${localStorageData.vials?.length || 0}`);

        if (localStorageData.injections && localStorageData.injections.length > 0) {
          console.log('First few injections in localStorage:');
          localStorageData.injections.slice(0, 3).forEach((inj, i) => {
            console.log(`  [${i}] ${inj.timestamp}: ${inj.dose_mg}mg (level: ${inj.medication_level_at_injection}mg)`);
          });

          if (localStorageData.injections.length > 3) {
            console.log('  ...');
            const lastInj = localStorageData.injections[localStorageData.injections.length - 1];
            console.log(`  [${localStorageData.injections.length - 1}] ${lastInj.timestamp}: ${lastInj.dose_mg}mg (level: ${lastInj.medication_level_at_injection}mg)`);
          }
        }

        if (localStorageData.vials && localStorageData.vials.length > 0) {
          console.log('Vials in localStorage:');
          localStorageData.vials.forEach((vial, i) => {
            const remainingMg = vial.remaining_ml * (vial.concentration_mg_ml || 0);
            console.log(`  Vial ${i+1}: ${vial.remaining_ml}ml remaining, ${vial.status} status = ${remainingMg}mg`);
          });
        }
      } else {
        console.log('No data found in localStorage on live site');
      }

    } catch (error) {
      console.log('Error getting live site values:', error.message);

      // Take a screenshot for debugging
      await page.screenshot({ path: 'live-site-error.png', fullPage: true });
      console.log('Screenshot saved as live-site-error.png');

      // Try to get any visible text
      const bodyText = await page.locator('body').textContent();
      console.log('Page body text (first 500 chars):', bodyText.substring(0, 500));
    }
  });
});