/**
 * Transaction Wrapper
 *
 * Provides transaction-like behavior for tests using snapshots.
 * Since we don't have real database transactions, we simulate them
 * by taking snapshots before tests and rolling back on completion.
 */

class TransactionWrapper {
    constructor(page) {
        this.page = page;
        this.snapshot = null;
    }

    /**
     * Begin transaction (take snapshot of current state)
     */
    async begin() {
        this.snapshot = await this.page.evaluate(() => {
            // Snapshot localStorage
            const localStorageCopy = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                localStorageCopy[key] = localStorage.getItem(key);
            }

            // Snapshot sessionStorage
            const sessionStorageCopy = {};
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                sessionStorageCopy[key] = sessionStorage.getItem(key);
            }

            return {
                localStorage: localStorageCopy,
                sessionStorage: sessionStorageCopy,
                timestamp: Date.now()
            };
        });

        console.log(`[TRANSACTION] Began at ${new Date(this.snapshot.timestamp).toISOString()}`);
        return this.snapshot;
    }

    /**
     * Commit transaction (keep current state, discard snapshot)
     */
    async commit() {
        console.log('[TRANSACTION] Committed - keeping current state');
        this.snapshot = null;
    }

    /**
     * Rollback transaction (restore snapshot)
     */
    async rollback() {
        if (!this.snapshot) {
            console.warn('[TRANSACTION] No snapshot to rollback to');
            return;
        }

        await this.page.evaluate((snapshot) => {
            // Clear current storage
            localStorage.clear();
            sessionStorage.clear();

            // Restore snapshot
            Object.entries(snapshot.localStorage).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });

            Object.entries(snapshot.sessionStorage).forEach(([key, value]) => {
                sessionStorage.setItem(key, value);
            });
        }, this.snapshot);

        console.log(`[TRANSACTION] Rolled back to ${new Date(this.snapshot.timestamp).toISOString()}`);
        this.snapshot = null;
    }

    /**
     * Get current state diff from snapshot
     */
    async getDiff() {
        if (!this.snapshot) {
            return { message: 'No snapshot available' };
        }

        return await this.page.evaluate((snapshot) => {
            const currentData = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
            const snapshotData = JSON.parse(snapshot.localStorage['retatrutide_data'] || '{}');

            return {
                vialsAdded: (currentData.vials?.length || 0) - (snapshotData.vials?.length || 0),
                injectionsAdded: (currentData.injections?.length || 0) - (snapshotData.injections?.length || 0),
                weightsAdded: (currentData.weights?.length || 0) - (snapshotData.weights?.length || 0)
            };
        }, this.snapshot);
    }
}

/**
 * Async function wrapper that automatically rolls back on error
 */
async function withTransaction(page, testFn) {
    const transaction = new TransactionWrapper(page);

    try {
        await transaction.begin();
        await testFn();
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * Fixture for Playwright tests
 */
const transactionFixture = {
    transaction: async ({ page }, use) => {
        const transaction = new TransactionWrapper(page);
        await transaction.begin();

        try {
            await use(transaction);
            await transaction.rollback(); // Always rollback, even on success
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
};

module.exports = {
    TransactionWrapper,
    withTransaction,
    transactionFixture
};
