/**
 * Test Data Builder
 *
 * Fluent API for creating test data with sensible defaults.
 * Uses relative dates and randomized IDs to prevent conflicts.
 *
 * Usage:
 *   const data = new TestDataBuilder()
 *     .withActiveVial()
 *     .withInjection(0, { dose_mg: 2.5 })
 *     .withWeight({ weight_kg: 95.5 })
 *     .build();
 */

class TestDataBuilder {
    constructor() {
        this.data = {
            vials: [],
            injections: [],
            weights: [],
            settings: {
                defaultDose: 2.0,
                injectionFrequency: 7,
                heightCm: 175,
                goalWeightKg: 80,
                injectionDay: 'Monday'
            }
        };
    }

    /**
     * Add a dry_stock vial
     */
    withDryVial(params = {}) {
        const today = new Date().toISOString().split('T')[0];
        const vial = {
            vial_id: params.vial_id || `test-vial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            order_date: params.order_date || today,
            supplier: params.supplier || 'Test Supplier',
            total_mg: params.total_mg !== undefined ? params.total_mg : 10,
            status: 'dry_stock',
            bac_water_ml: null,
            concentration_mg_ml: null,
            reconstitution_date: null,
            expiration_date: params.expiration_date || this._addDays(today, 730), // 2 years
            current_volume_ml: 0,
            remaining_ml: 0,
            used_volume_ml: 0,
            doses_used: 0,
            lot_number: params.lot_number || '',
            notes: params.notes || '',
            ...params
        };
        this.data.vials.push(vial);
        return this;
    }

    /**
     * Add an active vial (already reconstituted)
     */
    withActiveVial(params = {}) {
        const today = new Date().toISOString().split('T')[0];
        const totalMg = params.total_mg !== undefined ? params.total_mg : 10;
        const bacWater = params.bac_water_ml !== undefined ? params.bac_water_ml : 1;
        const concentration = totalMg / bacWater;

        const vial = {
            vial_id: params.vial_id || `test-vial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            order_date: params.order_date || this._addDays(today, -30),
            reconstitution_date: params.reconstitution_date || this._addDays(today, -7),
            supplier: params.supplier || 'Test Supplier',
            total_mg: totalMg,
            bac_water_ml: bacWater,
            concentration_mg_ml: concentration,
            current_volume_ml: params.current_volume_ml !== undefined ? params.current_volume_ml : bacWater,
            remaining_ml: params.remaining_ml !== undefined ? params.remaining_ml : bacWater,
            used_volume_ml: params.used_volume_ml !== undefined ? params.used_volume_ml : 0,
            doses_used: params.doses_used !== undefined ? params.doses_used : 0,
            status: 'active',
            expiration_date: params.expiration_date || this._addDays(today, 23), // 30 days from recon
            lot_number: params.lot_number || '',
            notes: params.notes || `${totalMg}mg active`,
            ...params
        };
        this.data.vials.push(vial);
        return this;
    }

    /**
     * Add an empty vial
     */
    withEmptyVial(params = {}) {
        return this.withActiveVial({
            current_volume_ml: 0,
            remaining_ml: 0,
            used_volume_ml: params.bac_water_ml || 1,
            status: 'empty',
            ...params
        });
    }

    /**
     * Add an injection linked to a vial by index
     */
    withInjection(vialIndex = 0, params = {}) {
        if (this.data.vials.length === 0) {
            throw new Error('Add a vial first before adding injections');
        }

        const vial = this.data.vials[vialIndex];
        if (!vial) {
            throw new Error(`Vial at index ${vialIndex} does not exist`);
        }

        const doseMg = params.dose_mg !== undefined ? params.dose_mg : 2.5;
        const now = new Date();

        const injection = {
            id: params.id || `test-inj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: params.timestamp || now.toISOString(),
            dose_mg: doseMg,
            injection_site: params.injection_site || 'abdomen',
            vial_id: vial.vial_id,
            notes: params.notes || '',
            medication_level_at_injection: params.medication_level_at_injection || 0,
            ...params
        };

        this.data.injections.push(injection);

        // Update vial volume if it's active
        if (vial.status === 'active' && vial.concentration_mg_ml > 0) {
            const volumeUsed = doseMg / vial.concentration_mg_ml;
            vial.current_volume_ml -= volumeUsed;
            vial.remaining_ml = vial.current_volume_ml;
            vial.used_volume_ml += volumeUsed;
            vial.doses_used++;

            if (vial.current_volume_ml <= 0) {
                vial.status = 'empty';
                vial.current_volume_ml = 0;
                vial.remaining_ml = 0;
            }
        }

        return this;
    }

    /**
     * Add multiple injections to the same vial
     */
    withInjections(vialIndex, count, dosePattern = []) {
        for (let i = 0; i < count; i++) {
            const dose = dosePattern[i] || 2.5;
            this.withInjection(vialIndex, {
                dose_mg: dose,
                timestamp: this._addDays(new Date().toISOString(), -(count - i) * 7)
            });
        }
        return this;
    }

    /**
     * Add a weight entry
     */
    withWeight(params = {}) {
        const now = new Date();
        const weight = {
            id: params.id || `test-weight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: params.date || now.toISOString(),
            weight_kg: params.weight_kg !== undefined ? params.weight_kg : 95.5,
            body_fat_percentage: params.body_fat_percentage || null,
            notes: params.notes || '',
            ...params
        };

        this.data.weights.push(weight);
        return this;
    }

    /**
     * Add multiple weights with a pattern (e.g., weight loss over time)
     */
    withWeights(count, startWeight, endWeight) {
        const step = (endWeight - startWeight) / (count - 1);
        for (let i = 0; i < count; i++) {
            this.withWeight({
                weight_kg: startWeight + (step * i),
                date: this._addDays(new Date().toISOString(), -(count - i) * 7)
            });
        }
        return this;
    }

    /**
     * Update settings
     */
    withSettings(settings = {}) {
        this.data.settings = { ...this.data.settings, ...settings };
        return this;
    }

    /**
     * Build and return the data object
     */
    build() {
        // Sort by date (most recent first)
        this.data.injections.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.data.weights.sort((a, b) => new Date(b.date) - new Date(a.date));
        this.data.vials.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

        return this.data;
    }

    /**
     * Helper to add days to a date string
     */
    _addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestDataBuilder };
}
