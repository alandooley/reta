/**
 * Application Constants and Configuration
 */

/**
 * @typedef {Object} AppConfig
 * @property {string} NAME - Application name
 * @property {string} VERSION - Application version
 * @property {string} STORAGE_KEY - LocalStorage key for data
 * @property {number} HALF_LIFE_HOURS - Medication half-life in hours
 * @property {number} DEFAULT_EXPIRATION_DAYS - Default vial expiration days
 * @property {number} DEFAULT_INJECTION_FREQUENCY - Default injection frequency in days
 * @property {string} DEFAULT_WEIGHT_UNIT - Default weight unit
 * @property {string} DEFAULT_HEIGHT_UNIT - Default height unit
 * @property {Object} CHART_TIME_PERIODS - Chart time period definitions
 */

/**
 * @typedef {Object} InjectionRecord
 * @property {string} id - Unique injection ID
 * @property {string} timestamp - ISO timestamp of injection
 * @property {number} dose_mg - Dose amount in mg
 * @property {string} injection_site - Injection site location
 * @property {string} vial_id - ID of vial used
 * @property {number|null} weight_kg - Weight at injection time
 * @property {string} weight_source - Source of weight data
 * @property {string} notes - Additional notes
 * @property {number} medication_level_at_injection - Medication level before injection
 */

/**
 * @typedef {Object} VialRecord
 * @property {string} vial_id - Unique vial ID
 * @property {string} order_date - ISO date when vial was ordered
 * @property {string} supplier - Supplier name
 * @property {string} lot_number - Lot/batch number
 * @property {number} total_mg - Total medication in vial
 * @property {number} bac_water_ml - Volume of bacteriostatic water
 * @property {number} concentration_mg_ml - Concentration in mg/ml
 * @property {string|null} reconstitution_date - ISO date when vial was reconstituted
 * @property {string} expiration_date - ISO date of expiration
 * @property {number} remaining_ml - Remaining volume in ml
 * @property {number} doses_used - Number of doses used
 * @property {string} status - Vial status (active, empty, insufficient, expired)
 */

/**
 * @typedef {Object} WeightRecord
 * @property {string} timestamp - ISO timestamp of measurement
 * @property {number} weight_kg - Weight in kilograms
 * @property {number} weight_lbs - Weight in pounds
 * @property {string} source - Source of data (manual, scale, api)
 * @property {number|null} bmi - Body Mass Index
 * @property {number|null} body_fat_percentage - Body fat percentage
 */

/**
 * @typedef {Object} ApplicationData
 * @property {Array<VialRecord>} vials - Array of vial records
 * @property {Array<InjectionRecord>} injections - Array of injection records
 * @property {Array<WeightRecord>} weights - Array of weight records
 * @property {Object} settings - User settings
 */

/**
 * @type {AppConfig}
 */
export const APP_CONFIG = {
  NAME: 'Retatrutide Tracker',
  VERSION: '1.1.0',
  STORAGE_KEY: 'retatrutide_data',

  // Medication properties
  HALF_LIFE_HOURS: 165,

  // Vial defaults
  DEFAULT_EXPIRATION_DAYS: 28,
  DEFAULT_INJECTION_FREQUENCY: 7,

  // UI settings
  DEFAULT_WEIGHT_UNIT: 'kg',
  DEFAULT_HEIGHT_UNIT: 'cm',

  // Chart settings
  CHART_TIME_PERIODS: {
    WEEK: 7,
    MONTH: 30,
    QUARTER: 90,
    ALL: 0
  }
};

export const INJECTION_SITES = [
  'left_thigh',
  'right_thigh',
  'left_abdomen',
  'right_abdomen',
  'left_arm',
  'right_arm'
];

export const API_CONFIG = {
  // These should be loaded from environment variables
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
  WITHINGS_CLIENT_ID: process.env.WITHINGS_CLIENT_ID || '',
  WITHINGS_CLIENT_SECRET: process.env.WITHINGS_CLIENT_SECRET || ''
};

export const ERROR_MESSAGES = {
  STORAGE_FAILED: 'Failed to save data to storage',
  LOAD_FAILED: 'Failed to load data from storage',
  INVALID_DATA: 'Invalid data format',
  NETWORK_ERROR: 'Network request failed',
  AUTH_REQUIRED: 'Authentication required'
};

export const SUCCESS_MESSAGES = {
  DATA_SAVED: 'Data saved successfully',
  DATA_IMPORTED: 'Data imported successfully',
  DATA_EXPORTED: 'Data exported successfully',
  SYNC_COMPLETE: 'Sync completed successfully'
};