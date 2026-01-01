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

                // Convert local status to cloud-compatible status
                // Local uses 'unopened', 'activated', 'finished' but cloud only accepts 'active', 'dry_stock', 'empty', 'expired'
                let cloudStatus = vial.status;
                if (cloudStatus === 'unopened') cloudStatus = 'dry_stock';
                if (cloudStatus === 'activated') cloudStatus = 'active';
                if (cloudStatus === 'finished') cloudStatus = 'empty';

                // Use nullish coalescing (??) for numeric fields where 0 is a valid value
                const vialData = {
                    concentrationMgMl: vial.concentration_mg_ml ?? vial.concentrationMgMl,
                    volumeMl: vial.volume_ml ?? vial.volumeMl,
                    remainingMl: vial.remaining_ml ?? vial.remainingMl ?? vial.volume_ml ?? vial.volumeMl,
                    lotNumber: vial.lot_number || vial.lotNumber || '',
                    expiryDate: vial.expiry_date || vial.expiryDate,
                    openedDate: vial.opened_date || vial.openedDate || null,
                    status: cloudStatus,
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

    /**
     * Audit local data to find records with missing fields
     * Returns a report of which records need manual correction
     */
    auditLocalData(app) {
        const issues = {
            trtInjections: [],
            trtVials: [],
            retaInjections: [],
            retaVials: [],
            weights: []
        };

        // Check TRT Injections
        const trtInjections = app.data.trtInjections || [];
        for (const inj of trtInjections) {
            const missing = [];
            if (!inj.injection_site && !inj.skipped) missing.push('injection_site');
            if (!inj.volume_ml && inj.volume_ml !== 0 && !inj.skipped) missing.push('volume_ml');
            if (!inj.concentration_mg_ml && !inj.skipped) missing.push('concentration_mg_ml');
            if (!inj.vial_id && !inj.skipped) missing.push('vial_id');

            if (missing.length > 0) {
                issues.trtInjections.push({
                    id: inj.id,
                    timestamp: inj.timestamp,
                    date: new Date(inj.timestamp).toLocaleDateString(),
                    missing: missing
                });
            }
        }

        // Check TRT Vials
        const trtVials = app.data.trtVials || [];
        for (const vial of trtVials) {
            const missing = [];
            if (!vial.concentration_mg_ml) missing.push('concentration_mg_ml');
            if (!vial.volume_ml) missing.push('volume_ml');
            if (!vial.expiry_date) missing.push('expiry_date');

            if (missing.length > 0) {
                issues.trtVials.push({
                    id: vial.id,
                    status: vial.status,
                    missing: missing
                });
            }
        }

        // Check Reta Injections
        const retaInjections = app.data.injections || [];
        for (const inj of retaInjections) {
            const missing = [];
            if (!inj.injection_site && !inj.skipped) missing.push('injection_site');
            if (!inj.dose_mg && inj.dose_mg !== 0 && !inj.skipped) missing.push('dose_mg');
            if (!inj.vial_id && !inj.skipped) missing.push('vial_id');

            if (missing.length > 0) {
                issues.retaInjections.push({
                    id: inj.id,
                    timestamp: inj.timestamp,
                    date: new Date(inj.timestamp).toLocaleDateString(),
                    missing: missing
                });
            }
        }

        // Check Reta Vials
        const retaVials = app.data.vials || [];
        for (const vial of retaVials) {
            const missing = [];
            if (!vial.order_date) missing.push('order_date');
            if (!vial.total_mg) missing.push('total_mg');

            if (missing.length > 0) {
                issues.retaVials.push({
                    id: vial.id || vial.vial_id,
                    missing: missing
                });
            }
        }

        // Check Weights
        const weights = app.data.weights || [];
        for (const w of weights) {
            const missing = [];
            if (!w.weight_kg && w.weight_kg !== 0) missing.push('weight_kg');
            if (!w.timestamp) missing.push('timestamp');

            if (missing.length > 0) {
                issues.weights.push({
                    id: w.id,
                    timestamp: w.timestamp,
                    missing: missing
                });
            }
        }

        return issues;
    }

    /**
     * Try to infer missing vial_id for TRT injections based on:
     * 1. Concentration matching
     * 2. Timeline (which vial was active at injection time)
     * 3. Surrounding injections
     */
    inferMissingVialIds(app) {
        const trtInjections = app.data.trtInjections || [];
        const trtVials = app.data.trtVials || [];

        const fixes = [];

        for (const inj of trtInjections) {
            // Skip if already has vial_id or is skipped
            if (inj.vial_id || inj.skipped) continue;

            const injDate = new Date(inj.timestamp);
            let bestMatch = null;
            let matchReason = '';

            // Strategy 1: Match by concentration
            if (inj.concentration_mg_ml) {
                const concentrationMatches = trtVials.filter(v =>
                    v.concentration_mg_ml === inj.concentration_mg_ml
                );

                if (concentrationMatches.length === 1) {
                    bestMatch = concentrationMatches[0];
                    matchReason = 'concentration match (unique)';
                } else if (concentrationMatches.length > 1) {
                    // Multiple vials with same concentration - use timeline
                    const activeAtTime = concentrationMatches.filter(v => {
                        if (!v.opened_date) return false;
                        const openedDate = new Date(v.opened_date);
                        return openedDate <= injDate;
                    }).sort((a, b) => new Date(b.opened_date) - new Date(a.opened_date));

                    if (activeAtTime.length > 0) {
                        bestMatch = activeAtTime[0]; // Most recently opened before injection
                        matchReason = 'concentration + most recently opened';
                    }
                }
            }

            // Strategy 2: Look at surrounding injections
            if (!bestMatch) {
                const sortedInjs = [...trtInjections]
                    .filter(i => i.vial_id && !i.skipped)
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // Find injections just before and after
                let before = null, after = null;
                for (const i of sortedInjs) {
                    if (new Date(i.timestamp) < injDate) {
                        before = i;
                    } else if (new Date(i.timestamp) > injDate && !after) {
                        after = i;
                        break;
                    }
                }

                // If before and after use same vial, likely this one does too
                if (before && after && before.vial_id === after.vial_id) {
                    const vial = trtVials.find(v => v.id === before.vial_id);
                    if (vial) {
                        bestMatch = vial;
                        matchReason = 'surrounding injections use same vial';
                    }
                } else if (before) {
                    // Use the vial from the previous injection
                    const vial = trtVials.find(v => v.id === before.vial_id);
                    if (vial) {
                        bestMatch = vial;
                        matchReason = 'previous injection vial';
                    }
                }
            }

            // Strategy 3: Find any vial that was active at the time
            if (!bestMatch) {
                const activeAtTime = trtVials.filter(v => {
                    if (!v.opened_date) return false;
                    const openedDate = new Date(v.opened_date);
                    return openedDate <= injDate &&
                           (v.status === 'active' || v.status === 'empty' || v.status === 'finished');
                }).sort((a, b) => new Date(b.opened_date) - new Date(a.opened_date));

                if (activeAtTime.length === 1) {
                    bestMatch = activeAtTime[0];
                    matchReason = 'only vial active at time';
                } else if (activeAtTime.length > 1) {
                    bestMatch = activeAtTime[0];
                    matchReason = 'most recently opened (multiple candidates)';
                }
            }

            if (bestMatch) {
                fixes.push({
                    injection: inj,
                    suggestedVial: bestMatch,
                    reason: matchReason,
                    injectionDate: injDate.toLocaleDateString(),
                    vialInfo: `${bestMatch.concentration_mg_ml}mg/ml, opened ${bestMatch.opened_date ? new Date(bestMatch.opened_date).toLocaleDateString() : 'N/A'}`
                });
            }
        }

        return fixes;
    }

    /**
     * Apply vial fixes to injections
     */
    applyVialFixes(app, fixes) {
        let applied = 0;

        for (const fix of fixes) {
            const inj = app.data.trtInjections.find(i => i.id === fix.injection.id);
            if (inj && !inj.vial_id) {
                inj.vial_id = fix.suggestedVial.id;

                // Also fill in concentration if missing
                if (!inj.concentration_mg_ml && fix.suggestedVial.concentration_mg_ml) {
                    inj.concentration_mg_ml = fix.suggestedVial.concentration_mg_ml;
                }

                // Recalculate dose if we have volume and concentration
                if (inj.volume_ml && inj.concentration_mg_ml && !inj.dose_mg) {
                    inj.dose_mg = inj.volume_ml * inj.concentration_mg_ml;
                }

                applied++;
            }
        }

        if (applied > 0) {
            app.saveData();
        }

        return applied;
    }

    /**
     * Repair cloud data by re-pushing all local data with correct field mappings
     * Use this after fixing sync bugs to reconcile local and cloud data
     * Local data is treated as the source of truth
     */
    async repairCloudData(app) {
        // Use global apiClient since initialize() may not have been called
        const api = this.apiClient || (typeof apiClient !== 'undefined' ? apiClient : null);
        const auth = this.authManager || (typeof authManager !== 'undefined' ? authManager : null);

        if (!auth || !auth.isAuthenticated()) {
            throw new Error('Not authenticated');
        }

        if (!api) {
            throw new Error('API client not available');
        }

        console.log('=== Starting Cloud Data Repair ===');
        const results = {
            trtInjections: { success: 0, failed: 0 },
            trtVials: { success: 0, failed: 0 },
            retaInjections: { success: 0, failed: 0 },
            retaVials: { success: 0, failed: 0 },
            weights: { success: 0, failed: 0 }
        };

        // 1. Repair TRT Injections
        console.log('Repairing TRT injections...');
        const trtInjections = app.data.trtInjections || [];
        for (const injection of trtInjections) {
            try {
                // Convert snake_case to camelCase for cloud API
                const cloudInjection = {
                    id: injection.id,
                    timestamp: injection.timestamp,
                    volumeMl: injection.volume_ml || 0,
                    concentrationMgMl: injection.concentration_mg_ml || 0,
                    doseMg: injection.dose_mg || 0,
                    injectionSite: injection.injection_site,
                    timeOfDay: injection.time_of_day || null,
                    techniqueNotes: injection.technique_notes || '',
                    notes: injection.notes || '',
                    vialId: injection.vial_id || null,
                    skipped: injection.skipped || false,
                    plannedVolumeMl: injection.planned_volume_ml || null,
                    plannedDoseMg: injection.planned_dose_mg || null
                };
                await api.createTrtInjection(cloudInjection);
                results.trtInjections.success++;
            } catch (error) {
                console.warn(`Failed to repair TRT injection ${injection.id}:`, error.message);
                results.trtInjections.failed++;
            }
        }

        // 2. Repair TRT Vials
        console.log('Repairing TRT vials...');
        const trtVials = app.data.trtVials || [];
        for (const vial of trtVials) {
            try {
                // Convert status to cloud-compatible
                let cloudStatus = vial.status;
                if (cloudStatus === 'unopened') cloudStatus = 'dry_stock';
                if (cloudStatus === 'activated') cloudStatus = 'active';
                if (cloudStatus === 'finished') cloudStatus = 'empty';

                const cloudVial = {
                    id: vial.id,
                    concentrationMgMl: vial.concentration_mg_ml,
                    volumeMl: vial.volume_ml,
                    remainingMl: vial.remaining_ml,
                    lotNumber: vial.lot_number || '',
                    expiryDate: vial.expiry_date,
                    openedDate: vial.opened_date || null,
                    status: cloudStatus,
                    notes: vial.notes || ''
                };
                await api.createTrtVial(cloudVial);
                results.trtVials.success++;
            } catch (error) {
                console.warn(`Failed to repair TRT vial ${vial.id}:`, error.message);
                results.trtVials.failed++;
            }
        }

        // 3. Repair Reta Injections (via sync queue processor)
        console.log('Repairing Reta injections...');
        const retaInjections = app.data.injections || [];
        for (const injection of retaInjections) {
            try {
                const cloudInjection = {
                    id: injection.id,
                    timestamp: injection.timestamp,
                    doseMg: injection.dose_mg,
                    site: injection.injection_site,
                    vialId: injection.vial_id,
                    notes: injection.notes || '',
                    skipped: injection.skipped || false,
                    plannedDoseMg: injection.planned_dose_mg || null
                };
                await api.createInjection(cloudInjection);
                results.retaInjections.success++;
            } catch (error) {
                console.warn(`Failed to repair Reta injection ${injection.id}:`, error.message);
                results.retaInjections.failed++;
            }
        }

        // 4. Repair Reta Vials
        console.log('Repairing Reta vials...');
        const retaVials = app.data.vials || [];
        for (const vial of retaVials) {
            try {
                const vialId = vial.id || vial.vial_id;
                const cloudVial = {
                    id: vialId,
                    orderDate: vial.order_date,
                    totalMg: vial.total_mg,
                    supplier: vial.supplier || '',
                    status: vial.status || 'active',
                    reconstitutionDate: vial.reconstitution_date || null,
                    expirationDate: vial.expiration_date || null,
                    bacWaterMl: vial.bac_water_ml || null,
                    concentrationMgMl: vial.concentration_mg_ml || null,
                    currentVolumeMl: vial.remaining_ml || 0,
                    remainingMl: vial.remaining_ml || 0,
                    usedVolumeMl: (vial.bac_water_ml || 0) - (vial.remaining_ml || 0),
                    dosesUsed: vial.doses_used || 0,
                    lotNumber: vial.lot_number || '',
                    notes: vial.notes || ''
                };
                await api.createVial(cloudVial);
                results.retaVials.success++;
            } catch (error) {
                console.warn(`Failed to repair Reta vial ${vial.id || vial.vial_id}:`, error.message);
                results.retaVials.failed++;
            }
        }

        // 5. Repair Weights
        console.log('Repairing weight entries...');
        const weights = app.data.weights || [];
        for (const weight of weights) {
            try {
                const cloudWeight = {
                    id: weight.id,
                    timestamp: weight.timestamp,
                    weightKg: weight.weight_kg,
                    notes: weight.notes || ''
                };
                await api.createWeight(cloudWeight);
                results.weights.success++;
            } catch (error) {
                console.warn(`Failed to repair weight ${weight.id}:`, error.message);
                results.weights.failed++;
            }
        }

        console.log('=== Cloud Data Repair Complete ===');
        console.log('Results:', JSON.stringify(results, null, 2));

        return results;
    }
}

// Export singleton instance
const cloudStorage = new CloudStorage();
