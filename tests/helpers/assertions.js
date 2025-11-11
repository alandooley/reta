/**
 * Custom Assertions for Retatrutide Tests
 *
 * Provides domain-specific assertions that make tests more readable.
 */

const { expect } = require('@playwright/test');

/**
 * Assert that localStorage contains specific data
 */
async function toHaveInLocalStorage(page, key, expectedValue) {
    const actualValue = await page.evaluate((k) => {
        return localStorage.getItem(k);
    }, key);

    if (expectedValue === undefined) {
        // Just check if key exists
        if (actualValue === null) {
            throw new Error(`Expected localStorage to contain key '${key}', but it was not found.`);
        }
    } else if (typeof expectedValue === 'object') {
        // Compare JSON
        const parsed = JSON.parse(actualValue);
        expect(parsed).toEqual(expectedValue);
    } else {
        // Compare strings
        expect(actualValue).toBe(expectedValue);
    }
}

/**
 * Assert that a vial exists with specific properties
 */
async function toHaveVial(page, vialId, expectedProps = {}) {
    const vial = await page.evaluate((id) => {
        const stored = localStorage.getItem('retatrutide_data');
        if (!stored) return null;

        const data = JSON.parse(stored);
        return data.vials?.find(v => v.vial_id === id) || null;
    }, vialId);

    if (!vial) {
        throw new Error(`Expected vial with id '${vialId}' to exist, but it was not found.`);
    }

    // Check properties
    Object.entries(expectedProps).forEach(([key, value]) => {
        if (vial[key] !== value) {
            throw new Error(`Expected vial.${key} to be ${value}, but got ${vial[key]}`);
        }
    });

    return vial;
}

/**
 * Assert that an injection exists
 */
async function toHaveInjection(page, injectionId, expectedProps = {}) {
    const injection = await page.evaluate((id) => {
        const stored = localStorage.getItem('retatrutide_data');
        if (!stored) return null;

        const data = JSON.parse(stored);
        return data.injections?.find(i => i.id === id) || null;
    }, injectionId);

    if (!injection) {
        throw new Error(`Expected injection with id '${injectionId}' to exist, but it was not found.`);
    }

    // Check properties
    Object.entries(expectedProps).forEach(([key, value]) => {
        if (injection[key] !== value) {
            throw new Error(`Expected injection.${key} to be ${value}, but got ${injection[key]}`);
        }
    });

    return injection;
}

/**
 * Assert vial volume calculations
 */
async function toHaveVialVolume(page, vialId, expectedVolume, tolerance = 0.01) {
    const vial = await page.evaluate((id) => {
        const stored = localStorage.getItem('retatrutide_data');
        if (!stored) return null;

        const data = JSON.parse(stored);
        return data.vials?.find(v => v.vial_id === id) || null;
    }, vialId);

    if (!vial) {
        throw new Error(`Expected vial with id '${vialId}' to exist, but it was not found.`);
    }

    const actualVolume = vial.current_volume_ml || 0;
    const diff = Math.abs(actualVolume - expectedVolume);

    if (diff > tolerance) {
        throw new Error(`Expected vial volume to be ${expectedVolume}ml (±${tolerance}), but got ${actualVolume}ml (diff: ${diff})`);
    }
}

/**
 * Assert that entity count matches
 */
async function toHaveEntityCount(page, entityType, expectedCount) {
    const actualCount = await page.evaluate((type) => {
        const stored = localStorage.getItem('retatrutide_data');
        if (!stored) return 0;

        const data = JSON.parse(stored);
        return data[type]?.length || 0;
    }, entityType);

    if (actualCount !== expectedCount) {
        throw new Error(`Expected ${expectedCount} ${entityType}, but found ${actualCount}`);
    }
}

/**
 * Assert that UI element shows specific text
 */
async function toShowText(page, selector, expectedText) {
    const element = page.locator(selector);
    await expect(element).toBeVisible();
    await expect(element).toContainText(expectedText);
}

/**
 * Assert that localStorage is empty
 */
async function toBeEmpty(page, storageKey = 'retatrutide_data') {
    const data = await page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;

        return JSON.parse(stored);
    }, storageKey);

    if (data && (
        (data.vials && data.vials.length > 0) ||
        (data.injections && data.injections.length > 0) ||
        (data.weights && data.weights.length > 0)
    )) {
        throw new Error(`Expected localStorage to be empty, but found: ${JSON.stringify({
            vials: data.vials?.length || 0,
            injections: data.injections?.length || 0,
            weights: data.weights?.length || 0
        })}`);
    }
}

/**
 * Assert that sync queue is empty
 */
async function toHaveSyncQueueEmpty(page) {
    const queueLength = await page.evaluate(() => {
        const queue = localStorage.getItem('sync_queue');
        if (!queue) return 0;

        try {
            const parsed = JSON.parse(queue);
            return parsed.length || 0;
        } catch {
            return 0;
        }
    });

    if (queueLength > 0) {
        throw new Error(`Expected sync queue to be empty, but found ${queueLength} items`);
    }
}

/**
 * Assert that sync queue has pending items
 */
async function toHavePendingSync(page, expectedCount) {
    const pendingCount = await page.evaluate(() => {
        const queue = localStorage.getItem('sync_queue');
        if (!queue) return 0;

        try {
            const parsed = JSON.parse(queue);
            return parsed.filter(item => item.status === 'pending').length;
        } catch {
            return 0;
        }
    });

    if (pendingCount !== expectedCount) {
        throw new Error(`Expected ${expectedCount} pending sync items, but found ${pendingCount}`);
    }
}

module.exports = {
    toHaveInLocalStorage,
    toHaveVial,
    toHaveInjection,
    toHaveVialVolume,
    toHaveEntityCount,
    toShowText,
    toBeEmpty,
    toHaveSyncQueueEmpty,
    toHavePendingSync
};
