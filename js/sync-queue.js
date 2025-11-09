/**
 * Sync Queue Manager
 * Handles reliable cloud synchronization with automatic retry and exponential backoff
 *
 * Features:
 * - Persistent queue in localStorage (survives app restarts)
 * - Exponential backoff retry (1s, 2s, 4s, 8s, 16s)
 * - Max 5 retry attempts before marking as failed
 * - Auto-process on network reconnect and app start
 * - Event system for UI updates
 */

class SyncQueue {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.queue = this.loadQueue();
        this.isProcessing = false;
        this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff in ms

        // Auto-process queue on network reconnect
        window.addEventListener('online', () => {
            console.log('[SyncQueue] Network online - processing queue');
            this.processQueue();
        });

        // Process queue on initialization (in case items were pending)
        if (this.queue.length > 0 && navigator.onLine) {
            console.log(`[SyncQueue] Found ${this.queue.length} pending operations on startup`);
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    /**
     * Load queue from localStorage
     */
    loadQueue() {
        try {
            const stored = localStorage.getItem('sync_queue');
            if (!stored) return [];

            const queue = JSON.parse(stored);
            console.log(`[SyncQueue] Loaded ${queue.length} operations from storage`);
            return queue;
        } catch (err) {
            console.error('[SyncQueue] Failed to load queue:', err);
            return [];
        }
    }

    /**
     * Save queue to localStorage
     */
    saveQueue() {
        try {
            localStorage.setItem('sync_queue', JSON.stringify(this.queue));
            this.dispatchEvent('sync-queue-updated', {
                queueLength: this.queue.length,
                pendingCount: this.queue.filter(op => op.status === 'pending').length,
                failedCount: this.queue.filter(op => op.status === 'failed').length
            });
        } catch (err) {
            console.error('[SyncQueue] Failed to save queue:', err);
        }
    }

    /**
     * Add operation to queue
     * @param {Object} operation - Operation to queue
     * @param {string} operation.type - Operation type (create/update/delete)
     * @param {string} operation.entity - Entity type (injection/vial/weight)
     * @param {Object} operation.data - Entity data
     * @param {string} operation.localId - Local ID for tracking
     */
    add(operation) {
        const queueItem = {
            id: `${operation.entity}-${operation.localId || Date.now()}`,
            ...operation,
            status: 'pending',
            retryCount: 0,
            addedAt: Date.now(),
            lastAttempt: null,
            error: null
        };

        this.queue.push(queueItem);
        this.saveQueue();

        console.log(`[SyncQueue] Added ${operation.type} ${operation.entity} to queue (ID: ${queueItem.id})`);

        // Start processing if online
        if (navigator.onLine && !this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process all pending operations in queue
     */
    async processQueue() {
        if (this.isProcessing) {
            console.log('[SyncQueue] Already processing queue');
            return;
        }

        if (!navigator.onLine) {
            console.log('[SyncQueue] Offline - skipping queue processing');
            return;
        }

        const pendingOps = this.queue.filter(op => op.status === 'pending');
        if (pendingOps.length === 0) {
            console.log('[SyncQueue] No pending operations');
            return;
        }

        this.isProcessing = true;
        console.log(`[SyncQueue] Processing ${pendingOps.length} pending operations`);

        for (const operation of pendingOps) {
            await this.processOperation(operation);
        }

        this.isProcessing = false;

        // Clean up completed operations older than 1 hour
        this.cleanupCompleted();
    }

    /**
     * Process single operation with retry logic
     */
    async processOperation(operation) {
        console.log(`[SyncQueue] Processing ${operation.type} ${operation.entity} (attempt ${operation.retryCount + 1})`);

        operation.lastAttempt = Date.now();

        try {
            await this.executeOperation(operation);

            // Success
            operation.status = 'completed';
            operation.completedAt = Date.now();
            operation.error = null;

            console.log(`[SyncQueue] ✓ Successfully synced ${operation.entity} (ID: ${operation.id})`);
            this.saveQueue();

        } catch (err) {
            console.error(`[SyncQueue] Failed to sync ${operation.entity}:`, err);

            operation.retryCount++;
            operation.error = err.message || 'Unknown error';

            // Check if we should retry
            if (operation.retryCount < this.retryDelays.length) {
                // Still have retries left - schedule next attempt
                const delay = this.retryDelays[operation.retryCount - 1];
                console.log(`[SyncQueue] Will retry ${operation.entity} in ${delay}ms (${operation.retryCount}/${this.retryDelays.length})`);

                operation.status = 'pending';
                this.saveQueue();

                // Wait before next attempt (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, delay));

            } else {
                // Max retries exceeded - mark as failed
                operation.status = 'failed';
                console.error(`[SyncQueue] ✗ Max retries exceeded for ${operation.entity} (ID: ${operation.id})`);

                this.saveQueue();
                this.dispatchEvent('sync-failure', {
                    operation,
                    error: operation.error
                });
            }
        }
    }

    /**
     * Execute the actual API call for an operation
     */
    async executeOperation(operation) {
        const { type, entity, data } = operation;

        switch (entity) {
            case 'injection':
                if (type === 'create') {
                    return await this.apiClient.createInjection(data);
                } else if (type === 'update') {
                    return await this.apiClient.updateInjection(data.id, data);
                } else if (type === 'delete') {
                    return await this.apiClient.deleteInjection(data.id);
                }
                break;

            case 'vial':
                if (type === 'create') {
                    return await this.apiClient.createVial(data);
                } else if (type === 'update') {
                    return await this.apiClient.updateVial(data.id, data);
                } else if (type === 'delete') {
                    return await this.apiClient.deleteVial(data.id);
                }
                break;

            case 'weight':
                if (type === 'create') {
                    return await this.apiClient.createWeight(data);
                } else if (type === 'update') {
                    return await this.apiClient.updateWeight(data.id, data);
                } else if (type === 'delete') {
                    return await this.apiClient.deleteWeight(data.id);
                }
                break;

            default:
                throw new Error(`Unknown entity type: ${entity}`);
        }

        throw new Error(`Unknown operation: ${type} ${entity}`);
    }

    /**
     * Remove completed operations older than 1 hour
     */
    cleanupCompleted() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const initialLength = this.queue.length;

        this.queue = this.queue.filter(op => {
            if (op.status === 'completed' && op.completedAt < oneHourAgo) {
                return false; // Remove
            }
            return true; // Keep
        });

        const removed = initialLength - this.queue.length;
        if (removed > 0) {
            console.log(`[SyncQueue] Cleaned up ${removed} completed operations`);
            this.saveQueue();
        }
    }

    /**
     * Get queue status summary
     */
    getStatus() {
        return {
            total: this.queue.length,
            pending: this.queue.filter(op => op.status === 'pending').length,
            completed: this.queue.filter(op => op.status === 'completed').length,
            failed: this.queue.filter(op => op.status === 'failed').length,
            isProcessing: this.isProcessing,
            isOnline: navigator.onLine
        };
    }

    /**
     * Get all operations (for UI display)
     */
    getOperations() {
        return [...this.queue].reverse(); // Most recent first
    }

    /**
     * Retry a failed operation
     */
    async retryOperation(operationId) {
        const operation = this.queue.find(op => op.id === operationId);
        if (!operation) {
            console.error(`[SyncQueue] Operation not found: ${operationId}`);
            return;
        }

        if (operation.status !== 'failed') {
            console.error(`[SyncQueue] Operation is not failed: ${operationId}`);
            return;
        }

        console.log(`[SyncQueue] Manually retrying ${operation.entity} (ID: ${operationId})`);

        // Reset retry count and status
        operation.retryCount = 0;
        operation.status = 'pending';
        operation.error = null;
        this.saveQueue();

        // Process immediately
        if (navigator.onLine) {
            await this.processOperation(operation);
        }
    }

    /**
     * Clear failed operations (user action)
     */
    clearFailed() {
        const failedCount = this.queue.filter(op => op.status === 'failed').length;
        this.queue = this.queue.filter(op => op.status !== 'failed');

        console.log(`[SyncQueue] Cleared ${failedCount} failed operations`);
        this.saveQueue();
    }

    /**
     * Clear all completed operations (user action)
     */
    clearCompleted() {
        const completedCount = this.queue.filter(op => op.status === 'completed').length;
        this.queue = this.queue.filter(op => op.status !== 'completed');

        console.log(`[SyncQueue] Cleared ${completedCount} completed operations`);
        this.saveQueue();
    }

    /**
     * Dispatch custom event for UI updates
     */
    dispatchEvent(eventName, detail) {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
}

// Export for use in main application
window.SyncQueue = SyncQueue;
