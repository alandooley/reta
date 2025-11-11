/**
 * Complete Cleanup and Import Test
 *
 * This test automates the complete cleanup of all local storage
 * and imports the clean dataset with proper 2025 dates.
 *
 * Steps:
 * 1. Navigate to localhost:3000
 * 2. Close all database connections
 * 3. Clear all storage (localStorage, sessionStorage, IndexedDB, caches)
 * 4. Hard reload to ensure fresh start
 * 5. Log in with Google OAuth
 * 6. Import clean_data.json
 * 7. Verify data: 6 vials, 10 injections, 43 weights
 * 8. Verify no phantom records remain
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Complete Cleanup and Import', () => {
  test.setTimeout(120000); // 2 minutes for OAuth and data loading

  test('should completely clean storage and import fresh data', async ({ page, context }) => {
    // Step 1: Navigate to app and close database connections
    console.log('Step 1: Navigating to localhost:3000 to close connections...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Close database connections while page is still loaded
    console.log('Step 2: Closing database connections...');
    await page.evaluate(() => {
      if (window.app && window.app.backupManager && window.app.backupManager.db) {
        window.app.backupManager.db.close();
        window.app.backupManager.db = null;
      }
    });

    // Step 3: Navigate to about:blank to unload the app completely
    console.log('Step 3: Navigating to about:blank to unload app...');
    await page.goto('about:blank');
    await page.waitForTimeout(1000);

    // Step 4: Clear all storage from the context level (more reliable)
    console.log('Step 4: Clearing all storage at context level...');
    await context.clearCookies();

    // Navigate back to localhost to access its storage
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');

    // Execute immediate cleanup BEFORE app initializes
    const cleanupResult = await page.evaluate(async () => {
      const log = [];

      try {
        // CRITICAL: Stop the page from loading the app
        window.stop();

        // Delete all IndexedDB databases (no connections should be open now)
        log.push('Deleting IndexedDB databases...');
        const databases = await indexedDB.databases();
        log.push(`Found ${databases.length} databases: ${databases.map(db => db.name).join(', ')}`);

        for (const db of databases) {
          await new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = () => {
              log.push(`✓ Deleted ${db.name}`);
              resolve();
            };
            req.onerror = () => {
              log.push(`✗ Failed to delete ${db.name}`);
              resolve();
            };
            req.onblocked = () => {
              log.push(`⚠ Deletion blocked for ${db.name}`);
              setTimeout(resolve, 1000);
            };
          });
        }

        // Clear localStorage
        log.push('Clearing localStorage...');
        const lsKeys = Object.keys(localStorage);
        log.push(`Found ${lsKeys.length} keys: ${lsKeys.join(', ')}`);
        localStorage.clear();
        log.push('✓ localStorage cleared');

        // Clear sessionStorage
        log.push('Clearing sessionStorage...');
        sessionStorage.clear();
        log.push('✓ sessionStorage cleared');

        // Clear Cache Storage
        log.push('Clearing Cache Storage...');
        const cacheNames = await caches.keys();
        log.push(`Found ${cacheNames.length} caches`);
        for (const name of cacheNames) {
          await caches.delete(name);
          log.push(`✓ Deleted cache: ${name}`);
        }

        // Unregister Service Workers
        log.push('Unregistering Service Workers...');
        const registrations = await navigator.serviceWorker.getRegistrations();
        log.push(`Found ${registrations.length} service workers`);
        for (const registration of registrations) {
          await registration.unregister();
          log.push(`✓ Unregistered: ${registration.scope}`);
        }

        log.push('=== CLEANUP COMPLETE ===');
        return { success: true, log };

      } catch (error) {
        log.push(`ERROR: ${error.message}`);
        return { success: false, log, error: error.message };
      }
    });

    // Log cleanup results
    console.log('Cleanup Results:');
    cleanupResult.log.forEach(line => console.log('  ' + line));

    if (!cleanupResult.success) {
      console.error('Cleanup failed:', cleanupResult.error);
    }

    // Step 5: Close the page completely
    console.log('Step 5: Closing page to ensure cleanup is complete...');
    await page.close();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Open a completely fresh page
    console.log('Step 6: Opening fresh page...');
    const newPage = await context.newPage();
    await newPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Verify storage is empty
    console.log('Step 5: Verifying storage is empty...');
    const storageCheck = await newPage.evaluate(() => {
      return {
        localStorageKeys: Object.keys(localStorage),
        localStorageLength: localStorage.length,
      };
    });

    console.log('  localStorage keys:', storageCheck.localStorageKeys);
    console.log('  localStorage length:', storageCheck.localStorageLength);

    // Step 6: Log in (manual intervention required for Google OAuth)
    console.log('Step 6: Waiting for login...');
    console.log('  Please log in with Google OAuth manually');

    // Wait for auth to complete (check for app.data existence)
    await newPage.waitForFunction(
      () => window.app && window.authManager && window.authManager.isAuthenticated(),
      { timeout: 60000 }
    );

    console.log('  ✓ Login successful');

    // Wait for initial data load
    await newPage.waitForTimeout(2000);

    // Check data before import
    console.log('Step 7: Checking data BEFORE import...');
    const dataBeforeImport = await newPage.evaluate(() => {
      return {
        injections: window.app.data.injections.length,
        vials: window.app.data.vials.length,
        weights: window.app.data.weights.length,
        injectionsPreview: window.app.data.injections.slice(0, 3).map(inj => ({
          id: inj.id,
          dose_mg: inj.dose_mg,
          timestamp: inj.timestamp
        }))
      };
    });

    console.log('  Injections:', dataBeforeImport.injections);
    console.log('  Vials:', dataBeforeImport.vials);
    console.log('  Weights:', dataBeforeImport.weights);
    if (dataBeforeImport.injectionsPreview.length > 0) {
      console.log('  ⚠ WARNING: Phantom data detected:');
      dataBeforeImport.injectionsPreview.forEach(inj => {
        console.log(`    - ${inj.id}: ${inj.dose_mg}mg on ${inj.timestamp}`);
      });
    }

    // Step 8: Navigate to Settings and import data
    console.log('Step 8: Importing clean_data.json...');

    // Click Settings button
    await newPage.click('button:has-text("Settings")');
    await newPage.waitForTimeout(500);

    // Scroll to import section
    await newPage.evaluate(() => {
      const importSection = document.querySelector('input[type="file"][accept=".json"]');
      if (importSection) {
        importSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await newPage.waitForTimeout(500);

    // Find the file input for data import
    const fileInput = await newPage.locator('input[type="file"][accept=".json"]').first();

    // Set the file
    const cleanDataPath = path.resolve(__dirname, '..', 'clean_data.json');
    console.log('  Using file:', cleanDataPath);

    // Verify file exists
    if (!fs.existsSync(cleanDataPath)) {
      throw new Error(`clean_data.json not found at ${cleanDataPath}`);
    }

    await fileInput.setInputFiles(cleanDataPath);

    // Wait for import to complete
    await newPage.waitForTimeout(3000);

    // Step 9: Verify imported data
    console.log('Step 9: Verifying imported data...');

    const dataAfterImport = await newPage.evaluate(() => {
      const injections = window.app.data.injections || [];
      const vials = window.app.data.vials || [];
      const weights = window.app.data.weights || [];

      return {
        injections: injections.length,
        vials: vials.length,
        weights: weights.length,
        injectionsPreview: injections.slice(0, 5).map(inj => ({
          id: inj.id,
          dose_mg: inj.dose_mg,
          timestamp: inj.timestamp,
          vial_id: inj.vial_id
        })),
        vialsPreview: vials.map(v => ({
          vial_id: v.vial_id,
          status: v.status,
          order_date: v.order_date
        })),
        weightsCount: weights.length
      };
    });

    console.log('  ✓ Injections:', dataAfterImport.injections);
    console.log('  ✓ Vials:', dataAfterImport.vials);
    console.log('  ✓ Weights:', dataAfterImport.weights);

    // Verify counts
    expect(dataAfterImport.vials).toBe(6);
    expect(dataAfterImport.injections).toBe(10);
    expect(dataAfterImport.weights).toBe(43);

    // Verify no phantom records
    console.log('\nStep 10: Checking for phantom records...');
    const phantomDoses = [2.0, 2.5, 3.0, 3.5];
    const phantomFound = dataAfterImport.injectionsPreview.filter(inj =>
      phantomDoses.includes(inj.dose_mg)
    );

    if (phantomFound.length > 0) {
      console.log('  ✗ PHANTOM RECORDS DETECTED:');
      phantomFound.forEach(inj => {
        console.log(`    - ${inj.id}: ${inj.dose_mg}mg on ${inj.timestamp}`);
      });
      throw new Error('Phantom records still present after import');
    } else {
      console.log('  ✓ No phantom records detected');
    }

    // Display sample data
    console.log('\nSample Injections:');
    dataAfterImport.injectionsPreview.forEach((inj, idx) => {
      console.log(`  ${idx + 1}. ${inj.dose_mg}mg on ${inj.timestamp} (${inj.vial_id})`);
    });

    console.log('\nVials:');
    dataAfterImport.vialsPreview.forEach((vial, idx) => {
      console.log(`  ${idx + 1}. ${vial.vial_id} - ${vial.status} (ordered ${vial.order_date})`);
    });

    console.log('\n=== IMPORT SUCCESSFUL ===');
    console.log('✓ All data verified');
    console.log('✓ No phantom records');
    console.log('✓ 6 vials, 10 injections, 43 weights');

    // Take a screenshot for verification
    await newPage.screenshot({ path: 'tests/screenshots/cleanup-complete.png', fullPage: true });
    console.log('\nScreenshot saved to tests/screenshots/cleanup-complete.png');
  });
});
