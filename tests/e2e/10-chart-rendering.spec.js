/**
 * Chart Rendering Tests
 * Tests Chart.js weight chart rendering and data display
 *
 * What's Tested:
 * - Chart canvas existence and initialization
 * - Data points rendering (correct number of points)
 * - Chart with multiple weights
 * - Chart with single weight
 * - Chart with no weights (empty state)
 * - Chart updates when data changes
 *
 * Note: Tests functional rendering, not pixel-perfect visual output
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
    createSettings
} = require('../fixtures/test-data');

test.describe('Chart Rendering - Weight Chart', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should render chart canvas on results tab', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check if chart canvas exists
        const chartCanvas = await page.$('#weight-only-chart');
        expect(chartCanvas).not.toBeNull();
    });

    test('should initialize Chart.js instance', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check if Chart.js is initialized
        const hasChart = await page.evaluate(() => {
            return window.app && window.app.charts && window.app.charts.weightOnlyChart !== null;
        });

        expect(hasChart).toBe(true);
    });

    test('should render chart with multiple data points', async ({ page }) => {
        const now = Date.now();
        const weights = [
            createValidWeight({
                timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 90.0
            }),
            createValidWeight({
                timestamp: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 89.5
            }),
            createValidWeight({
                timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 89.0
            }),
            createValidWeight({
                timestamp: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 88.5
            }),
            createValidWeight({
                timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 88.0
            })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check if chart has correct number of data points
        const dataPointCount = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.data || !chart.data.datasets) return 0;

            const dataset = chart.data.datasets[0];
            return dataset ? dataset.data.length : 0;
        });

        expect(dataPointCount).toBe(5);
    });

    test('should render chart with single data point', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 85.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        const dataPointCount = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.data || !chart.data.datasets) return 0;

            const dataset = chart.data.datasets[0];
            return dataset ? dataset.data.length : 0;
        });

        expect(dataPointCount).toBe(1);
    });

    test('should handle empty chart (no weights)', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Chart canvas should still exist
        const chartCanvas = await page.$('#weight-only-chart');
        expect(chartCanvas).not.toBeNull();

        // Chart should have 0 data points
        const dataPointCount = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.data || !chart.data.datasets) return 0;

            const dataset = chart.data.datasets[0];
            return dataset ? dataset.data.length : 0;
        });

        expect(dataPointCount).toBe(0);
    });

    test('should update chart when data changes', async ({ page }) => {
        // Start with 2 weights
        const weights = [
            createValidWeight({
                id: 'w1',
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 85.0
            }),
            createValidWeight({
                id: 'w2',
                timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 84.0
            })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check initial count
        let dataPointCount = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.data || !chart.data.datasets) return 0;
            return chart.data.datasets[0].data.length;
        });

        expect(dataPointCount).toBe(2);

        // Add a new weight
        const newWeight = createValidWeight({
            id: 'w3',
            timestamp: new Date().toISOString(),
            weight_kg: 83.0
        });

        await page.evaluate((weight) => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            data.weights.push(weight);
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));
        }, newWeight);

        // Reload to update chart
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check updated count
        dataPointCount = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.data || !chart.data.datasets) return 0;
            return chart.data.datasets[0].data.length;
        });

        expect(dataPointCount).toBe(3);
    });

    test('should render chart with time-based x-axis', async ({ page }) => {
        const weights = [
            createValidWeight({
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                weight_kg: 85.0
            }),
            createValidWeight({
                timestamp: new Date().toISOString(),
                weight_kg: 83.0
            })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check if chart has time scale
        const hasTimeScale = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.options || !chart.options.scales) return false;

            const xScale = chart.options.scales.x;
            return xScale && xScale.type === 'time';
        });

        expect(hasTimeScale).toBe(true);
    });

    test('should display weight values in chart data', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 90.0 }),
            createValidWeight({ weight_kg: 85.0 }),
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Extract y values from chart
        const yValues = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.data || !chart.data.datasets) return [];

            const dataset = chart.data.datasets[0];
            if (!dataset || !dataset.data) return [];

            return dataset.data.map(point => point.y);
        });

        expect(yValues).toContain(90.0);
        expect(yValues).toContain(85.0);
        expect(yValues).toContain(80.0);
    });

    test('should sort data points by timestamp', async ({ page }) => {
        // Add weights in random order
        const now = Date.now();
        const weights = [
            createValidWeight({
                id: 'w3',
                timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // Most recent
                weight_kg: 83.0
            }),
            createValidWeight({
                id: 'w1',
                timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), // Oldest
                weight_kg: 85.0
            }),
            createValidWeight({
                id: 'w2',
                timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // Middle
                weight_kg: 84.0
            })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Extract timestamps from chart
        const timestamps = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.data || !chart.data.datasets) return [];

            const dataset = chart.data.datasets[0];
            if (!dataset || !dataset.data) return [];

            return dataset.data.map(point => point.x);
        });

        // Verify timestamps are in ascending order
        for (let i = 1; i < timestamps.length; i++) {
            const prev = new Date(timestamps[i - 1]).getTime();
            const curr = new Date(timestamps[i]).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
        }
    });
});

test.describe('Chart Rendering - Chart Container', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should have chart container on results tab', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        const chartContainer = await page.$('.chart-container');
        expect(chartContainer).not.toBeNull();
    });

    test('should have canvas element inside container', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        const canvasInContainer = await page.$('.chart-container canvas');
        expect(canvasInContainer).not.toBeNull();
    });

    test('should have chart title or heading', async ({ page }) => {
        await loadTestData(page, { injections: [], vials: [], weights: [] });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check for heading near chart
        const hasHeading = await page.evaluate(() => {
            const chartContainer = document.querySelector('.chart-container');
            if (!chartContainer) return false;

            const heading = chartContainer.querySelector('h3, h2, .chart-title');
            return heading !== null;
        });

        expect(hasHeading).toBe(true);
    });
});

test.describe('Chart Rendering - Chart Responsiveness', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should render chart at default viewport', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        const canvas = await page.$('#weight-only-chart');
        const dimensions = await canvas.evaluate(el => ({
            width: el.width,
            height: el.height
        }));

        expect(dimensions.width).toBeGreaterThan(0);
        expect(dimensions.height).toBeGreaterThan(0);
    });

    test('should maintain aspect ratio', async ({ page }) => {
        const weights = [
            createValidWeight({ weight_kg: 80.0 })
        ];

        await loadTestData(page, { injections: [], vials: [], weights });
        await reloadPage(page);
        await navigateToTab(page, 'results');

        // Check if chart has maintainAspectRatio option
        const maintainsAspect = await page.evaluate(() => {
            const chart = window.app.charts.weightOnlyChart;
            if (!chart || !chart.options) return null;

            return chart.options.maintainAspectRatio;
        });

        // Should be true or false, not undefined
        expect(typeof maintainsAspect).toBe('boolean');
    });
});
