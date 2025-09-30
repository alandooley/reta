/**
 * Data Migration Utilities
 * Handles data structure migrations between versions
 */

import { APP_CONFIG } from '../config/constants.js';
import logger from '../utils/logger.js';
import { isValidNumber } from '../utils/utils.js';

/**
 * Version history and migration functions
 */
const MIGRATIONS = {
  '1.0.0': null, // Initial version, no migration needed
  '1.1.0': migrateToV1_1_0,
};

/**
 * Get current data version
 * @param {Object} data - Application data
 * @returns {string} Version string
 */
function getDataVersion(data) {
  return data.version || '1.0.0';
}

/**
 * Check if data needs migration
 * @param {Object} data - Application data
 * @returns {boolean} True if migration needed
 */
export function needsMigration(data) {
  if (!data) return false;

  const currentVersion = getDataVersion(data);
  const appVersion = APP_CONFIG.VERSION;

  return currentVersion !== appVersion;
}

/**
 * Migrate data to version 1.1.0
 * @param {Object} data - Data to migrate
 * @returns {Object} Migrated data
 */
function migrateToV1_1_0(data) {
  logger.info('Migrating data to version 1.1.0');

  const migrated = { ...data };

  // Add version field if missing
  migrated.version = '1.1.0';

  // Ensure all injections have medication_level_at_injection
  if (migrated.injections && Array.isArray(migrated.injections)) {
    migrated.injections = migrated.injections.map(injection => {
      if (injection.medication_level_at_injection === undefined) {
        injection.medication_level_at_injection = 0;
      }
      return injection;
    });
  }

  // Ensure all vials have concentration_mg_ml calculated
  if (migrated.vials && Array.isArray(migrated.vials)) {
    migrated.vials = migrated.vials.map(vial => {
      if (!vial.concentration_mg_ml && vial.total_mg && vial.bac_water_ml) {
        vial.concentration_mg_ml = vial.total_mg / vial.bac_water_ml;
      }
      return vial;
    });
  }

  // Initialize settings if missing
  if (!migrated.settings) {
    migrated.settings = {
      weightUnit: 'kg',
      heightUnit: 'cm',
      theme: 'dark'
    };
  }

  logger.info('Migration to v1.1.0 complete');
  return migrated;
}

/**
 * Apply all necessary migrations to bring data up to current version
 * @param {Object} data - Application data
 * @returns {Object} Migrated data
 */
export function migrateData(data) {
  if (!data) {
    logger.warn('migrateData called with null/undefined data');
    return createDefaultData();
  }

  let currentData = { ...data };
  const currentVersion = getDataVersion(currentData);
  const targetVersion = APP_CONFIG.VERSION;

  logger.info('Starting data migration', {
    from: currentVersion,
    to: targetVersion
  });

  // Get list of versions to migrate through
  const versions = Object.keys(MIGRATIONS).sort();
  const startIndex = versions.indexOf(currentVersion);

  if (startIndex === -1) {
    logger.error('Unknown data version', { version: currentVersion });
    throw new Error(`Unknown data version: ${currentVersion}`);
  }

  // Apply migrations in order
  for (let i = startIndex + 1; i < versions.length; i++) {
    const version = versions[i];
    const migrationFn = MIGRATIONS[version];

    if (migrationFn) {
      logger.info(`Applying migration to ${version}`);
      try {
        currentData = migrationFn(currentData);
        currentData.version = version;
      } catch (error) {
        logger.error(`Migration to ${version} failed`, {
          error: error.message
        });
        throw new Error(`Migration failed: ${error.message}`);
      }
    }
  }

  // Ensure final version is set
  currentData.version = targetVersion;

  logger.info('Data migration complete', { version: targetVersion });
  return currentData;
}

/**
 * Create default data structure for new installations
 * @returns {Object} Default application data
 */
