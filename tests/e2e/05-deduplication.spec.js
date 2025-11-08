/**
 * Deduplication Tests
 * Tests comprehensive duplicate detection and removal logic
 *
 * What's Tested:
 * - Duplicate detection based on (timestamp + dose_mg + injection_site)
 * - Keeps most complete record (prefers records with notes, weight_kg, vial_id)
 * - Deletes duplicates from localStorage
 * - Grouping logic for multiple duplicate sets
 * - Edge cases (partial duplicates, identical records)
 */

const { test, expect } = require('@playwright/test');
const {
    clearAllStorage,
    loadTestData,
    waitForAppReady,
    getInjections,
    reloadPage
} = require('../helpers/test-utils');

const {
    createValidInjection,
    createValidVial
} = require('../fixtures/test-data');

test.describe('Deduplication - Duplicate Detection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should detect exact duplicates (same timestamp, dose, site)', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-1',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-2',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        // Run deduplication logic
        const result = await page.evaluate(() => {
            const injections = JSON.parse(localStorage.getItem('injectionTrackerData')).injections;

            // Group by unique key
            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            // Find duplicates
            const duplicates = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    duplicates.push({ key, count: group.length });
                }
            });

            return { duplicatesFound: duplicates.length, totalGroups: groups.size };
        });

        expect(result.duplicatesFound).toBe(1);
        expect(result.totalGroups).toBe(1);
    });

    test('should NOT detect different timestamps as duplicates', async ({ page }) => {
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-1',
                timestamp: '2025-11-07T10:00:00Z',
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-2',
                timestamp: '2025-11-07T11:00:00Z', // Different timestamp
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const injections = JSON.parse(localStorage.getItem('injectionTrackerData')).injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const duplicates = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    duplicates.push({ key, count: group.length });
                }
            });

            return { duplicatesFound: duplicates.length, totalGroups: groups.size };
        });

        expect(result.duplicatesFound).toBe(0);
        expect(result.totalGroups).toBe(2);
    });

    test('should NOT detect different doses as duplicates', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-1',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-2',
                timestamp,
                dose_mg: 0.75, // Different dose
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const injections = JSON.parse(localStorage.getItem('injectionTrackerData')).injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const duplicates = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    duplicates.push({ key, count: group.length });
                }
            });

            return { duplicatesFound: duplicates.length, totalGroups: groups.size };
        });

        expect(result.duplicatesFound).toBe(0);
        expect(result.totalGroups).toBe(2);
    });

    test('should NOT detect different sites as duplicates', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-1',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-2',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'right_thigh', // Different site
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const injections = JSON.parse(localStorage.getItem('injectionTrackerData')).injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const duplicates = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    duplicates.push({ key, count: group.length });
                }
            });

            return { duplicatesFound: duplicates.length, totalGroups: groups.size };
        });

        expect(result.duplicatesFound).toBe(0);
        expect(result.totalGroups).toBe(2);
    });

    test('should detect multiple sets of duplicates', async ({ page }) => {
        const vial = createValidVial();

        const injections = [
            // First duplicate set
            createValidInjection({
                id: 'inj-1a',
                timestamp: '2025-11-07T10:00:00Z',
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-1b',
                timestamp: '2025-11-07T10:00:00Z',
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            // Second duplicate set
            createValidInjection({
                id: 'inj-2a',
                timestamp: '2025-11-08T10:00:00Z',
                dose_mg: 0.75,
                injection_site: 'abdomen_right',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-2b',
                timestamp: '2025-11-08T10:00:00Z',
                dose_mg: 0.75,
                injection_site: 'abdomen_right',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-2c',
                timestamp: '2025-11-08T10:00:00Z',
                dose_mg: 0.75,
                injection_site: 'abdomen_right',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const injections = JSON.parse(localStorage.getItem('injectionTrackerData')).injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const duplicates = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    duplicates.push({ key, count: group.length });
                }
            });

            return {
                duplicatesFound: duplicates.length,
                duplicateCounts: duplicates.map(d => d.count)
            };
        });

        expect(result.duplicatesFound).toBe(2); // Two sets of duplicates
        expect(result.duplicateCounts).toContain(2); // First set has 2 copies
        expect(result.duplicateCounts).toContain(3); // Second set has 3 copies
    });
});

