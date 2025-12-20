/**
 * Cloud Storage Adapter
 * Provides seamless sync between local IndexedDB and cloud API
 */

class CloudStorage {
    constructor() {
        this.authManager = null;
        this.apiClient = null;
        this.localStorage = null;
        this.syncInProgress = false;
        this.autoSyncEnabled = true;
        this.lastSyncTime = null;
    }

    /**
     * Initialize cloud storage
     */
    async initialize(authManager, apiClient, localStorage) {
        this.authManager = authManager;
        this.apiClient = apiClient;
        this.localStorage = localStorage;

        // Listen for auth state changes
        this.authManager.onAuthStateChange((user) => {
            if (user && this.autoSyncEnabled) {
                // User signed in - sync data
                this.syncFromCloud().catch(console.error);
            }
        });

        console.log('Cloud storage initialized');
    }

    /**
     * Check if cloud sync is available
     */
    isCloudAvailable() {
        return this.authManager && this.authManager.isAuthenticated();
    }

    // ========================================
    // INJECTIONS
    // ========================================

    /**
     * Get all injections (local or cloud)
     */
    async getInjections() {
        if (this.isCloudAvailable()) {
            try {
                return await this.apiClient.getInjections();
            } catch (error) {
                console.warn('Cloud fetch failed, using local:', error);
                return await this.localStorage.getInjections();
            }
        }
        return await this.localStorage.getInjections();
    }

    /**
     * Save injection (local + cloud)
     */
    async saveInjection(injection) {
        // Save locally first (for offline support)
        const savedLocal = await this.localStorage.saveInjection(injection);

        // Sync to cloud if authenticated
        if (this.isCloudAvailable()) {
            try {
                const cloudInjection = await this.apiClient.createInjection({
                    timestamp: injection.timestamp,
                    doseMg: injection.doseMg,
                    site: injection.site,
                    notes: injection.notes || '',
                    vialId: injection.vialId || null,
                });

                // Update local with cloud ID
                savedLocal.id = cloudInjection.id;
                savedLocal.cloudSynced = true;
                await this.localStorage.saveInjection(savedLocal);

                return cloudInjection;
            } catch (error) {
                console.warn('Cloud save failed, saved locally:', error);
                savedLocal.cloudSynced = false;
                return savedLocal;
            }
        }

        savedLocal.cloudSynced = false;
        return savedLocal;
    }

    // ========================================
    // VIALS
    // ========================================

    /**
     * Get all vials (local or cloud)
     */
    async getVials() {
        if (this.isCloudAvailable()) {
            try {
                return await this.apiClient.getVials();
            } catch (error) {
                console.warn('Cloud fetch failed, using local:', error);
                return await this.localStorage.getVials();
            }
        }
        return await this.localStorage.getVials();
    }

    /**
     * Save vial (local + cloud)
     */
    async saveVial(vial) {
        // Save locally first
        const savedLocal = await this.localStorage.saveVial(vial);

        // Sync to cloud if authenticated
        if (this.isCloudAvailable()) {
            try {
                let cloudVial;

                const vialData = {
                    startDate: vial.order_date || vial.startDate,
                    initialVolumeMl: vial.bac_water_ml || vial.initialVolumeMl,
                    concentrationMgPerMl: vial.concentration_mg_ml || vial.concentrationMgPerMl,
                    currentVolumeMl: vial.current_volume_ml || vial.remaining_ml || vial.currentVolumeMl || vial.initialVolumeMl,
                    usedVolumeMl: vial.used_volume_ml || vial.usedVolumeMl || 0,
                    status: vial.status || 'active',
                    source: vial.supplier || vial.source || '',
                    notes: vial.notes || '',
                };

                // If vial has an ID, try to update it first
                if (vial.id || vial.vial_id) {
                    const vialId = vial.id || vial.vial_id;
                    try {
                        cloudVial = await this.apiClient.updateVial(vialId, vialData);
                        console.log('Vial updated in cloud:', vialId);
                    } catch (updateError) {
                        // If update fails (vial doesn't exist in cloud), try to create it
                        console.log('Update failed, trying to create vial in cloud:', updateError.message);
                        cloudVial = await this.apiClient.createVial({
                            id: vialId,  // Use existing ID to maintain consistency
                            ...vialData
                        });
                        console.log('Vial created in cloud:', cloudVial.id);
                    }
                } else {
                    // No ID - create new vial
                    cloudVial = await this.apiClient.createVial(vialData);
                    console.log('Vial created in cloud:', cloudVial.id);
                }

                // Update local with cloud ID
                savedLocal.id = cloudVial.id || savedLocal.id;
                savedLocal.cloudSynced = true;
                await this.localStorage.saveVial(savedLocal);

                return cloudVial;
            } catch (error) {
                console.warn('Cloud save failed, saved locally:', error);
                savedLocal.cloudSynced = false;
                return savedLocal;
            }
        }

        savedLocal.cloudSynced = false;
        return savedLocal;
    }

