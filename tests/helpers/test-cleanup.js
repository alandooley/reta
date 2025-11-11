/**
 * Test Cleanup Utilities
 *
 * Ensures NO test data remains after tests complete.
 * Provides verification and cleanup functions.
 */

/**
 * Verify that localStorage is clean (no test data remains)
 */
async function verifyNoTestDataRemains(page) {
    const hasTestData = await page.evaluate(() => {
        const storageKey = 'retatrutide_data';
        const stored = localStorage.getItem(storageKey);

        if (!stored) {
            return false; // No data = clean
        }

        try {
            const data = JSON.parse(stored);

            // Check for test IDs (prefixed with 'test-')
            const hasTestVials = data.vials?.some(v => v.vial_id?.startsWith('test-'));
            const hasTestInjections = data.injections?.some(i => i.id?.startsWith('test-'));
            const hasTestWeights = data.weights?.some(w => w.id?.startsWith('test-'));

            return hasTestVials || hasTestInjections || hasTestWeights;
        } catch (e) {
            return false;
        }
    });

    if (hasTestData) {
        throw new Error('Test data was not cleaned up! Found test IDs in localStorage.');
    }

    return true;
}

/**
 * Nuclear cleanup - removes ALL data (use in afterEach)
 */
async function nuclearCleanup(page) {
    await page.evaluate(() => {
        // Clear localStorage
        localStorage.clear();

        // Clear sessionStorage
        sessionStorage.clear();

        // Note: We can't delete IndexedDB here because it's async
        // and afterEach doesn't wait for promises in evaluate()
        // Tests should not rely on IndexedDB if they need guaranteed cleanup
    });
}

/**
 * Snapshot current state (use in beforeEach)
 */
async function snapshotState(page) {
    return await page.evaluate(() => {
        const snapshot = {
            localStorage: { ...localStorage },
            sessionStorage: { ...sessionStorage }
        };

        // Store snapshot for potential rollback
        window.__testSnapshot = snapshot;

        return snapshot;
    });
}

/**
 * Rollback to snapshot (use if test fails midway)
 */
async function rollbackToSnapshot(page) {
    await page.evaluate(() => {
        if (!window.__testSnapshot) {
            console.warn('No snapshot found to rollback to');
            return;
        }

        // Clear current state
        localStorage.clear();
        sessionStorage.clear();

        // Restore snapshot
        const snapshot = window.__testSnapshot;

        Object.entries(snapshot.localStorage).forEach(([key, value]) => {
            if (key !== '__testSnapshot') {
                localStorage.setItem(key, value);
            }
        });

        Object.entries(snapshot.sessionStorage).forEach(([key, value]) => {
            sessionStorage.setItem(key, value);
        });

        delete window.__testSnapshot;
    });
}

/**
 * Get current data counts (for debugging)
 */
async function getDataCounts(page) {
    return await page.evaluate(() => {
        const stored = localStorage.getItem('retatrutide_data');
        if (!stored) {
            return { vials: 0, injections: 0, weights: 0 };
        }

        try {
            const data = JSON.parse(stored);
            return {
                vials: data.vials?.length || 0,
                injections: data.injections?.length || 0,
                weights: data.weights?.length || 0
            };
        } catch (e) {
            return { vials: 0, injections: 0, weights: 0, error: e.message };
        }
    });
}

/**
 * Assert that specific data exists
 */
async function assertDataExists(page, entityType, id) {
    const exists = await page.evaluate(({ entityType, id }) => {
        const stored = localStorage.getItem('retatrutide_data');
        if (!stored) return false;

        try {
            const data = JSON.parse(stored);
            const entities = data[entityType];
            if (!entities) return false;

            if (entityType === 'vials') {
                return entities.some(e => e.vial_id === id);
            } else {
                return entities.some(e => e.id === id);
            }
        } catch (e) {
            return false;
        }
    }, { entityType, id });

    if (!exists) {
        throw new Error(`Expected ${entityType} with id '${id}' to exist, but it was not found.`);
    }

    return true;
}

/**
 * Assert that specific data does NOT exist
 */
async function assertDataNotExists(page, entityType, id) {
    const exists = await page.evaluate(({ entityType, id }) => {
        const stored = localStorage.getItem('retatrutide_data');
        if (!stored) return false;

        try {
            const data = JSON.parse(stored);
            const entities = data[entityType];
            if (!entities) return false;

            if (entityType === 'vials') {
                return entities.some(e => e.vial_id === id);
            } else {
                return entities.some(e => e.id === id);
            }
        } catch (e) {
            return false;
        }
    }, { entityType, id });

    if (exists) {
        throw new Error(`Expected ${entityType} with id '${id}' to NOT exist, but it was found.`);
    }

    return true;
}

/**
 * Load test data into localStorage
 */
async function loadTestData(page, testData) {
    await page.evaluate((data) => {
        localStorage.setItem('retatrutide_data', JSON.stringify(data));
    }, testData);
}

module.exports = {
    verifyNoTestDataRemains,
    nuclearCleanup,
    snapshotState,
    rollbackToSnapshot,
    getDataCounts,
    assertDataExists,
    assertDataNotExists,
    loadTestData
};
