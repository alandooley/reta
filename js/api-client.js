/**
 * API Client for Retatrutide Cloud Backend
 * Handles all HTTP requests to AWS API Gateway
 */

class APIClient {
    constructor() {
        this.baseURL = 'https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com';
        this.authManager = null;
    }

    /**
     * Get API base URL
     */
    get API_BASE_URL() {
        return this.baseURL;
    }

    /**
     * Initialize with auth manager
     */
    initialize(authManager) {
        this.authManager = authManager;
    }

    /**
     * Make authenticated API request
     */
    async request(method, endpoint, body = null) {
        // Get auth token
        const token = await this.authManager.getIdToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            let data;

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                const errorMessage = data.error || data.message || data || 'Request failed';
                throw new Error(`API Error (${response.status}): ${errorMessage}`);
            }

            return data;
        } catch (error) {
            console.error(`API request failed: ${method} ${endpoint}`, error);
            throw error;
        }
    }

    // ========================================
    // INJECTIONS
    // ========================================

    /**
     * Get all injections
     */
    async getInjections() {
        const response = await this.request('GET', '/v1/injections');
        return response.data || [];
    }

    /**
     * Create injection
     */
    async createInjection(injection) {
        const response = await this.request('POST', '/v1/injections', injection);
        return response.data;
    }

    /**
     * Update injection (uses POST with existing ID for upsert)
     */
    async updateInjection(injectionId, injection) {
        const response = await this.request('POST', '/v1/injections', {
            id: injectionId,
            ...injection
        });
        return response.data;
    }

    /**
     * Delete injection
     */
    async deleteInjection(injectionId) {
        await this.request('DELETE', `/v1/injections/${injectionId}`);
    }

    // ========================================
    // VIALS
    // ========================================

    /**
     * Get all vials
     */
    async getVials() {
        const response = await this.request('GET', '/v1/vials');
        return response.data || [];
    }

    /**
     * Create vial
     */
    async createVial(vial) {
        const response = await this.request('POST', '/v1/vials', vial);
        return response.data;
    }

    /**
     * Delete vial
     */
    async deleteVial(vialId) {
        await this.request('DELETE', `/v1/vials/${vialId}`);
    }

    /**
     * Update vial
     */
    async updateVial(vialId, updates) {
        const response = await this.request('PATCH', `/v1/vials/${vialId}`, updates);
        return response.data;
    }

    // ========================================
    // WEIGHTS
    // ========================================

    /**
     * Get all weights
     */
    async getWeights() {
        const response = await this.request('GET', '/v1/weights');
        return response.data || [];
    }

    /**
     * Create weight entry
     */
    async createWeight(weight) {
        const response = await this.request('POST', '/v1/weights', weight);
        return response.data;
    }

    /**
     * Update weight entry (uses POST with existing ID for upsert)
     */
    async updateWeight(weightId, weight) {
        const response = await this.request('POST', '/v1/weights', {
            id: weightId,
            ...weight
        });
        return response.data;
    }

    /**
     * Delete weight entry
     */
    async deleteWeight(weightId) {
        await this.request('DELETE', `/v1/weights/${weightId}`);
    }

    // ========================================
    // SYNC & BACKUP
    // ========================================

    /**
     * Bulk sync data to cloud
     */
    async syncData(data) {
        const response = await this.request('POST', '/v1/sync', data);
        return response;
    }

    /**
     * Create backup
     */
    async createBackup() {
        const response = await this.request('POST', '/v1/backup');
        return response.backup;
    }

    /**
     * Get backup
     */
    async getBackup(backupKey) {
        const response = await this.request('GET', `/v1/backup?key=${encodeURIComponent(backupKey)}`);
        return response.data;
    }
}

// Export singleton instance
const apiClient = new APIClient();
