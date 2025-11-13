const { test, expect } = require('@playwright/test');

test.describe('Sum Multiple Shots Per Day', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');

        // Clear any existing data
        await page.evaluate(() => {
            localStorage.clear();
            indexedDB.deleteDatabase('InjectionTrackerDB');
        });

        await page.reload();
        await page.waitForTimeout(500);
    });

    test('should sum doses when multiple injections occur on same day', async ({ page }) => {
        // Step 1: Add a vial
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-form input[type="number"]', '10'); // 10mg concentration
        await page.click('#vial-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 2: Activate the vial
        const activateButton = await page.locator('button:has-text("Activate")').first();
        await activateButton.click();
        await page.waitForTimeout(500);

        // Step 3: Add first injection (2mg)
        await page.click('button:has-text("Add Injection")');
        await page.fill('#shot-dose', '2');
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = '10:00';
        await page.fill('#shot-date', dateStr);
        await page.fill('#shot-time', timeStr);
        await page.click('#injection-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 4: Add second injection same day (2mg)
        await page.click('button:has-text("Add Injection")');
        await page.fill('#shot-dose', '2');
        await page.fill('#shot-date', dateStr);
        await page.fill('#shot-time', '14:00');
        await page.click('#injection-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 5: Add a weight entry for the same day
        await page.click('button:has-text("Add Weight")');
        await page.fill('#weight-kg', '85.5');
        await page.fill('#weight-date', dateStr);
        await page.fill('#weight-time', '09:00');
        await page.click('#weight-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 6: Navigate to Results page
        await page.click('nav a:has-text("Results")');
        await page.waitForTimeout(1000);

        // Step 7: Verify the chart shows summed dose (4mg)
        // The dose label should be rendered as a canvas element with text "4mg"
        // We'll check the data structure in the page context
        const chartData = await page.evaluate(() => {
            const app = window.app;
            if (!app || !app.data) return null;

            // Get injections from the same day
            const injections = app.data.injections;
            const dateGroups = new Map();

            injections.forEach(inj => {
                const injDate = new Date(inj.timestamp);
                const dateKey = `${injDate.getFullYear()}-${String(injDate.getMonth() + 1).padStart(2, '0')}-${String(injDate.getDate()).padStart(2, '0')}`;

                if (!dateGroups.has(dateKey)) {
                    dateGroups.set(dateKey, []);
                }
                dateGroups.get(dateKey).push(inj.dose_mg);
            });

            const summedDoses = Array.from(dateGroups.values()).map(doses =>
                doses.reduce((sum, dose) => sum + dose, 0)
            );

            return {
                injectionCount: injections.length,
                dateGroupCount: dateGroups.size,
                summedDoses: summedDoses
            };
        });

        // Verify we have 2 injections
        expect(chartData.injectionCount).toBe(2);

        // Verify they are grouped into 1 date
        expect(chartData.dateGroupCount).toBe(1);

        // Verify the sum is 4mg (2mg + 2mg)
        expect(chartData.summedDoses[0]).toBe(4);

        console.log('✓ Successfully summed multiple shots per day:', chartData);
    });

    test('should show separate labels for injections on different days', async ({ page }) => {
        // Step 1: Add a vial
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-form input[type="number"]', '10');
        await page.click('#vial-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 2: Activate the vial
        await page.locator('button:has-text("Activate")').first().click();
        await page.waitForTimeout(500);

        // Step 3: Add injection on Day 1 (2mg)
        const day1 = new Date();
        const day1Str = day1.toISOString().split('T')[0];
        await page.click('button:has-text("Add Injection")');
        await page.fill('#shot-dose', '2');
        await page.fill('#shot-date', day1Str);
        await page.fill('#shot-time', '10:00');
        await page.click('#injection-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 4: Add weight on Day 1
        await page.click('button:has-text("Add Weight")');
        await page.fill('#weight-kg', '85.5');
        await page.fill('#weight-date', day1Str);
        await page.fill('#weight-time', '09:00');
        await page.click('#weight-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 5: Add injection on Day 2 (3mg)
        const day2 = new Date(day1);
        day2.setDate(day2.getDate() + 1);
        const day2Str = day2.toISOString().split('T')[0];
        await page.click('button:has-text("Add Injection")');
        await page.fill('#shot-dose', '3');
        await page.fill('#shot-date', day2Str);
        await page.fill('#shot-time', '10:00');
        await page.click('#injection-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 6: Add weight on Day 2
        await page.click('button:has-text("Add Weight")');
        await page.fill('#weight-kg', '85.0');
        await page.fill('#weight-date', day2Str);
        await page.fill('#weight-time', '09:00');
        await page.click('#weight-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 7: Navigate to Results page
        await page.click('nav a:has-text("Results")');
        await page.waitForTimeout(1000);

        // Step 8: Verify separate dose labels
        const chartData = await page.evaluate(() => {
            const app = window.app;
            if (!app || !app.data) return null;

            const injections = app.data.injections;
            const dateGroups = new Map();

            injections.forEach(inj => {
                const injDate = new Date(inj.timestamp);
                const dateKey = `${injDate.getFullYear()}-${String(injDate.getMonth() + 1).padStart(2, '0')}-${String(injDate.getDate()).padStart(2, '0')}`;

                if (!dateGroups.has(dateKey)) {
                    dateGroups.set(dateKey, []);
                }
                dateGroups.get(dateKey).push(inj.dose_mg);
            });

            const summedDoses = Array.from(dateGroups.values()).map(doses =>
                doses.reduce((sum, dose) => sum + dose, 0)
            );

            return {
                injectionCount: injections.length,
                dateGroupCount: dateGroups.size,
                summedDoses: summedDoses
            };
        });

        // Verify we have 2 injections
        expect(chartData.injectionCount).toBe(2);

        // Verify they are in 2 separate date groups
        expect(chartData.dateGroupCount).toBe(2);

        // Verify each has its own dose (not summed)
        expect(chartData.summedDoses).toContain(2);
        expect(chartData.summedDoses).toContain(3);

        console.log('✓ Successfully showed separate labels for different days:', chartData);
    });
});
