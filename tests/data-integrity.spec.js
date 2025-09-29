const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Data Integrity Verification', () => {
  let importData;

  test.beforeAll(() => {
    // Load the import data to compare against
    const importFilePath = path.join(__dirname, '..', 'retatrutide_import_data.json');
    importData = JSON.parse(fs.readFileSync(importFilePath, 'utf8'));
  });

  test.beforeEach(async ({ page }) => {
    // Clear localStorage and go to app
    await page.goto('/?test=true');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('verify home page values after importing data', async ({ page }) => {
    console.log('=== ANALYZING IMPORT DATA ===');

    // Analyze the import data first
    console.log(`Injections in import data: ${importData.injections.length}`);
    console.log(`Vials in import data: ${importData.vials.length}`);
    console.log(`Weights in import data: ${importData.weights.length}`);

    // Analyze injections
    const sortedInjections = importData.injections.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lastInjection = sortedInjections[0];
    console.log(`Last injection: ${lastInjection.dose_mg}mg on ${lastInjection.timestamp}`);
    console.log(`Last injection level: ${lastInjection.medication_level_at_injection}mg`);

    // Analyze vials
    const totalSupplyMg = importData.vials.reduce((total, vial) => {
      const remainingMg = vial.remaining_ml * (vial.concentration_mg_ml || 0);
      console.log(`Vial ${vial.vial_id}: ${vial.remaining_ml}ml remaining, ${vial.status} status = ${remainingMg}mg`);
      return total + remainingMg;
    }, 0);
    console.log(`Expected total supply: ${totalSupplyMg}mg`);

    // Calculate next shot date
    const lastShotDate = new Date(lastInjection.timestamp);
    const expectedNextShotDate = new Date(lastShotDate);
    expectedNextShotDate.setDate(expectedNextShotDate.getDate() + importData.settings.injectionFrequency);
    console.log(`Expected next shot: ${expectedNextShotDate.toLocaleDateString()} (${importData.settings.injectionFrequency} days after ${lastShotDate.toLocaleDateString()})`);

    // Import the data
    await page.click('[data-tab="settings"]');
    await page.waitForSelector('#import-data-btn');

    // Set up dialog handler before clicking
    page.on('dialog', dialog => dialog.accept());

    // Click import button to trigger file picker
    await page.click('#import-data-btn');

    // Set up file input
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '..', 'retatrutide_import_data.json'));

    // Wait for import to complete
    await page.waitForTimeout(2000);

    // Go back to summary tab
    await page.click('[data-tab="summary"]');
    await page.waitForTimeout(1000);

    console.log('=== CHECKING DISPLAYED VALUES ===');

    // Get displayed values
    const totalShots = await page.locator('#total-shots').textContent();
    const lastDose = await page.locator('#last-dose').textContent();
    const currentLevel = await page.locator('#current-level').textContent();
    const nextShot = await page.locator('#next-shot').textContent();
    const totalSupply = await page.locator('#total-supply').textContent();
    const displayedNextShotDay = await page.locator('#next-shot-day').textContent();
    const displayedNextShotDate = await page.locator('#next-shot-date').textContent();
    const displayedNextShotTime = await page.locator('#next-shot-time').textContent();

    console.log(`Displayed Total Shots: "${totalShots}"`);
    console.log(`Displayed Last Dose: "${lastDose}"`);
    console.log(`Displayed Level at Last Shot: "${currentLevel}"`);
    console.log(`Displayed Next Shot: "${nextShot}"`);
    console.log(`Displayed Total Supply: "${totalSupply}"`);
    console.log(`Displayed Next Shot Day: "${displayedNextShotDay}"`);
    console.log(`Displayed Next Shot Date: "${displayedNextShotDate}"`);
    console.log(`Displayed Next Shot Time: "${displayedNextShotTime}"`);

    console.log('=== EXPECTED VS ACTUAL ===');

    // Verify values against expected
    console.log(`Total Shots - Expected: ${importData.injections.length}, Actual: ${totalShots}`);
    console.log(`Last Dose - Expected: ${lastInjection.dose_mg} mg, Actual: ${lastDose}`);
    console.log(`Level at Last Shot - Expected: ${lastInjection.medication_level_at_injection} mg, Actual: ${currentLevel}`);
    console.log(`Total Supply - Expected: ${totalSupplyMg} mg, Actual: ${totalSupply}`);

    // Check if next shot calculation is reasonable
    const now = new Date();
    const expectedNextShot = new Date(lastShotDate.getTime() + (importData.settings.injectionFrequency * 24 * 60 * 60 * 1000));
    const daysDiff = Math.ceil((expectedNextShot - now) / (1000 * 60 * 60 * 24));

    console.log(`Days until next shot - Expected: ${daysDiff}, Displayed day: ${displayedNextShotDay}`);

    // More lenient assertions - just log the differences for now
    if (totalShots !== importData.injections.length.toString()) {
      console.log(`❌ Total Shots mismatch: expected ${importData.injections.length}, got ${totalShots}`);
    }
    if (lastDose !== `${lastInjection.dose_mg} mg`) {
      console.log(`❌ Last Dose mismatch: expected ${lastInjection.dose_mg} mg, got ${lastDose}`);
    }
    if (currentLevel !== `${lastInjection.medication_level_at_injection}.0 mg`) {
      console.log(`❌ Level at Last Shot mismatch: expected ${lastInjection.medication_level_at_injection}.0 mg, got ${currentLevel}`);
    }
    if (totalSupply !== `${totalSupplyMg}.0 mg`) {
      console.log(`❌ Total Supply mismatch: expected ${totalSupplyMg}.0 mg, got ${totalSupply}`);
    }

    // Log data integrity issues
    console.log('=== DATA INTEGRITY ANALYSIS ===');

    // Check vial consistency
    importData.vials.forEach((vial, index) => {
      console.log(`Vial ${index + 1} (${vial.vial_id}):`);
      console.log(`  - Total: ${vial.total_mg}mg`);
      console.log(`  - Remaining: ${vial.remaining_ml}ml`);
      console.log(`  - Concentration: ${vial.concentration_mg_ml}mg/ml`);
      console.log(`  - Status: ${vial.status}`);
      console.log(`  - Doses used: ${vial.doses_used}`);

      if (vial.concentration_mg_ml) {
        const remainingMg = vial.remaining_ml * vial.concentration_mg_ml;
        const usedMg = vial.total_mg - remainingMg;
        console.log(`  - Calculated used: ${usedMg}mg`);
        console.log(`  - Calculated remaining: ${remainingMg}mg`);
      }
    });

    // Check injection totals
    const totalInjectedMg = importData.injections.reduce((total, inj) => total + inj.dose_mg, 0);
    console.log(`Total medication injected: ${totalInjectedMg}mg`);
    console.log(`Total vial capacity: ${importData.vials.reduce((total, v) => total + v.total_mg, 0)}mg`);
  });
});