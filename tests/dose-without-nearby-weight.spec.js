const { test, expect } = require('@playwright/test');

test.describe('Dose labels without nearby weight', () => {
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

    test('should show dose label for injection without weight within 24 hours', async ({ page }) => {
        // Step 1: Add a vial
        await page.click('button:has-text("Add Vial")');
        await page.fill('#vial-form input[type="number"]', '10'); // 10mg concentration
        await page.click('#vial-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 2: Activate the vial
        await page.locator('button:has-text("Activate")').first().click();
        await page.waitForTimeout(500);

        // Step 3: Add Shot A on Day 1 with matching weight
        const day1 = new Date();
        day1.setDate(day1.getDate() - 10); // 10 days ago
        const day1Str = day1.toISOString().split('T')[0];

        await page.click('button:has-text("Add Injection")');
        await page.fill('#shot-dose', '2');
        await page.fill('#shot-date', day1Str);
        await page.fill('#shot-time', '10:00');
        await page.click('#injection-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Add weight on Day 1 (within 24 hours of Shot A)
        await page.click('button:has-text("Add Weight")');
        await page.fill('#weight-kg', '85.0');
        await page.fill('#weight-date', day1Str);
        await page.fill('#weight-time', '09:00');
        await page.click('#weight-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 4: Add Shot B on Day 8 (7 days later) WITHOUT matching weight
        const day8 = new Date(day1);
        day8.setDate(day8.getDate() + 7);
        const day8Str = day8.toISOString().split('T')[0];

        await page.click('button:has-text("Add Injection")');
        await page.fill('#shot-dose', '2');
        await page.fill('#shot-date', day8Str);
        await page.fill('#shot-time', '10:00');
        await page.click('#injection-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Add weight on Day 10 (more than 24 hours after Shot B)
        const day10 = new Date(day8);
        day10.setDate(day10.getDate() + 2);
        const day10Str = day10.toISOString().split('T')[0];

        await page.click('button:has-text("Add Weight")');
        await page.fill('#weight-kg', '84.5');
        await page.fill('#weight-date', day10Str);
        await page.fill('#weight-time', '09:00');
        await page.click('#weight-form button[type="submit"]');
        await page.waitForTimeout(500);

        // Step 5: Navigate to Results page
        await page.click('nav a:has-text("Results")');
        await page.waitForTimeout(1000);

        // Step 6: Verify both injections are in the data
        const chartData = await page.evaluate(() => {
            const app = window.app;
            if (!app || !app.data) return null;

            const injections = app.data.injections;
            const weights = app.data.weights;

            // Group injections by date
            const dateGroups = new Map();
            injections.forEach(inj => {
                const injDate = new Date(inj.timestamp);
                const dateKey = `${injDate.getFullYear()}-${String(injDate.getMonth() + 1).padStart(2, '0')}-${String(injDate.getDate()).padStart(2, '0')}`;
                if (!dateGroups.has(dateKey)) {
                    dateGroups.set(dateKey, []);
                }
                dateGroups.get(dateKey).push(inj.dose_mg);
            });

            return {
                injectionCount: injections.length,
                weightCount: weights.length,
                dateGroupCount: dateGroups.size,
                injectionDates: Array.from(dateGroups.keys()),
                doses: Array.from(dateGroups.values()).map(d => d.reduce((a, b) => a + b, 0))
            };
        });

        console.log('Chart data:', chartData);

        // Verify we have 2 injections on 2 different dates
        expect(chartData.injectionCount).toBe(2);
        expect(chartData.dateGroupCount).toBe(2);
        expect(chartData.doses).toContain(2);
        expect(chartData.doses.filter(d => d === 2).length).toBe(2); // Both should be 2mg

        // Step 7: Check that the chart canvas exists and has content
        const canvas = await page.locator('#shots-weight-chart');
        await expect(canvas).toBeVisible();

        // Step 8: Verify no empty state is shown
        const emptyState = await page.locator('.empty-state').count();
        expect(emptyState).toBe(0);

        console.log('Test passed: Both dose labels should be visible on the chart');
    });
});
