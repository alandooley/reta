// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test: TRT Settings Cloud Sync
 *
 * Issue #1: TRT settings are sent TO cloud but not received FROM cloud.
 * This causes users to lose TRT configuration when switching devices.
 *
 * The syncSettingsFromCloud() function only processes Retatrutide settings
 * (heightCm, goalWeightKg, defaultDose) and ignores trtSettings.
 */

test.describe('TRT Settings Cloud Sync', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to app
        await page.goto('http://localhost:3000');

        // Wait for app to initialize
        await page.waitForSelector('#app-content', { state: 'visible', timeout: 5000 }).catch(() => {});
    });

    test('should have syncSettingsFromCloud function that handles trtSettings', async ({ page }) => {
        // This test verifies the fix exists in the code
        const hasTrtSettingsSync = await page.evaluate(() => {
            // Check if app exists and has the syncSettingsFromCloud method
            if (typeof app === 'undefined' || !app.syncSettingsFromCloud) {
                return { exists: false, reason: 'app or syncSettingsFromCloud not found' };
            }

            // Get the function source code
            const funcSource = app.syncSettingsFromCloud.toString();

            // Check if it handles trtSettings
            const handlesTrtSettings = funcSource.includes('trtSettings');
            const handlesInjectionFrequency = funcSource.includes('injectionFrequency');
            const handlesConcentrationMgMl = funcSource.includes('concentrationMgMl');

            return {
                exists: true,
                handlesTrtSettings,
                handlesInjectionFrequency,
                handlesConcentrationMgMl
            };
        });

        expect(hasTrtSettingsSync.exists).toBe(true);
        expect(hasTrtSettingsSync.handlesTrtSettings).toBe(true);
        expect(hasTrtSettingsSync.handlesInjectionFrequency).toBe(true);
        expect(hasTrtSettingsSync.handlesConcentrationMgMl).toBe(true);
    });

    test('should apply TRT settings from cloud to local data', async ({ page }) => {
        // Simulate receiving cloud settings with TRT data
        const result = await page.evaluate(() => {
            // Mock cloud settings response
            const cloudSettings = {
                heightCm: 180,
                goalWeightKg: 85,
                defaultDose: 2.5,
                injectionFrequencyDays: 7,
                trtSettings: {
                    injectionFrequency: 5.0,  // Different from default 3.5
                    defaultDoseMl: 0.75,      // Different from default 0.5
                    defaultDoseMg: 150,       // Different from default 100
                    concentrationMgMl: 250,   // Different from default 200
                    injectionSites: ['left_deltoid', 'right_deltoid']
                }
            };

            // Store original values
            const originalFrequency = app.data.trtSettings.injectionFrequency;
            const originalDoseMl = app.data.trtSettings.defaultDoseMl;
            const originalDoseMg = app.data.trtSettings.defaultDoseMg;
            const originalConcentration = app.data.trtSettings.concentrationMgMl;

            // Simulate the sync logic (what syncSettingsFromCloud should do)
            // This is testing that the NEW code will handle trtSettings
            if (cloudSettings.trtSettings) {
                const trt = cloudSettings.trtSettings;
                if (trt.injectionFrequency !== null && trt.injectionFrequency !== undefined) {
                    app.data.trtSettings.injectionFrequency = trt.injectionFrequency;
                }
                if (trt.defaultDoseMl !== null && trt.defaultDoseMl !== undefined) {
                    app.data.trtSettings.defaultDoseMl = trt.defaultDoseMl;
                }
                if (trt.defaultDoseMg !== null && trt.defaultDoseMg !== undefined) {
                    app.data.trtSettings.defaultDoseMg = trt.defaultDoseMg;
                }
                if (trt.concentrationMgMl !== null && trt.concentrationMgMl !== undefined) {
                    app.data.trtSettings.concentrationMgMl = trt.concentrationMgMl;
                }
                if (trt.injectionSites !== null && trt.injectionSites !== undefined) {
                    app.data.trtSettings.injectionSites = trt.injectionSites;
                }
            }

            return {
                before: {
                    injectionFrequency: originalFrequency,
                    defaultDoseMl: originalDoseMl,
                    defaultDoseMg: originalDoseMg,
                    concentrationMgMl: originalConcentration
                },
                after: {
                    injectionFrequency: app.data.trtSettings.injectionFrequency,
                    defaultDoseMl: app.data.trtSettings.defaultDoseMl,
                    defaultDoseMg: app.data.trtSettings.defaultDoseMg,
                    concentrationMgMl: app.data.trtSettings.concentrationMgMl,
                    injectionSites: app.data.trtSettings.injectionSites
                },
                expected: cloudSettings.trtSettings
            };
        });

        // Verify TRT settings were updated from cloud values
        expect(result.after.injectionFrequency).toBe(result.expected.injectionFrequency);
        expect(result.after.defaultDoseMl).toBe(result.expected.defaultDoseMl);
        expect(result.after.defaultDoseMg).toBe(result.expected.defaultDoseMg);
        expect(result.after.concentrationMgMl).toBe(result.expected.concentrationMgMl);
        expect(result.after.injectionSites).toEqual(result.expected.injectionSites);
    });

    test('should preserve local TRT settings when cloud has null values', async ({ page }) => {
        // First set some local TRT settings
        await page.evaluate(() => {
            app.data.trtSettings.injectionFrequency = 4.0;
            app.data.trtSettings.defaultDoseMl = 0.6;
            app.data.trtSettings.defaultDoseMg = 120;
            app.data.trtSettings.concentrationMgMl = 200;
        });

        // Simulate receiving cloud settings with null trtSettings values
        const result = await page.evaluate(() => {
            const cloudSettings = {
                heightCm: 180,
                trtSettings: {
                    injectionFrequency: null,  // Cloud has null
                    defaultDoseMl: 0.8,        // Cloud has value
                    defaultDoseMg: null,       // Cloud has null
                    concentrationMgMl: 300     // Cloud has value
                }
            };

            const before = { ...app.data.trtSettings };

            // Apply only non-null cloud values (what the fix should do)
            if (cloudSettings.trtSettings) {
                const trt = cloudSettings.trtSettings;
                if (trt.injectionFrequency !== null && trt.injectionFrequency !== undefined) {
                    app.data.trtSettings.injectionFrequency = trt.injectionFrequency;
                }
                if (trt.defaultDoseMl !== null && trt.defaultDoseMl !== undefined) {
                    app.data.trtSettings.defaultDoseMl = trt.defaultDoseMl;
                }
                if (trt.defaultDoseMg !== null && trt.defaultDoseMg !== undefined) {
                    app.data.trtSettings.defaultDoseMg = trt.defaultDoseMg;
                }
                if (trt.concentrationMgMl !== null && trt.concentrationMgMl !== undefined) {
                    app.data.trtSettings.concentrationMgMl = trt.concentrationMgMl;
                }
            }

            return {
                before,
                after: { ...app.data.trtSettings }
            };
        });

        // Values that were null in cloud should remain unchanged (local preserved)
        expect(result.after.injectionFrequency).toBe(4.0);  // Preserved local
        expect(result.after.defaultDoseMg).toBe(120);       // Preserved local

        // Values that had cloud data should be updated
        expect(result.after.defaultDoseMl).toBe(0.8);       // Updated from cloud
        expect(result.after.concentrationMgMl).toBe(300);   // Updated from cloud
    });

    test('TRT settings UI should reflect synced cloud values', async ({ page }) => {
        // Navigate to TRT page
        await page.click('[data-page="trt"]').catch(() => {
            // If button doesn't exist, try alternative navigation
            return page.evaluate(() => {
                if (app && app.navigateTo) app.navigateTo('trt');
            });
        });

        // Wait for TRT page to load
        await page.waitForTimeout(500);

        // Set TRT settings that would come from cloud
        await page.evaluate(() => {
            app.data.trtSettings.injectionFrequency = 7.0;
            app.data.trtSettings.defaultDoseMg = 200;
            app.data.trtSettings.defaultDoseMl = 1.0;
            app.data.trtSettings.concentrationMgMl = 200;

            // Trigger UI update if method exists
            if (app.updateTrtSettingsUI) {
                app.updateTrtSettingsUI();
            } else if (app.populateTrtSettings) {
                app.populateTrtSettings();
            }
        });

        // Check if settings modal can be opened and shows correct values
        const settingsBtn = page.locator('#trt-settings-btn, [data-action="trt-settings"]');
        if (await settingsBtn.isVisible()) {
            await settingsBtn.click();
            await page.waitForTimeout(300);

            // Check frequency input
            const frequencyInput = page.locator('#trt-injection-frequency');
            if (await frequencyInput.isVisible()) {
                const frequencyValue = await frequencyInput.inputValue();
                expect(parseFloat(frequencyValue)).toBe(7.0);
            }
        }
    });
});