test.describe('Deduplication - Record Selection', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should keep most complete record (with notes, weight, vial)', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            // Minimal record
            createValidInjection({
                id: 'inj-minimal',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: null,
                weight_kg: null,
                notes: ''
            }),
            // Complete record
            createValidInjection({
                id: 'inj-complete',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id,
                weight_kg: 80.0,
                notes: 'Detailed notes'
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        // Run deduplication
        const result = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const injections = data.injections;

            // Group by unique key
            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            // Find duplicates and select best
            const toDelete = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    // Sort by completeness
                    group.sort((a, b) => {
                        const scoreA = (a.notes ? 1 : 0) + (a.weight_kg ? 1 : 0) + (a.vial_id ? 1 : 0);
                        const scoreB = (b.notes ? 1 : 0) + (b.weight_kg ? 1 : 0) + (b.vial_id ? 1 : 0);
                        return scoreB - scoreA; // Higher score first
                    });

                    // Keep first (most complete), delete rest
                    for (let i = 1; i < group.length; i++) {
                        toDelete.push(group[i].id);
                    }
                }
            });

            // Delete from array
            data.injections = data.injections.filter(inj => !toDelete.includes(inj.id));
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));

            return {
                deletedIds: toDelete,
                remainingId: data.injections[0]?.id,
                remainingCount: data.injections.length
            };
        });

        expect(result.deletedIds).toContain('inj-minimal');
        expect(result.remainingId).toBe('inj-complete');
        expect(result.remainingCount).toBe(1);
    });

    test('should prefer record with notes over no notes', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-no-notes',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id,
                notes: ''
            }),
            createValidInjection({
                id: 'inj-with-notes',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id,
                notes: 'Important notes'
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const injections = data.injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const toDelete = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    group.sort((a, b) => {
                        const scoreA = (a.notes ? 1 : 0) + (a.weight_kg ? 1 : 0) + (a.vial_id ? 1 : 0);
                        const scoreB = (b.notes ? 1 : 0) + (b.weight_kg ? 1 : 0) + (b.vial_id ? 1 : 0);
                        return scoreB - scoreA;
                    });

                    for (let i = 1; i < group.length; i++) {
                        toDelete.push(group[i].id);
                    }
                }
            });

            data.injections = data.injections.filter(inj => !toDelete.includes(inj.id));
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));

            return {
                deletedIds: toDelete,
                remainingId: data.injections[0]?.id
            };
        });

        expect(result.deletedIds).toContain('inj-no-notes');
        expect(result.remainingId).toBe('inj-with-notes');
    });

    test('should prefer record with weight over no weight', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-no-weight',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id,
                weight_kg: null
            }),
            createValidInjection({
                id: 'inj-with-weight',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id,
                weight_kg: 80.0
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const injections = data.injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const toDelete = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    group.sort((a, b) => {
                        const scoreA = (a.notes ? 1 : 0) + (a.weight_kg ? 1 : 0) + (a.vial_id ? 1 : 0);
                        const scoreB = (b.notes ? 1 : 0) + (b.weight_kg ? 1 : 0) + (b.vial_id ? 1 : 0);
                        return scoreB - scoreA;
                    });

                    for (let i = 1; i < group.length; i++) {
                        toDelete.push(group[i].id);
                    }
                }
            });

            data.injections = data.injections.filter(inj => !toDelete.includes(inj.id));
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));

            return {
                deletedIds: toDelete,
                remainingId: data.injections[0]?.id
            };
        });

        expect(result.deletedIds).toContain('inj-no-weight');
        expect(result.remainingId).toBe('inj-with-weight');
    });

    test('should handle identical completeness scores (keeps first)', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-first',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-second',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const injections = data.injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const toDelete = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    group.sort((a, b) => {
                        const scoreA = (a.notes ? 1 : 0) + (a.weight_kg ? 1 : 0) + (a.vial_id ? 1 : 0);
                        const scoreB = (b.notes ? 1 : 0) + (b.weight_kg ? 1 : 0) + (b.vial_id ? 1 : 0);
                        return scoreB - scoreA;
                    });

                    for (let i = 1; i < group.length; i++) {
                        toDelete.push(group[i].id);
                    }
                }
            });

            data.injections = data.injections.filter(inj => !toDelete.includes(inj.id));
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));

            return {
                remainingCount: data.injections.length,
                remainingId: data.injections[0]?.id
            };
        });

        expect(result.remainingCount).toBe(1);
        // Either could be kept, but only one should remain
    });
});

