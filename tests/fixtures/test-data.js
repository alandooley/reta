/**
 * Test Fixtures - Predefined Test Datasets
 *
 * Common test data scenarios that can be reused across tests.
 */

const { TestDataBuilder } = require('../helpers/test-data-builder');

// ============================================
// CONSTANTS
// ============================================

/**
 * Valid injection sites for Reta
 */
const INJECTION_SITES = [
    'left_thigh',
    'right_thigh',
    'abdomen_left',
    'abdomen_right',
    'left_arm',
    'right_arm',
    'left_glute',
    'right_glute'
];

/**
 * Valid TRT injection sites
 */
const TRT_INJECTION_SITES = [
    'left_front_thigh',
    'right_front_thigh'
];

/**
 * Valid vial statuses
 */
const VIAL_STATUSES = ['dry_stock', 'active', 'insufficient', 'empty', 'expired'];

/**
 * Sync operation statuses
 */
const SYNC_STATUSES = ['pending', 'syncing', 'synced', 'failed'];

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a valid Reta vial object
 */
function createValidVial(overrides = {}) {
    const today = new Date().toISOString().split('T')[0];
    return {
        vial_id: `test-vial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        order_date: today,
        supplier: 'Test Supplier',
        total_mg: 10,
        status: 'active',
        bac_water_ml: 1,
        concentration_mg_ml: 10,
        current_volume_ml: 1,
        remaining_ml: 1,
        used_volume_ml: 0,
        doses_used: 0,
        reconstitution_date: today,
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lot_number: '',
        notes: '',
        ...overrides
    };
}

/**
 * Create a dry stock vial
 */
function createDryStockVial(overrides = {}) {
    const today = new Date().toISOString().split('T')[0];
    return {
        vial_id: `test-vial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        order_date: today,
        supplier: 'Test Supplier',
        total_mg: 10,
        status: 'dry_stock',
        bac_water_ml: null,
        concentration_mg_ml: null,
        current_volume_ml: 0,
        remaining_ml: 0,
        reconstitution_date: null,
        expiration_date: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ...overrides
    };
}

/**
 * Create a valid Reta injection object
 */
function createValidInjection(overrides = {}) {
    return {
        id: `test-inj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        dose_mg: 2.5,
        injection_site: 'abdomen_left',
        vial_id: overrides.vial_id || 'test-vial-1',
        notes: '',
        skipped: false,
        ...overrides
    };
}

/**
 * Create a skipped injection
 */
function createSkippedInjection(overrides = {}) {
    return {
        id: `test-skip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        dose_mg: 0,
        injection_site: null,
        vial_id: null,
        notes: 'Skipped',
        skipped: true,
        planned_dose_mg: overrides.planned_dose_mg || 2.5,
        ...overrides
    };
}

/**
 * Create a valid weight object
 */
function createValidWeight(overrides = {}) {
    return {
        id: `test-weight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        weight_kg: 85.0,
        body_fat_percentage: null,
        notes: '',
        ...overrides
    };
}

/**
 * Create settings object
 */
function createSettings(overrides = {}) {
    return {
        defaultDose: 2.0,
        injectionFrequency: 7,
        heightCm: 175,
        goalWeightKg: 80,
        injectionDay: 'Monday',
        prefillDoseFrom: 'last',
        ...overrides
    };
}

/**
 * Create TRT vial object
 */
function createTrtVial(overrides = {}) {
    return {
        id: `trt-vial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        concentration_mg_ml: 200,
        volume_ml: 10,
        remaining_ml: overrides.remaining_ml !== undefined ? overrides.remaining_ml : 10,
        status: 'active',
        lot_number: '',
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        opened_date: new Date().toISOString(),
        notes: '',
        ...overrides
    };
}

/**
 * Create TRT injection object
 */