    /**
     * Delete vial (local + cloud)
     */
    async deleteVial(vialId) {
        // Delete from cloud first
        if (this.isCloudAvailable()) {
            try {
                await this.apiClient.deleteVial(vialId);
            } catch (error) {
                console.warn('Cloud delete failed:', error);
                throw error; // Don't delete locally if cloud delete fails
            }
        }

        // Delete locally
        await this.localStorage.deleteVial(vialId);
    }

    // ========================================
    // WEIGHTS
    // ========================================

    /**
     * Get all weights (local or cloud)
     */
    async getWeights() {
        if (this.isCloudAvailable()) {
            try {
                return await this.apiClient.getWeights();
            } catch (error) {
                console.warn('Cloud fetch failed, using local:', error);
                return await this.localStorage.getWeights();
            }
        }
        return await this.localStorage.getWeights();
    }

    /**
     * Save weight (local + cloud)
     */
    async saveWeight(weight) {
        // Save locally first
        const savedLocal = await this.localStorage.saveWeight(weight);

        // Sync to cloud if authenticated
        if (this.isCloudAvailable()) {
            try {
                const cloudWeight = await this.apiClient.createWeight({
                    timestamp: weight.timestamp,
                    weightKg: weight.weightKg,
                    notes: weight.notes || '',
                });

                // Update local with cloud ID
                savedLocal.id = cloudWeight.id;
                savedLocal.cloudSynced = true;
                await this.localStorage.saveWeight(savedLocal);

                return cloudWeight;
            } catch (error) {
                console.warn('Cloud save failed, saved locally:', error);
                savedLocal.cloudSynced = false;
                return savedLocal;
            }
        }

        savedLocal.cloudSynced = false;
        return savedLocal;
    }

    // ========================================
    // TRT INJECTIONS
    // ========================================

    /**
     * Get all TRT injections (local or cloud)
     */
    async getTrtInjections() {
        if (this.isCloudAvailable()) {
            try {
                return await this.apiClient.getTrtInjections();
            } catch (error) {
                console.warn('Cloud fetch failed, using local:', error);
                return await this.localStorage.getTrtInjections();
            }
        }
        return await this.localStorage.getTrtInjections();
    }

    /**
     * Save TRT injection (local + cloud)
     */
    async saveTrtInjection(injection) {
        // Save locally first (for offline support)
        const savedLocal = await this.localStorage.saveTrtInjection(injection);

        // Sync to cloud if authenticated
        if (this.isCloudAvailable()) {
            try {
                const cloudInjection = await this.apiClient.createTrtInjection({
                    timestamp: injection.timestamp,
                    volumeMl: injection.volumeMl,
                    concentrationMgMl: injection.concentrationMgMl,
                    doseMg: injection.doseMg,
                    injectionSite: injection.injectionSite,
                    timeOfDay: injection.timeOfDay || null,
                    techniqueNotes: injection.techniqueNotes || '',
                    notes: injection.notes || '',
                    vialId: injection.vialId || null,
                    skipped: injection.skipped || false,
                    plannedVolumeMl: injection.plannedVolumeMl || null,
                    plannedDoseMg: injection.plannedDoseMg || null,
                });

                // Update local with cloud ID
                savedLocal.id = cloudInjection.id;
                savedLocal.cloudSynced = true;
                await this.localStorage.saveTrtInjection(savedLocal);

                return cloudInjection;
            } catch (error) {
                console.warn('Cloud save failed, saved locally:', error);
                savedLocal.cloudSynced = false;
                return savedLocal;
            }
        }

        savedLocal.cloudSynced = false;
        return savedLocal;
    }

    /**
     * Delete TRT injection (local + cloud)
     */
    async deleteTrtInjection(injectionId) {
        // Delete from cloud first
        if (this.isCloudAvailable()) {
            try {
                await this.apiClient.deleteTrtInjection(injectionId);
            } catch (error) {
                console.warn('Cloud delete failed:', error);
            }
        }

        // Always delete locally
        await this.localStorage.deleteTrtInjection(injectionId);
    }

