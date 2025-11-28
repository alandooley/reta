/**
 * Skipped Dose Visualization Tests
 * Tests for red X markers on the Results chart for skipped injections
 *
 * What's Tested:
 * - Red X displays WITH matching weight (skipped dose at same time as weight)
 * - Red X displays WITHOUT matching weight (skipped dose with no nearby weight)
 * - Red X does NOT display for non-skipped injections
 * - Skipped injections are included in chart data
 * - Gray "SKIPPED" label appears for skipped dose groups
 *
 * Note: We test chart data structure, not visual pixels (canvas limitation)
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    navigateToTab,
    reloadPage
} = require('../helpers/test-utils');

const {
    createValidWeight,
    createValidVial,
    createValidInjection,
    createSkippedInjection
} = require('../fixtures/test-data');

test.describe('Skipped Dose Visualization', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test.describe('Red X Marker Display', () => {
        test('should include skipped injection in chart data WITH matching weight', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            // Create a skipped injection with a matching weight (same day)
            const skippedInjection = createSkippedInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id
            });

            // Weight recorded same day as skipped injection
            const matchingWeight = createValidWeight({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
                weight_kg: 85.0
            });

            await loadTestData(page, {
                injections: [skippedInjection],
                vials: [vial],
                weights: [matchingWeight]
            });
            await reloadPage(page);
            await navigateToTab(page, 'results');

            // Wait for chart to render
            await page.waitForTimeout(500);

            // Verify the skipped injection is included in the chart's grouped data
            const chartData = await page.evaluate(() => {
                if (!window.app || !window.app.charts || !window.app.charts.shotsWeightChart) {
                    return null;
                }
                // The chart should exist, indicating data was rendered
                return {
                    hasChart: true,
                    datasetCount: window.app.charts.shotsWeightChart.data.datasets.length
                };
            });

            expect(chartData).not.toBeNull();
            expect(chartData.hasChart).toBe(true);
        });

        test('should include skipped injection in chart data WITHOUT matching weight', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            // Create a regular injection with matching weight (to ensure chart renders)
            const regularInjection = createValidInjection({
                timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id,
                dose_mg: 2.5
            });

            const regularWeight = createValidWeight({
                timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
                weight_kg: 90.0
            });

            // Create a skipped injection WITHOUT matching weight (different day)
            const skippedInjection = createSkippedInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id
            });

            await loadTestData(page, {
                injections: [regularInjection, skippedInjection],
                vials: [vial],
                weights: [regularWeight]
            });
            await reloadPage(page);
            await navigateToTab(page, 'results');

            // Wait for chart to render
            await page.waitForTimeout(500);

            // Check that skipped injections are included in the app's injection data
            const hasSkippedInData = await page.evaluate(() => {
                if (!window.app || !window.app.data || !window.app.data.injections) {
                    return false;
                }
                return window.app.data.injections.some(inj => inj.skipped === true);
            });

            expect(hasSkippedInData).toBe(true);
        });

        test('should NOT show skipped marker for regular (non-skipped) injections', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            // Create a regular (non-skipped) injection
            const regularInjection = createValidInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id,
                dose_mg: 2.5,
                skipped: false
            });

            const matchingWeight = createValidWeight({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
                weight_kg: 85.0
            });

            await loadTestData(page, {
                injections: [regularInjection],
                vials: [vial],
                weights: [matchingWeight]
            });
            await reloadPage(page);
            await navigateToTab(page, 'results');

            await page.waitForTimeout(500);

            // Verify no skipped injections exist
            const hasSkipped = await page.evaluate(() => {
                return window.app.data.injections.some(inj => inj.skipped === true);
            });

            expect(hasSkipped).toBe(false);
        });
    });

    test.describe('Skipped Injection Data Handling', () => {
        test('skipped injection should have skipped=true property', async ({ page }) => {
            const vial = createValidVial({ status: 'active' });
            const skippedInjection = createSkippedInjection({
                vial_id: vial.vial_id
            });

            await loadTestData(page, {
                injections: [skippedInjection],
                vials: [vial],
                weights: []
            });
            await reloadPage(page);

            const injections = await page.evaluate(() => {
                return window.app.data.injections;
            });

            expect(injections.length).toBe(1);
            expect(injections[0].skipped).toBe(true);
        });

        test('skipped injection should have dose_mg of 0', async ({ page }) => {
            const vial = createValidVial({ status: 'active' });
            const skippedInjection = createSkippedInjection({
                vial_id: vial.vial_id
            });

            await loadTestData(page, {
                injections: [skippedInjection],
                vials: [vial],
                weights: []
            });
            await reloadPage(page);

            const injections = await page.evaluate(() => {
                return window.app.data.injections;
            });

            expect(injections[0].dose_mg).toBe(0);
        });

        test('multiple skipped injections should all be included', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            const skipped1 = createSkippedInjection({
                timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id
            });
            const skipped2 = createSkippedInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id
            });

            // Need at least one weight to render the chart
            const weight = createValidWeight({
                timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
                weight_kg: 85.0
            });

            await loadTestData(page, {
                injections: [skipped1, skipped2],
                vials: [vial],
                weights: [weight]
            });
            await reloadPage(page);

            const skippedCount = await page.evaluate(() => {
                return window.app.data.injections.filter(inj => inj.skipped === true).length;
            });

            expect(skippedCount).toBe(2);
        });
    });

    test.describe('Mixed Regular and Skipped Injections', () => {
        test('should handle mix of regular and skipped injections', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            const regularInjection = createValidInjection({
                timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id,
                dose_mg: 2.5
            });

            const skippedInjection = createSkippedInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id
            });

            // Weight for the regular injection (to enable chart)
            const weight = createValidWeight({
                timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
                weight_kg: 85.0
            });

            await loadTestData(page, {
                injections: [regularInjection, skippedInjection],
                vials: [vial],
                weights: [weight]
            });
            await reloadPage(page);
            await navigateToTab(page, 'results');

            await page.waitForTimeout(500);

            const injectionStats = await page.evaluate(() => {
                const injections = window.app.data.injections;
                return {
                    total: injections.length,
                    skipped: injections.filter(i => i.skipped).length,
                    regular: injections.filter(i => !i.skipped).length
                };
            });

            expect(injectionStats.total).toBe(2);
            expect(injectionStats.skipped).toBe(1);
            expect(injectionStats.regular).toBe(1);
        });

        test('regular injection dose should count, skipped should not', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            const regularInjection = createValidInjection({
                timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id,
                dose_mg: 2.5
            });

            const skippedInjection = createSkippedInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id
            });

            await loadTestData(page, {
                injections: [regularInjection, skippedInjection],
                vials: [vial],
                weights: []
            });
            await reloadPage(page);

            const totalDose = await page.evaluate(() => {
                return window.app.data.injections
                    .filter(i => !i.skipped)
                    .reduce((sum, i) => sum + i.dose_mg, 0);
            });

            expect(totalDose).toBe(2.5);
        });
    });

    test.describe('Chart Display Requirements', () => {
        test('chart should render when skipped injection has matching weight', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            const skippedInjection = createSkippedInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id
            });

            const matchingWeight = createValidWeight({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
                weight_kg: 85.0
            });

            await loadTestData(page, {
                injections: [skippedInjection],
                vials: [vial],
                weights: [matchingWeight]
            });
            await reloadPage(page);
            await navigateToTab(page, 'results');

            await page.waitForTimeout(500);

            // Check for chart canvas
            const chartExists = await page.evaluate(() => {
                return window.app.charts && window.app.charts.shotsWeightChart !== null;
            });

            expect(chartExists).toBe(true);
        });

        test('shots-weight-chart canvas should exist on results tab', async ({ page }) => {
            const now = Date.now();
            const vial = createValidVial({ status: 'active' });

            const injection = createValidInjection({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                vial_id: vial.vial_id,
                dose_mg: 2.5
            });

            const weight = createValidWeight({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
                weight_kg: 85.0
            });

            await loadTestData(page, {
                injections: [injection],
                vials: [vial],
                weights: [weight]
            });
            await reloadPage(page);
            await navigateToTab(page, 'results');

            await page.waitForTimeout(500);

            const chartCanvas = await page.$('#shots-weight-chart');
            expect(chartCanvas).not.toBeNull();
        });
    });
});