export function createDefaultData() {
  logger.info('Creating default data structure');

  return {
    version: APP_CONFIG.VERSION,
    vials: [],
    injections: [],
    weights: [],
    settings: {
      weightUnit: APP_CONFIG.DEFAULT_WEIGHT_UNIT,
      heightUnit: APP_CONFIG.DEFAULT_HEIGHT_UNIT,
      theme: 'dark',
      notifications: {
        enabled: true,
        injectionReminder: true,
        vialExpiration: true
      }
    },
    metadata: {
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
  };
}

/**
 * Validate data structure after migration
 * @param {Object} data - Migrated data
 * @returns {boolean} True if valid
 */
export function validateMigratedData(data) {
  if (!data || typeof data !== 'object') {
    logger.error('Invalid migrated data structure');
    return false;
  }

  // Check required fields
  const requiredFields = ['version', 'vials', 'injections', 'weights'];
  for (const field of requiredFields) {
    if (!data.hasOwnProperty(field)) {
      logger.error(`Missing required field: ${field}`);
      return false;
    }
  }

  // Check arrays
  if (!Array.isArray(data.vials) || !Array.isArray(data.injections) || !Array.isArray(data.weights)) {
    logger.error('Data arrays are not arrays');
    return false;
  }

  // Validate version
  const versions = Object.keys(MIGRATIONS);
  if (!versions.includes(data.version)) {
    logger.error('Invalid version in migrated data', { version: data.version });
    return false;
  }

  logger.info('Migrated data validation passed');
  return true;
}

/**
 * Create a backup of data before migration
 * @param {Object} data - Data to backup
 * @param {string} storageKey - Storage key for backup
 */
export function createMigrationBackup(data, storageKey) {
  try {
    const backupKey = `${storageKey}_backup_${getDataVersion(data)}_${Date.now()}`;
    const serialized = JSON.stringify(data);
    localStorage.setItem(backupKey, serialized);

    logger.info('Migration backup created', {
      backupKey,
      size: serialized.length
    });

    return backupKey;
  } catch (error) {
    logger.error('Failed to create migration backup', {
      error: error.message
    });
    // Don't throw - backup failure shouldn't prevent migration
    return null;
  }
}

/**
 * Restore data from a backup
 * @param {string} backupKey - Backup key to restore from
 * @returns {Object|null} Restored data or null
 */
export function restoreFromBackup(backupKey) {
  try {
    const stored = localStorage.getItem(backupKey);
    if (!stored) {
      logger.error('Backup not found', { backupKey });
      return null;
    }

    const data = JSON.parse(stored);
    logger.info('Data restored from backup', { backupKey });
    return data;
  } catch (error) {
    logger.error('Failed to restore from backup', {
      backupKey,
      error: error.message
    });
    return null;
  }
}

/**
 * List available backups
 * @param {string} storageKey - Storage key prefix
 * @returns {Array<string>} List of backup keys
 */
export function listBackups(storageKey) {
  const backups = [];
  const prefix = `${storageKey}_backup_`;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        backups.push(key);
      }
    }

    logger.info('Found backups', { count: backups.length });
  } catch (error) {
    logger.error('Failed to list backups', { error: error.message });
  }

  return backups;
}

/**
 * Clean up old backups (keep only the most recent N)
 * @param {string} storageKey - Storage key prefix
 * @param {number} keepCount - Number of backups to keep
 */
export function cleanupOldBackups(storageKey, keepCount = 5) {
  try {
    const backups = listBackups(storageKey);

    if (backups.length <= keepCount) {
      logger.info('No old backups to clean up');
      return;
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => {
      const timestampA = parseInt(a.split('_').pop());
      const timestampB = parseInt(b.split('_').pop());
      return timestampB - timestampA;
    });

    // Remove old backups
    const toRemove = backups.slice(keepCount);
    toRemove.forEach(key => {
      localStorage.removeItem(key);
      logger.debug('Removed old backup', { key });
    });

    logger.info('Old backups cleaned up', {
      removed: toRemove.length,
      kept: keepCount
    });
  } catch (error) {
    logger.error('Failed to cleanup old backups', {
      error: error.message
    });
  }
}

/**
 * Perform a complete migration with backup and validation
 * @param {Object} data - Data to migrate
 * @param {string} storageKey - Storage key for backups
 * @returns {Object} Migrated and validated data
 */
export function performSafeMigration(data, storageKey) {
  logger.info('Starting safe migration process');

  // Create backup
  const backupKey = createMigrationBackup(data, storageKey);

  try {
    // Perform migration
    const migratedData = migrateData(data);

    // Validate result
    if (!validateMigratedData(migratedData)) {
      throw new Error('Migrated data failed validation');
    }

    // Clean up old backups
    cleanupOldBackups(storageKey);

    logger.info('Safe migration completed successfully');
    return migratedData;
  } catch (error) {
    logger.error('Safe migration failed', {
      error: error.message,
      backupKey
    });

    // Attempt to restore from backup
    if (backupKey) {
      logger.warn('Attempting to restore from backup');
      const restored = restoreFromBackup(backupKey);
      if (restored) {
        logger.info('Successfully restored from backup');
        return restored;
      }
    }

    throw error;
  }
}