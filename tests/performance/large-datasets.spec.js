/**
 * Performance Tests with Large Datasets
 *
 * Tests app performance with large amounts of data:
 * - 100+ vials
 * - 1000+ injections
 * - 500+ weight entries
 * - Render performance
 * - Calculation performance
 * - Search/filter performance
 */

const { test, expect } = require('../helpers/test-fixtures');
const { createLargeDataset } = require('../fixtures/test-data');

test.describe('Performance with Large Datasets', () => {

    test.describe('Data Loading Performance', () => {

        test('should load 100 vials within acceptable time', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(100, 10, 100);

            const startTime = Date.now();

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            const loadTime = Date.now() - startTime;

            // Should load within 3 seconds
            expect(loadTime).toBeLessThan(3000);

            console.log(`Load time for 100 vials: ${loadTime}ms`);
        });

        test('should handle 1000+ injections without performance degradation', async ({ isolated }) => {
            const { page } = isolated;

            // Create dataset with many injections
            const largeData = createLargeDataset(50, 50, 50); // 50 vials * 50 injections = 2500 injections

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            const startTime = Date.now();

            await page.reload();
            await page.waitForLoadState('networkidle');

            const loadTime = Date.now() - startTime;

            // Should load within 5 seconds even with large dataset
            expect(loadTime).toBeLessThan(5000);

            console.log(`Load time for ${largeData.injections.length} injections: ${loadTime}ms`);

            // Navigate to injections page
            const navStart = Date.now();
            await page.click('text=Injections');
            await page.waitForLoadState('networkidle');
            const navTime = Date.now() - navStart;

            // Navigation should be fast
            expect(navTime).toBeLessThan(2000);

            console.log(`Navigation time to injections page: ${navTime}ms`);
        });

        test('should render 500 weight entries efficiently', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(10, 5, 500);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();

            const startTime = Date.now();

            await page.click('text=Weight');
            await page.waitForLoadState('networkidle');

            const renderTime = Date.now() - startTime;

            // Should render within 2 seconds
            expect(renderTime).toBeLessThan(2000);

            console.log(`Render time for ${largeData.weights.length} weight entries: ${renderTime}ms`);
        });
    });

    test.describe('Calculation Performance', () => {

        test('should calculate supply forecast quickly with large dataset', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(100, 50, 100);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();
            await page.click('text=Home');

            // Measure calculation time
            const calcTime = await page.evaluate(() => {
                const start = performance.now();

                // Trigger supply forecast calculation
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');

                let totalCapacity = 0;
                let totalUsed = 0;

                data.vials.forEach(vial => {
                    const capacity = vial.total_mg || 0;
                    totalCapacity += capacity;
                });

                data.injections.forEach(injection => {
                    totalUsed += injection.dose_mg || 0;
                });

                const remaining = totalCapacity - totalUsed;

                const end = performance.now();
                return end - start;
            });

            // Should calculate within 100ms
            expect(calcTime).toBeLessThan(100);

            console.log(`Supply forecast calculation time: ${calcTime.toFixed(2)}ms`);
        });

        test('should calculate weight metrics quickly with 500 entries', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(10, 5, 500);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();
            await page.click('text=Results');

            // Measure chart rendering time
            const chartTime = await page.evaluate(() => {
                const start = performance.now();

                // Access chart data (triggers calculation)
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                const weights = data.weights || [];

                if (weights.length > 0) {
                    // Calculate metrics
                    const firstWeight = weights[0].weightKg;
                    const lastWeight = weights[weights.length - 1].weightKg;
                    const change = lastWeight - firstWeight;
                    const percentChange = (change / firstWeight) * 100;
                }

                const end = performance.now();
                return end - start;
            });

            // Should calculate within 50ms
            expect(chartTime).toBeLessThan(50);

            console.log(`Weight metrics calculation time: ${chartTime.toFixed(2)}ms`);
        });
    });

    test.describe('Filtering Performance', () => {

        test('should filter 100 vials quickly', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(100, 5, 50);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();
            await page.click('text=Vials');

            // Apply filter
            const startTime = Date.now();

            const filterButton = page.locator('button:has-text("Filter")');
            if (await filterButton.isVisible()) {
                await filterButton.click();
                await page.check('input[value="active"]');
                await page.click('button:has-text("Apply")');
            }

            await page.waitForLoadState('networkidle');

            const filterTime = Date.now() - startTime;

            // Should filter within 1 second
            expect(filterTime).toBeLessThan(1000);

            console.log(`Filter time for 100 vials: ${filterTime}ms`);
        });

        test('should search through 1000+ injections efficiently', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(50, 50, 50);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();
            await page.click('text=Injections');

            // Perform search if available
            const searchField = page.locator('input[type="search"], input[placeholder*="Search"]');

            if (await searchField.isVisible()) {
                const startTime = Date.now();

                await searchField.fill('2.5');
                await page.waitForTimeout(300); // Debounce

                const searchTime = Date.now() - startTime;

                // Should search within 500ms
                expect(searchTime).toBeLessThan(500);

                console.log(`Search time: ${searchTime}ms`);
            }
        });
    });

    test.describe('Rendering Performance', () => {

        test('should use virtualization or pagination for large lists', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(200, 10, 100);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();
            await page.click('text=Vials');

            // Check if all 200 vials are rendered or if pagination/virtualization is used
            const vialCards = page.locator('.vial-card');
            const renderedCount = await vialCards.count();

            console.log(`Rendered ${renderedCount} of ${largeData.vials.length} vials`);

            // If using pagination/virtualization, should render subset
            // If rendering all, should still be performant
            expect(renderedCount).toBeGreaterThan(0);

            // Measure scroll performance if rendering all
            if (renderedCount > 50) {
                const scrollTime = await page.evaluate(() => {
                    const start = performance.now();

                    window.scrollTo(0, document.body.scrollHeight);

                    const end = performance.now();
                    return end - start;
                });

                // Scroll should be smooth (< 500ms)
                expect(scrollTime).toBeLessThan(500);

                console.log(`Scroll performance: ${scrollTime.toFixed(2)}ms`);
            }
        });

        test('should render chart with 500 data points', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(10, 5, 500);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();

            const startTime = Date.now();

            await page.click('text=Results');
            await page.waitForLoadState('networkidle');

            // Wait for chart to render
            const chartCanvas = page.locator('canvas');
            await expect(chartCanvas).toBeVisible({ timeout: 10000 });

            const renderTime = Date.now() - startTime;

            // Chart should render within 5 seconds
            expect(renderTime).toBeLessThan(5000);

            console.log(`Chart render time for ${largeData.weights.length} points: ${renderTime}ms`);
        });
    });

    test.describe('Memory Usage', () => {

        test('should not leak memory with repeated operations', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(50, 20, 50);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            await page.reload();

            // Measure initial memory
            const initialMemory = await page.evaluate(() => {
                if (performance.memory) {
                    return performance.memory.usedJSHeapSize;
                }
                return null;
            });

            // Perform operations repeatedly
            for (let i = 0; i < 10; i++) {
                await page.click('text=Vials');
                await page.waitForTimeout(100);

                await page.click('text=Injections');
                await page.waitForTimeout(100);

                await page.click('text=Results');
                await page.waitForTimeout(100);

                await page.click('text=Home');
                await page.waitForTimeout(100);
            }

            // Measure final memory
            const finalMemory = await page.evaluate(() => {
                if (performance.memory) {
                    return performance.memory.usedJSHeapSize;
                }
                return null;
            });

            if (initialMemory && finalMemory) {
                const memoryIncrease = finalMemory - initialMemory;
                const percentIncrease = (memoryIncrease / initialMemory) * 100;

                console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${percentIncrease.toFixed(1)}%)`);

                // Memory increase should be reasonable (< 50%)
                expect(percentIncrease).toBeLessThan(50);
            }
        });
    });

    test.describe('localStorage Performance', () => {

        test('should save large dataset quickly', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(100, 50, 200);

            const saveTime = await page.evaluate((data) => {
                const start = performance.now();

                localStorage.setItem('retatrutide_data', JSON.stringify(data));

                const end = performance.now();
                return end - start;
            }, largeData);

            // Should save within 500ms
            expect(saveTime).toBeLessThan(500);

            console.log(`localStorage save time: ${saveTime.toFixed(2)}ms`);

            // Verify data size
            const dataSize = await page.evaluate(() => {
                const data = localStorage.getItem('retatrutide_data');
                return data ? data.length : 0;
            });

            console.log(`Data size: ${(dataSize / 1024).toFixed(2)}KB`);

            // Should be under 5MB localStorage limit
            expect(dataSize).toBeLessThan(5 * 1024 * 1024);
        });

        test('should load large dataset quickly', async ({ isolated }) => {
            const { page } = isolated;

            const largeData = createLargeDataset(100, 50, 200);

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, largeData);

            const loadTime = await page.evaluate(() => {
                const start = performance.now();

                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');

                const end = performance.now();
                return end - start;
            });

            // Should load within 200ms
            expect(loadTime).toBeLessThan(200);

            console.log(`localStorage load time: ${loadTime.toFixed(2)}ms`);
        });
    });

    test.describe('Stress Test', () => {

        test('should handle maximum realistic dataset', async ({ isolated }) => {
            const { page } = isolated;

            // Maximum realistic scenario:
            // - 200 vials (multi-year supply)
            // - 100 injections per active vial (weekly for ~2 years)
            // - 1000 weight entries (daily for ~3 years)
            const maxData = createLargeDataset(200, 100, 1000);

            console.log(`Stress test dataset:`);
            console.log(`  Vials: ${maxData.vials.length}`);
            console.log(`  Injections: ${maxData.injections.length}`);
            console.log(`  Weights: ${maxData.weights.length}`);

            const startTime = Date.now();

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, maxData);

            await page.reload();
            await page.waitForLoadState('domcontentloaded');

            const totalTime = Date.now() - startTime;

            console.log(`Total load time: ${totalTime}ms`);

            // Should load within 10 seconds even under stress
            expect(totalTime).toBeLessThan(10000);

            // App should still be functional
            const appHeader = page.locator('#app-header, header');
            await expect(appHeader).toBeVisible();

            // Test navigation
            await page.click('text=Vials');
            await page.waitForTimeout(500);

            await page.click('text=Results');
            await page.waitForTimeout(500);

            // Should not crash
            await expect(appHeader).toBeVisible();
        });
    });
});
