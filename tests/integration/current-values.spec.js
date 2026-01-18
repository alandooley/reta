const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Current Values Check', () => {
  let importData;

  test.beforeAll(() => {
    // Load the import data to compare against
    const importFilePath = path.join(__dirname, '..', 'retatrutide_import_data.json');
    importData = JSON.parse(fs.readFileSync(importFilePath, 'utf8'));
  });

  test('check current home page values', async ({ page }) => {
    console.log('=== ANALYZING IMPORT DATA FIRST ===');

    // Analyze the import data
    const sortedInjections = importData.injections.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lastInjection = sortedInjections[0];
    console.log(`Import data last injection: ${lastInjection.dose_mg}mg on ${lastInjection.timestamp}`);
    console.log(`Import data last injection level: ${lastInjection.medication_level_at_injection}mg`);

    // Analyze vials
    const totalSupplyMg = importData.vials.reduce((total, vial) => {
      const remainingMg = vial.remaining_ml * (vial.concentration_mg_ml || 0);
      console.log(`Import vial ${vial.vial_id}: ${vial.remaining_ml}ml remaining, ${vial.status} status = ${remainingMg}mg`);
      return total + remainingMg;
    }, 0);
    console.log(`Import data expected total supply: ${totalSupplyMg}mg`);
    console.log(`Import data total injections: ${importData.injections.length}`);

    // Go to app (without test parameter to see what loads)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Give time for everything to load

    console.log('=== CHECKING CURRENTLY DISPLAYED VALUES ===');

    // Check if we're on summary tab
    const summaryTab = page.locator('#summary-tab');
    await expect(summaryTab).toBeVisible();

    // Get all displayed values
    const totalShots = await page.locator('#total-shots').textContent();
    const totalSupply = await page.locator('#total-supply').textContent();

    console.log(`Currently displayed Total Shots: "${totalShots}"`);
    console.log(`Currently displayed Total Supply: "${totalSupply}"`);

    console.log('=== ANALYSIS ===');
    console.log(`If sample data is loaded:`);
    console.log(`- Sample typically has 4-5 injections vs import data's ${importData.injections.length}`);
    console.log(`- Sample typically has remaining supply vs import data's ${totalSupplyMg}mg`);
    console.log('');
    console.log(`What values SHOULD be after importing your data:`);
    console.log(`- Total Shots: ${importData.injections.length}`);
    console.log(`- Total Supply: ${totalSupplyMg}.0 mg`);

    // Check localStorage to see what data is actually loaded
    const localStorageData = await page.evaluate(() => {
      const stored = localStorage.getItem('injection_data');
      return stored ? JSON.parse(stored) : null;
    });

    if (localStorageData) {
      console.log('=== CURRENT LOCALSTORAGE DATA ===');
      console.log(`Injections in localStorage: ${localStorageData.injections?.length || 0}`);
      console.log(`Vials in localStorage: ${localStorageData.vials?.length || 0}`);

      if (localStorageData.injections && localStorageData.injections.length > 0) {
        const currentLastInjection = localStorageData.injections[0];
        console.log(`Current last injection: ${currentLastInjection.dose_mg}mg at ${currentLastInjection.timestamp}`);
        console.log(`Current last injection level: ${currentLastInjection.medication_level_at_injection}mg`);
      }

      if (localStorageData.vials && localStorageData.vials.length > 0) {
        localStorageData.vials.forEach((vial, i) => {
          const remainingMg = vial.remaining_ml * (vial.concentration_mg_ml || 0);
          console.log(`Current vial ${i+1}: ${vial.remaining_ml}ml remaining, ${vial.status} status = ${remainingMg}mg`);
        });
      }
    } else {
      console.log('No data found in localStorage');
    }
  });
});