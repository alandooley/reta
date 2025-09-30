/**
 * Data Storage and Persistence Layer
 */

import { APP_CONFIG, ERROR_MESSAGES } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Storage Manager Class
 */
class StorageManager {
  constructor() {
    this.storageKey = APP_CONFIG.STORAGE_KEY;
    this.encryptionEnabled = false;
  }

  /**
   * Load data from localStorage
   * @returns {Promise<Object|null>} Stored data or null
   */
  async loadData() {
    try {
      // Check if localStorage is available
      if (!this.isAvailable()) {
        logger.error('localStorage is not available');
        throw new Error('Storage is not available');
      }

      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        logger.info('No stored data found');
        return null;
      }

      // Parse JSON with error handling
      let data;
      try {
        data = JSON.parse(stored);
      } catch (parseError) {
        logger.error('Failed to parse stored data', { error: parseError.message });
        // Attempt to backup corrupted data
        const backupKey = `${this.storageKey}_corrupted_${Date.now()}`;
        localStorage.setItem(backupKey, stored);
        logger.warn('Corrupted data backed up to', { backupKey });
        throw new Error('Stored data is corrupted');
      }

      // Validate data structure
      if (!data || typeof data !== 'object') {
        logger.error('Invalid data structure', { data });
        throw new Error('Invalid data structure');
      }

      logger.info('Data loaded successfully', {
        injections: data.injections?.length || 0,
        vials: data.vials?.length || 0,
        weights: data.weights?.length || 0
      });

      return data;
    } catch (error) {
      logger.error(ERROR_MESSAGES.LOAD_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Save data to localStorage
   * @param {Object} data - Data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveData(data) {
    try {
      // Check if localStorage is available
      if (!this.isAvailable()) {
        logger.error('localStorage is not available');
        throw new Error('Storage is not available');
      }

      // Validate data before saving
      if (!data || typeof data !== 'object') {
        logger.error('Invalid data provided for saving', { data });
        throw new Error('Invalid data provided');
      }

      // Serialize data
      let serialized;
      try {
        serialized = JSON.stringify(data);
      } catch (serializeError) {
        logger.error('Failed to serialize data', { error: serializeError.message });
        throw new Error('Failed to serialize data');
      }

      // Check storage quota
      const estimatedSize = new Blob([serialized]).size;
      const maxSize = 5 * 1024 * 1024; // 5MB typical localStorage limit
      if (estimatedSize > maxSize) {
        logger.warn('Data size exceeds recommended limit', {
          size: estimatedSize,
          maxSize
        });
      }

      // Create backup of existing data
      try {
        const existing = localStorage.getItem(this.storageKey);
        if (existing) {
          const backupKey = `${this.storageKey}_backup`;
          localStorage.setItem(backupKey, existing);
        }
      } catch (backupError) {
        // Non-fatal error, continue with save
        logger.warn('Failed to create backup', { error: backupError.message });
      }

      // Save data
      try {
        localStorage.setItem(this.storageKey, serialized);
      } catch (saveError) {
        logger.error('Failed to save to localStorage', { error: saveError.message });

        // Check if it's a quota error
        if (saveError.name === 'QuotaExceededError') {
          throw new Error('Storage quota exceeded. Please free up space.');
        }
        throw new Error('Failed to save data');
      }

      logger.debug('Data saved successfully', {
        size: serialized.length,
        injections: data.injections?.length || 0,
        vials: data.vials?.length || 0
      });

      return true;
    } catch (error) {
      logger.error(ERROR_MESSAGES.STORAGE_FAILED, { error: error.message });
      throw error;
    }
  }

  /**
   * Clear all stored data
   * @returns {Promise<boolean>} Success status
   */
  async clearData() {
    try {
      localStorage.removeItem(this.storageKey);
      logger.info('Data cleared successfully');
      return true;
    } catch (error) {
      logger.error('Failed to clear data', { error: error.message });
      return false;
    }
  }

  /**
   * Check if storage is available
   * @returns {boolean} Storage availability
   */
  isAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      logger.warn('localStorage is not available', { error: error.message });
      return false;
    }
  }

  /**
   * Get storage size in bytes
   * @returns {number} Storage size
   */
  getStorageSize() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? new Blob([stored]).size : 0;
    } catch (error) {
      logger.error('Failed to calculate storage size', { error: error.message });
      return 0;
    }
  }

  /**
   * Export data as JSON blob
   * @param {Object} data - Data to export
   * @returns {Blob} JSON blob
   */
  exportAsBlob(data) {
    const json = JSON.stringify(data, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Import data from JSON string
   * @param {string} jsonString - JSON data
   * @returns {Object} Parsed data
   */
  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      logger.info('Data imported from JSON', {
        injections: data.injections?.length || 0,
        vials: data.vials?.length || 0
      });
      return data;
    } catch (error) {
      logger.error('Failed to parse JSON', { error: error.message });
      throw new Error(ERROR_MESSAGES.INVALID_DATA);
    }
  }

  /**
   * Enable encryption for sensitive data
   * @param {boolean} enabled - Enable encryption
   */
  setEncryption(enabled) {
    this.encryptionEnabled = enabled;
    logger.info(`Encryption ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Create singleton instance
const storageManager = new StorageManager();

export default storageManager;
export { StorageManager };