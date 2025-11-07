/**
 * Test Data Factory
 * Generates consistent, valid test data for all entities
 */

/**
 * Generate a unique ID for test data
 */
function generateId() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate ISO timestamp (current or with offset)
 * @param {number} daysOffset - Days to offset from now (negative for past)
 */
function generateTimestamp(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

/**
 * Generate ISO date (YYYY-MM-DD format)
 * @param {number} daysOffset - Days to offset from now (negative for past)
 */
function generateDate(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

/**
 * Valid injection site values
 */
const INJECTION_SITES = [
  'left_thigh',
  'right_thigh',
  'left_abdomen',
  'right_abdomen',
  'left_arm',
  'right_arm'
];

/**
 * Valid vial status values
 */
const VIAL_STATUSES = ['dry_stock', 'active', 'activated', 'insufficient', 'empty', 'expired'];

/**
 * Valid sync status values
 */
const SYNC_STATUSES = ['pending', 'synced', 'failed', 'syncing'];

/**
 * Create a valid injection record
 * @param {Object} overrides - Properties to override
 * @returns {Object} Injection object
 */
function createValidInjection(overrides = {}) {
  return {
    id: generateId(),
    timestamp: generateTimestamp(-1), // yesterday
    dose_mg: 0.5,
    injection_site: 'left_thigh',
    vial_id: null, // Should be set to actual vial ID
    weight_kg: null,
    weight_source: null,
    notes: '',
    medication_level_at_injection: 0,
    sync_status: 'pending',
    ...overrides
  };
}

/**
 * Create a valid vial record
 * @param {Object} overrides - Properties to override
 * @returns {Object} Vial object
 */
function createValidVial(overrides = {}) {
  const totalMg = overrides.total_mg || 10;
  const bacWaterMl = overrides.bac_water_ml || 1.0;

  return {
    vial_id: generateId(),
    order_date: generateDate(-30), // ordered 30 days ago
    supplier: 'Test Supplier',
    lot_number: `LOT-${Date.now()}`,
    total_mg: totalMg,
    bac_water_ml: bacWaterMl,
    concentration_mg_ml: totalMg / bacWaterMl, // auto-calculated
    reconstitution_date: generateTimestamp(-7), // reconstituted 7 days ago
    expiration_date: generateTimestamp(23), // expires in 23 days (30 days from reconstitution)
    remaining_ml: bacWaterMl,
    current_volume_ml: bacWaterMl, // Phase 1A: both properties
    doses_used: 0,
    status: 'active',
    sync_status: 'pending',
    ...overrides
  };
}

/**
 * Create a dry stock vial (not yet reconstituted)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Vial object
 */
function createDryStockVial(overrides = {}) {
  return {
    vial_id: generateId(),
    order_date: generateDate(-10), // ordered 10 days ago
    supplier: 'Test Supplier',
    lot_number: `LOT-${Date.now()}`,
    total_mg: 10,
    bac_water_ml: null,
    concentration_mg_ml: null,
    reconstitution_date: null,
    expiration_date: null,
    remaining_ml: null,
    current_volume_ml: null,
    doses_used: 0,
    status: 'dry_stock',
    sync_status: 'pending',
    ...overrides
  };
}

/**
 * Create a valid weight record
 * @param {Object} overrides - Properties to override
 * @returns {Object} Weight object
 */
function createValidWeight(overrides = {}) {
  const weightKg = overrides.weight_kg || 80.0;

  return {
    id: generateId(),
    timestamp: generateTimestamp(-1), // yesterday
    weight_kg: weightKg,
    weight_lbs: weightKg * 2.20462, // auto-calculated
    source: 'manual',
    bmi: null, // calculated if height set
    body_fat_percentage: null,
    sync_status: 'pending',
    ...overrides
  };
}

/**
 * Create settings object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Settings object
 */
function createSettings(overrides = {}) {
  return {
    heightCm: 175,
    goalWeightKg: 75.0,
    units: 'metric',
    theme: 'dark',
    notifications_enabled: true,
    ...overrides
  };
}

/**
 * Create a complete test dataset with related records
 * @param {Object} options - Configuration options
 * @returns {Object} Complete dataset
 */
function createTestDataset(options = {}) {
  const {
    numVials = 2,
    numInjections = 5,
    numWeights = 10,
    includeSettings = true
  } = options;

  // Create vials first
  const vials = [];
  for (let i = 0; i < numVials; i++) {
    vials.push(createValidVial({
      order_date: generateDate(-30 - i),
      total_mg: 10 + (i * 5), // varying doses
      remaining_ml: 1.0 - (i * 0.1) // varying remaining amounts
    }));
  }

  // Create injections referencing the vials
  const injections = [];
  for (let i = 0; i < numInjections; i++) {
    const vialIndex = i % vials.length; // rotate through vials
    injections.push(createValidInjection({
      timestamp: generateTimestamp(-numInjections + i), // spread over time
      dose_mg: 0.5 + (i * 0.1), // increasing doses
      vial_id: vials[vialIndex].vial_id,
      injection_site: INJECTION_SITES[i % INJECTION_SITES.length]
    }));
  }

  // Create weights
  const weights = [];
  const startWeight = 90.0;
  for (let i = 0; i < numWeights; i++) {
    weights.push(createValidWeight({
      timestamp: generateTimestamp(-numWeights + i),
      weight_kg: startWeight - (i * 0.5) // gradual weight loss
    }));
  }

  const dataset = {
    vials,
    injections,
    weights
  };

  if (includeSettings) {
    dataset.settings = createSettings();
  }

  return dataset;
}

/**
 * Create edge case scenarios for testing
 */
const edgeCases = {
  // Empty dataset
  empty: {
    injections: [],
    vials: [],
    weights: [],
    settings: null
  },

  // Single records
  single: {
    injections: [createValidInjection()],
    vials: [createValidVial()],
    weights: [createValidWeight()],
    settings: createSettings()
  },

  // Vial with no remaining volume
  emptyVial: createValidVial({
    remaining_ml: 0,
    current_volume_ml: 0,
    status: 'empty'
  }),

  // Vial with insufficient volume for standard dose
  insufficientVial: createValidVial({
    remaining_ml: 0.05,
    current_volume_ml: 0.05,
    status: 'insufficient'
  }),

  // Expired vial
  expiredVial: createValidVial({
    reconstitution_date: generateTimestamp(-35), // 35 days ago
    expiration_date: generateTimestamp(-5), // expired 5 days ago
    status: 'expired'
  }),

  // Future-dated injection (invalid)
  futureInjection: createValidInjection({
    timestamp: generateTimestamp(1) // tomorrow
  }),

  // Invalid dose (too high)
  highDoseInjection: createValidInjection({
    dose_mg: 100.0 // exceeds max 50mg
  }),

  // Invalid dose (negative)
  negativeDoseInjection: createValidInjection({
    dose_mg: -0.5
  }),

  // Injection with invalid site
  invalidSiteInjection: {
    ...createValidInjection(),
    injection_site: 'invalid_site'
  },

  // Weight with invalid value (too low)
  lowWeight: createValidWeight({
    weight_kg: 10.0 // unrealistically low
  }),

  // Weight with invalid value (too high)
  highWeight: createValidWeight({
    weight_kg: 500.0 // unrealistically high
  }),

  // Duplicate injections (same timestamp, dose, site)
  duplicateInjections: [
    createValidInjection({
      id: 'dup-1',
      timestamp: '2025-11-07T10:00:00Z',
      dose_mg: 0.5,
      injection_site: 'left_thigh'
    }),
    createValidInjection({
      id: 'dup-2',
      timestamp: '2025-11-07T10:00:00Z',
      dose_mg: 0.5,
      injection_site: 'left_thigh'
    })
  ]
};

// Export all factories and constants
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateId,
    generateTimestamp,
    generateDate,
    INJECTION_SITES,
    VIAL_STATUSES,
    SYNC_STATUSES,
    createValidInjection,
    createValidVial,
    createDryStockVial,
    createValidWeight,
    createSettings,
    createTestDataset,
    edgeCases
  };
}