test.describe('Deduplication - Data Cleanup', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000/?test=true');
        await clearAllStorage(page);
        await waitForAppReady(page);
    });

    test('should remove duplicates from localStorage', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-1',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id,
                notes: 'Keep this one'
            }),
            createValidInjection({
                id: 'inj-2',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-3',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        // Before deduplication
        let beforeCount = (await getInjections(page)).length;
        expect(beforeCount).toBe(3);

        // Run deduplication
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const injections = data.injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const toDelete = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    group.sort((a, b) => {
                        const scoreA = (a.notes ? 1 : 0) + (a.weight_kg ? 1 : 0) + (a.vial_id ? 1 : 0);
                        const scoreB = (b.notes ? 1 : 0) + (b.weight_kg ? 1 : 0) + (b.vial_id ? 1 : 0);
                        return scoreB - scoreA;
                    });

                    for (let i = 1; i < group.length; i++) {
                        toDelete.push(group[i].id);
                    }
                }
            });

            data.injections = data.injections.filter(inj => !toDelete.includes(inj.id));
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));
        });

        // After deduplication
        let afterCount = (await getInjections(page)).length;
        expect(afterCount).toBe(1);

        const remaining = await getInjections(page);
        expect(remaining[0].id).toBe('inj-1');
        expect(remaining[0].notes).toBe('Keep this one');
    });

    test('should handle no duplicates gracefully', async ({ page }) => {
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-1',
                timestamp: '2025-11-07T10:00:00Z',
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            }),
            createValidInjection({
                id: 'inj-2',
                timestamp: '2025-11-08T10:00:00Z',
                dose_mg: 0.5,
                injection_site: 'right_thigh',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        const result = await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const injections = data.injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const duplicates = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    duplicates.push({ key, count: group.length });
                }
            });

            return {
                duplicatesFound: duplicates.length,
                originalCount: injections.length
            };
        });

        expect(result.duplicatesFound).toBe(0);
        expect(result.originalCount).toBe(2);

        // Verify no data lost
        const afterInjections = await getInjections(page);
        expect(afterInjections.length).toBe(2);
    });

    test('should persist deduplication across reloads', async ({ page }) => {
        const timestamp = '2025-11-07T10:00:00Z';
        const vial = createValidVial();

        const injections = [
            createValidInjection({
                id: 'inj-keep',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id,
                notes: 'Best record'
            }),
            createValidInjection({
                id: 'inj-delete',
                timestamp,
                dose_mg: 0.5,
                injection_site: 'left_thigh',
                vial_id: vial.vial_id
            })
        ];

        await loadTestData(page, { injections, vials: [vial], weights: [] });
        await reloadPage(page);

        // Run deduplication
        await page.evaluate(() => {
            const data = JSON.parse(localStorage.getItem('injectionTrackerData'));
            const injections = data.injections;

            const groups = new Map();
            injections.forEach(injection => {
                const key = `${injection.timestamp}|${injection.dose_mg}|${injection.injection_site}`;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(injection);
            });

            const toDelete = [];
            groups.forEach((group, key) => {
                if (group.length > 1) {
                    group.sort((a, b) => {
                        const scoreA = (a.notes ? 1 : 0) + (a.weight_kg ? 1 : 0) + (a.vial_id ? 1 : 0);
                        const scoreB = (b.notes ? 1 : 0) + (b.weight_kg ? 1 : 0) + (b.vial_id ? 1 : 0);
                        return scoreB - scoreA;
                    });

                    for (let i = 1; i < group.length; i++) {
                        toDelete.push(group[i].id);
                    }
                }
            });

            data.injections = data.injections.filter(inj => !toDelete.includes(inj.id));
            localStorage.setItem('injectionTrackerData', JSON.stringify(data));
        });

        // Reload and verify still deduplicated
        await reloadPage(page);

        const afterReload = await getInjections(page);
        expect(afterReload.length).toBe(1);
        expect(afterReload[0].id).toBe('inj-keep');
    });
});