    // ========================================
    // TRT VIALS
    // ========================================

    /**
     * Get all TRT vials (local or cloud)
     */
    async getTrtVials() {
        if (this.isCloudAvailable()) {
            try {
                return await this.apiClient.getTrtVials();
            } catch (error) {
                console.warn('Cloud fetch failed, using local:', error);
                return await this.localStorage.getTrtVials();
            }
        }
        return await this.localStorage.getTrtVials();
    }

    /**
     * Save TRT vial (local + cloud)
     */
    async saveTrtVial(vial) {
        // Save locally first (for offline support)
        const savedLocal = await this.localStorage.saveTrtVial(vial);

        // Sync to cloud if authenticated
        if (this.isCloudAvailable()) {
            try {
                let cloudVial;

                const vialData = {
                    concentrationMgMl: vial.concentration_mg_ml || vial.concentrationMgMl,
                    volumeMl: vial.volume_ml || vial.volumeMl,
                    remainingMl: vial.remaining_ml || vial.remainingMl,
                    lotNumber: vial.lot_number || vial.lotNumber || '',
                    expiryDate: vial.expiry_date || vial.expiryDate,
                    openedDate: vial.opened_date || vial.openedDate || null,
                    status: vial.status,
                    notes: vial.notes || '',
                };

                // If vial has an ID, try to update it first
                if (vial.id) {
                    try {
                        cloudVial = await this.apiClient.patchTrtVial(vial.id, vialData);
                        console.log('TRT vial updated in cloud:', vial.id);
                    } catch (patchError) {
                        // If PATCH fails (vial doesn't exist in cloud), try to create it
                        console.log('PATCH failed, trying to create vial in cloud:', patchError.message);
                        cloudVial = await this.apiClient.createTrtVial({
                            id: vial.id,  // Use existing ID to maintain consistency
                            ...vialData
                        });
                        console.log('TRT vial created in cloud:', cloudVial.id);
                    }
                } else {
                    // No ID - create new vial
                    cloudVial = await this.apiClient.createTrtVial(vialData);
                    console.log('TRT vial created in cloud:', cloudVial.id);
                }

                // Update local with cloud ID
                savedLocal.id = cloudVial.id || savedLocal.id;
                savedLocal.cloudSynced = true;
                await this.localStorage.saveTrtVial(savedLocal);

                return cloudVial;
            } catch (error) {
                console.warn('Cloud save failed, saved locally:', error);
                savedLocal.cloudSynced = false;
                return savedLocal;
            }
        }

        savedLocal.cloudSynced = false;
        return savedLocal;
    }

    /**
     * Delete TRT vial (local + cloud)
     */
    async deleteTrtVial(vialId) {
        // Delete from cloud first
        if (this.isCloudAvailable()) {
            try {
                await this.apiClient.deleteTrtVial(vialId);
            } catch (error) {
                console.warn('Cloud delete failed:', error);
            }
        }

        // Always delete locally
        await this.localStorage.deleteTrtVial(vialId);
    }

    // ========================================
    // TRT SYMPTOMS
    // ========================================

    /**
     * Get all TRT symptoms (local or cloud)
     */
    async getTrtSymptoms() {
        if (this.isCloudAvailable()) {
            try {
                return await this.apiClient.getTrtSymptoms();
            } catch (error) {
                console.warn('Cloud fetch failed, using local:', error);
                return await this.localStorage.getTrtSymptoms();
            }
        }
        return await this.localStorage.getTrtSymptoms();
    }

    /**
     * Save TRT symptom (local + cloud)
     */
    async saveTrtSymptom(symptom) {
        // Save locally first (for offline support)
        const savedLocal = await this.localStorage.saveTrtSymptom(symptom);

        // Sync to cloud if authenticated
        if (this.isCloudAvailable()) {
            try {
                const cloudSymptom = await this.apiClient.createTrtSymptom({
                    id: symptom.id,
                    timestamp: symptom.timestamp,
                    energyLevel: symptom.energyLevel,
                    mood: symptom.mood,
                    libido: symptom.libido,
                    sleepQuality: symptom.sleepQuality,
                    notes: symptom.notes || '',
                });

                // Update local with cloud confirmation
                savedLocal.cloudSynced = true;
                await this.localStorage.saveTrtSymptom(savedLocal);

                return cloudSymptom;
            } catch (error) {
                console.warn('Cloud save failed, saved locally:', error);
                savedLocal.cloudSynced = false;
                return savedLocal;
            }
        }

        savedLocal.cloudSynced = false;
        return savedLocal;
    }