function createTrtInjection(overrides = {}) {
    const volumeMl = overrides.volume_ml || 0.5;
    const concentrationMgMl = overrides.concentration_mg_ml || 200;
    return {
        id: `trt-inj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        dose_mg: overrides.dose_mg || (volumeMl * concentrationMgMl),
        volume_ml: volumeMl,
        concentration_mg_ml: concentrationMgMl,
        vial_id: overrides.vial_id || 'trt-vial-1',
        injection_site: 'left_front_thigh',
        time_of_day: 'morning',
        technique_notes: '',
        skipped: false,
        notes: '',
        ...overrides
    };
}

/**
 * Empty dataset (fresh start)
 */
const emptyData = {
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

/**
 * Single dry stock vial (most basic scenario)
 */
const singleDryVial = new TestDataBuilder()
    .withDryVial()
    .build();

/**
 * Single active vial (ready for injections)
 */
const singleActiveVial = new TestDataBuilder()
    .withActiveVial()
    .build();

/**
 * Active vial with one injection
 */
const vialWithOneInjection = new TestDataBuilder()
    .withActiveVial()
    .withInjection(0, { dose_mg: 2.5 })
    .build();

/**
 * Active vial with multiple injections
 */
const vialWithMultipleInjections = new TestDataBuilder()
    .withActiveVial({ total_mg: 10, bac_water_ml: 1 })
    .withInjection(0, { dose_mg: 2.0 })
    .withInjection(0, { dose_mg: 2.5 })
    .withInjection(0, { dose_mg: 3.0 })
    .build();

/**
 * Nearly empty vial (testing insufficient volume)
 */
const nearlyEmptyVial = new TestDataBuilder()
    .withActiveVial({
        total_mg: 10,
        bac_water_ml: 1,
        current_volume_ml: 0.1,
        remaining_ml: 0.1,
        used_volume_ml: 0.9
    })
    .build();

/**
 * Empty vial (used up)
 */
const emptyVial = new TestDataBuilder()
    .withEmptyVial()
    .build();

/**
 * Multiple vials in different states
 */
const multipleVials = new TestDataBuilder()
    .withEmptyVial({ order_date: '2024-08-01' })
    .withEmptyVial({ order_date: '2024-08-01' })
    .withActiveVial({ order_date: '2024-10-01', current_volume_ml: 0.2 })
    .withDryVial({ order_date: '2024-10-01' })
    .withDryVial({ order_date: '2024-10-01' })
    .build();

/**
 * Weight loss journey scenario (realistic progression)
 * Starting weight: 95kg, tracking weekly progress with injections
 */
const weightLossJourney = new TestDataBuilder()
    .withActiveVial({ total_mg: 10, bac_water_ml: 1, order_date: '2024-09-01' })
    .withWeight({ weightKg: 95.0, daysAgo: 56 })  // Week 0
    .withInjection(0, { dose_mg: 2.0, daysAgo: 56 })
    .withWeight({ weightKg: 94.2, daysAgo: 49 })  // Week 1
    .withInjection(0, { dose_mg: 2.0, daysAgo: 49 })
    .withWeight({ weightKg: 93.5, daysAgo: 42 })  // Week 2
    .withInjection(0, { dose_mg: 2.5, daysAgo: 42 })
    .withWeight({ weightKg: 92.8, daysAgo: 35 })  // Week 3
    .withInjection(0, { dose_mg: 2.5, daysAgo: 35 })
    .withWeight({ weightKg: 92.0, daysAgo: 28 })  // Week 4
    .withInjection(0, { dose_mg: 3.0, daysAgo: 28 })
    .withWeight({ weightKg: 91.0, daysAgo: 21 })  // Week 5
    .withInjection(0, { dose_mg: 3.0, daysAgo: 21 })
    .withWeight({ weightKg: 90.2, daysAgo: 14 })  // Week 6
    .withInjection(0, { dose_mg: 3.0, daysAgo: 14 })
    .withWeight({ weightKg: 89.5, daysAgo: 7 })   // Week 7
    .withInjection(0, { dose_mg: 3.0, daysAgo: 7 })
    .withWeight({ weightKg: 88.8, daysAgo: 0 })   // Week 8
    .build();

/**
 * Complete scenario with multiple vials in rotation
 * Simulates real-world usage with vial transition
 */
const completeScenario = new TestDataBuilder()
    .withEmptyVial({ order_date: '2024-06-01', total_mg: 10 })  // First vial used up
    .withActiveVial({ order_date: '2024-08-15', total_mg: 10, current_volume_ml: 0.4 })  // Current vial
    .withDryVial({ order_date: '2024-10-01', total_mg: 10 })  // Backup vial
    .withInjection(1, { dose_mg: 2.5, daysAgo: 7 })
    .withInjection(1, { dose_mg: 2.5, daysAgo: 14 })
    .withInjection(1, { dose_mg: 2.5, daysAgo: 21 })
    .withWeight({ weightKg: 92.5, daysAgo: 28 })
    .withWeight({ weightKg: 91.8, daysAgo: 21 })
    .withWeight({ weightKg: 91.0, daysAgo: 14 })
    .withWeight({ weightKg: 90.3, daysAgo: 7 })
    .withWeight({ weightKg: 89.7, daysAgo: 0 })
    .build();

/**
 * Creates large dataset for performance testing
 * @param {number} vialCount - Number of vials to create
 * @param {number} injectionsPerVial - Injections per active vial
 * @param {number} weightCount - Number of weight entries
 * @returns {Object} Large test dataset
 */
function createLargeDataset(vialCount = 100, injectionsPerVial = 50, weightCount = 200) {
    const builder = new TestDataBuilder();

    // Create mix of vials (30% dry, 50% active, 20% empty)
    for (let i = 0; i < vialCount; i++) {
        const rand = Math.random();
        if (rand < 0.3) {
            builder.withDryVial({ order_date: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-01` });
        } else if (rand < 0.8) {
            builder.withActiveVial({
                total_mg: 10,
                bac_water_ml: 1,
                order_date: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-01`
            });
        } else {
            builder.withEmptyVial({ order_date: `2024-${String(Math.floor(Math.random() * 6) + 1).padStart(2, '0')}-01` });
        }
    }

    // Add injections to active vials
    const activeVialCount = Math.floor(vialCount * 0.5);
    for (let vialIdx = 0; vialIdx < activeVialCount; vialIdx++) {
        for (let injIdx = 0; injIdx < injectionsPerVial; injIdx++) {
            builder.withInjection(vialIdx, {
                dose_mg: 2.0 + Math.random() * 2,  // 2.0-4.0mg doses
                daysAgo: injIdx * 7  // Weekly injections
            });
        }
    }

    // Add weight entries
    let currentWeight = 95.0;
    for (let i = 0; i < weightCount; i++) {
        currentWeight -= (Math.random() * 0.5);  // Gradual weight loss
        builder.withWeight({
            weightKg: Math.max(70, currentWeight),  // Don't go below 70kg
            daysAgo: i * 2  // Every 2 days
        });
    }

    return builder.build();
}

/**
 * Corrupt data scenarios (for validation/error handling tests)
 */
const corruptData = {
    vials: [
        { vial_id: 'test-corrupt-1', total_mg: null, status: 'active' },  // Null total_mg
        { vial_id: 'test-corrupt-2', total_mg: -5, bac_water_ml: 1 },  // Negative value
        { vial_id: 'test-corrupt-3', total_mg: 10, bac_water_ml: 0 },  // Division by zero
        { vial_id: 'test-corrupt-4', total_mg: 'ten', bac_water_ml: 1 },  // Wrong type
        { vial_id: 'test-corrupt-5' },  // Missing required fields
    ],
    injections: [
        { id: 'test-corrupt-inj-1', dose_mg: null, vial_id: 'test-vial-1' },
        { id: 'test-corrupt-inj-2', dose_mg: -2.5, vial_id: 'test-vial-1' },
        { id: 'test-corrupt-inj-3', dose_mg: 2.5 },  // Missing vial_id
        { id: 'test-corrupt-inj-4', vial_id: 'nonexistent-vial', dose_mg: 2.0 },  // Invalid vial reference
    ],
    weights: [
        { id: 'test-corrupt-weight-1', weightKg: null, date: '2024-01-01' },
        { id: 'test-corrupt-weight-2', weightKg: -80, date: '2024-01-01' },
        { id: 'test-corrupt-weight-3', weightKg: 'eighty', date: '2024-01-01' },
    ],
    settings: {
        defaultDose: null,  // Should have default fallback
        injectionFrequency: -7,  // Invalid negative
        heightCm: 'tall',  // Wrong type
    }
};

/**
 * Unicode and special character data
 */
const unicodeData = new TestDataBuilder()
    .withActiveVial({
        supplier: 'Тест Supplier 中文 🧪',  // Cyrillic, Chinese, emoji
        lot_number: 'LOT#123-ABC/2024',
        notes: 'Special chars: <>&"\' and emoji 💉💊'
    })
    .withInjection(0, {
        dose_mg: 2.5,
        notes: 'Note with émojis: ✓ ✗ → ← ↑ ↓ and symbols: €£¥'
    })
    .build();

/**
 * Very long strings (boundary testing)
 */
const longStringData = new TestDataBuilder()
    .withActiveVial({
        supplier: 'A'.repeat(1000),  // 1KB string
        lot_number: 'B'.repeat(500),
        notes: 'C'.repeat(5000)  // 5KB note
    })
    .withInjection(0, {
        dose_mg: 2.5,
        notes: 'D'.repeat(10000)  // 10KB note
    })
    .build();

/**
 * Sync queue scenarios
 */
const pendingSyncQueue = {
    vials: [new TestDataBuilder().withActiveVial().build().vials[0]],
    injections: [],
    weights: [],
    settings: emptyData.settings,
    syncQueue: [
        {
            id: 'sync-1',
            operation: 'CREATE',
            entity: 'vial',
            data: { vial_id: 'test-vial-pending', total_mg: 10 },
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending'
        },
        {
            id: 'sync-2',
            operation: 'UPDATE',
            entity: 'injection',
            data: { id: 'test-injection-1', dose_mg: 3.0 },
            timestamp: Date.now() - 5000,
            retryCount: 0,
            status: 'pending'
        }
    ]
};

const failedSyncQueue = {
    vials: [],
    injections: [],
    weights: [],
    settings: emptyData.settings,
    syncQueue: [
        {
            id: 'sync-failed-1',
            operation: 'CREATE',
            entity: 'vial',
            data: { vial_id: 'test-vial-failed', total_mg: 10 },
            timestamp: Date.now() - 60000,  // 1 minute ago
            retryCount: 5,  // Max retries reached
            status: 'failed',
            lastError: 'Network timeout',
            nextRetry: null  // No more retries
        }
    ]
};

module.exports = {
    // Constants
    INJECTION_SITES,
    TRT_INJECTION_SITES,
    VIAL_STATUSES,
    SYNC_STATUSES,

    // Factory functions
    createValidVial,
    createDryStockVial,
    createValidInjection,
    createSkippedInjection,
    createValidWeight,
    createSettings,
    createTrtVial,
    createTrtInjection,

    // Basic scenarios
    emptyData,
    singleDryVial,
    singleActiveVial,
    vialWithOneInjection,
    vialWithMultipleInjections,
    nearlyEmptyVial,
    emptyVial,
    multipleVials,

    // Complex scenarios
    weightLossJourney,
    completeScenario,

    // Performance testing
    createLargeDataset,

    // Edge cases
    corruptData,
    unicodeData,
    longStringData,

    // Sync scenarios
    pendingSyncQueue,
    failedSyncQueue
};