    /**
     * Delete TRT symptom (local + cloud)
     */
    async deleteTrtSymptom(symptomId) {
        // Delete from cloud first
        if (this.isCloudAvailable()) {
            try {
                await this.apiClient.deleteTrtSymptom(symptomId);
            } catch (error) {
                console.warn('Cloud delete failed:', error);
            }
        }

        // Always delete locally
        await this.localStorage.deleteTrtSymptom(symptomId);
    }

    // ========================================
    // SYNC OPERATIONS
    // ========================================

    /**
     * Sync local data to cloud (upload)
     */
    async syncToCloud() {
        if (!this.isCloudAvailable()) {
            throw new Error('Not authenticated');
        }

        if (this.syncInProgress) {
            console.log('Sync already in progress');
            return;
        }

        this.syncInProgress = true;

        try {
            console.log('Starting sync to cloud...');

            // Get all local data
            const [injections, vials, weights] = await Promise.all([
                this.localStorage.getInjections(),
                this.localStorage.getVials(),
                this.localStorage.getWeights(),
            ]);

            // Filter out already synced items
            const unsyncedInjections = injections.filter(i => !i.cloudSynced);
            const unsyncedVials = vials.filter(v => !v.cloudSynced);
            const unsyncedWeights = weights.filter(w => !w.cloudSynced);

            if (unsyncedInjections.length === 0 && unsyncedVials.length === 0 && unsyncedWeights.length === 0) {
                console.log('Nothing to sync');
                this.lastSyncTime = new Date().toISOString();
                return { success: true, message: 'Already in sync' };
            }

            // Bulk upload
            const result = await this.apiClient.syncData({
                injections: unsyncedInjections,
                vials: unsyncedVials,
                weights: unsyncedWeights,
            });

            console.log('Sync complete:', result);

            // Mark items as synced
            for (const injection of unsyncedInjections) {
                injection.cloudSynced = true;
                await this.localStorage.saveInjection(injection);
            }
            for (const vial of unsyncedVials) {
                vial.cloudSynced = true;
                await this.localStorage.saveVial(vial);
            }
            for (const weight of unsyncedWeights) {
                weight.cloudSynced = true;
                await this.localStorage.saveWeight(weight);
            }

            this.lastSyncTime = new Date().toISOString();
            return result;

        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync cloud data to local (download)
     */
    async syncFromCloud() {
        if (!this.isCloudAvailable()) {
            throw new Error('Not authenticated');
        }

        if (this.syncInProgress) {
            console.log('Sync already in progress');
            return;
        }

        this.syncInProgress = true;

        try {
            console.log('Starting sync from cloud...');

            // Get all cloud data
            const [cloudInjections, cloudVials, cloudWeights] = await Promise.all([
                this.apiClient.getInjections(),
                this.apiClient.getVials(),
                this.apiClient.getWeights(),
            ]);

            // Save to local storage
            for (const injection of cloudInjections) {
                injection.cloudSynced = true;
                await this.localStorage.saveInjection(injection);
            }

            for (const vial of cloudVials) {
                vial.cloudSynced = true;
                await this.localStorage.saveVial(vial);
            }

            for (const weight of cloudWeights) {
                weight.cloudSynced = true;
                await this.localStorage.saveWeight(weight);
            }

            this.lastSyncTime = new Date().toISOString();

            console.log(`Synced from cloud: ${cloudInjections.length} injections, ${cloudVials.length} vials, ${cloudWeights.length} weights`);

            return {
                success: true,
                counts: {
                    injections: cloudInjections.length,
                    vials: cloudVials.length,
                    weights: cloudWeights.length,
                },
            };

        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Bidirectional sync (merge local and cloud)
     */
    async fullSync() {
        if (!this.isCloudAvailable()) {
            throw new Error('Not authenticated');
        }

        // First, sync local changes to cloud
        await this.syncToCloud();

        // Then, sync cloud changes to local
        await this.syncFromCloud();

        return { success: true, lastSyncTime: this.lastSyncTime };
    }

    /**
     * Get sync status
     */
    getSyncStatus() {
        return {
            isAvailable: this.isCloudAvailable(),
            inProgress: this.syncInProgress,
            lastSyncTime: this.lastSyncTime,
            autoSyncEnabled: this.autoSyncEnabled,
        };
    }

    /**
     * Enable/disable auto-sync
     */
    setAutoSync(enabled) {
        this.autoSyncEnabled = enabled;
    }
}

// Export singleton instance
const cloudStorage = new CloudStorage();
