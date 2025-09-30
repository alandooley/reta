/**
 * Resilient Storage Manager
 * Multi-layer storage with IndexedDB fallback and automatic backups
 */

import logger from '../utils/logger.js';
import { APP_CONFIG } from '../config/constants.js';
import backupManager from './backup-manager.js';

/**
 * Resilient Storage Manager Class
 */
class ResilientStorage {
  constructor() {
    this.storageKey = APP_CONFIG.STORAGE_KEY;
    this.dbName = 'RetatrutideDB';
    this.dbVersion = 1;
    this.storeName = 'appData';
    this.db = null;
    this.preferredStorage = 'localStorage'; // or 'indexedDB'
  }

  /**
   * Initialize storage and IndexedDB
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Try to initialize IndexedDB
      await this.initIndexedDB();

      // Check localStorage availability
      const localStorageAvailable = this.isLocalStorageAvailable();

      if (!localStorageAvailable && !this.db) {
        throw new Error('No storage available');
      }

      // Initialize backup manager
      backupManager.initialize();

      logger.info('Resilient storage initialized', {
        localStorage: localStorageAvailable,
        indexedDB: !!this.db,
        preferred: this.preferredStorage
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize storage', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize IndexedDB
   * @returns {Promise<IDBDatabase>} Database instance
   * @private
   */
  initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        logger.warn('IndexedDB not available');
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        logger.error('IndexedDB open failed', {
          error: request.error
        });
        resolve(null);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'key'
          });

          objectStore.createIndex('timestamp', 'timestamp', { unique: false });

          logger.info('IndexedDB object store created');
        }
      };
    });
  }

  /**
   * Check if localStorage is available
   * @returns {boolean} Availability status
   */
  isLocalStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      logger.warn('localStorage not available', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Save data with automatic backup
   * @param {Object} data - Data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveData(data) {
    try {
      // Validate data
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data');
      }

      // Create automatic backup before save
      try {
        backupManager.createAutoBackup(data);
      } catch (backupError) {
        logger.warn('Auto backup failed', {
          error: backupError.message
        });
        // Continue with save even if backup fails
      }

      // Try primary storage
      const savedToPrimary = await this.saveToPrimaryStorage(data);

      // Try fallback storage
      const savedToFallback = await this.saveToFallbackStorage(data);

      if (!savedToPrimary && !savedToFallback) {
        throw new Error('Failed to save to any storage');
      }

      logger.info('Data saved', {
        primary: savedToPrimary,
        fallback: savedToFallback,
        injections: data.injections?.length || 0,
        vials: data.vials?.length || 0
      });

      return true;
    } catch (error) {
      logger.error('Save failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Save to primary storage (localStorage)
   * @param {Object} data - Data to save
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async saveToPrimaryStorage(data) {
    try {
      if (!this.isLocalStorageAvailable()) {
        return false;
      }

      const serialized = JSON.stringify(data);
      localStorage.setItem(this.storageKey, serialized);

      logger.debug('Saved to localStorage', {
        size: serialized.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to save to localStorage', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Save to fallback storage (IndexedDB)
   * @param {Object} data - Data to save
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async saveToFallbackStorage(data) {
    if (!this.db) {
      return false;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);

        const record = {
          key: this.storageKey,
          data: data,
          timestamp: Date.now(),
          date: new Date().toISOString()
        };

        const request = objectStore.put(record);

        request.onsuccess = () => {
          logger.debug('Saved to IndexedDB');
          resolve(true);
        };

        request.onerror = () => {
          logger.error('Failed to save to IndexedDB', {
            error: request.error
          });
          resolve(false);
        };
      } catch (error) {
        logger.error('IndexedDB save error', {
          error: error.message
        });
        resolve(false);
      }
    });
  }

  /**
   * Load data with fallback support
   * @returns {Promise<Object|null>} Loaded data or null
   */
  async loadData() {
    try {
      // Try primary storage first
      let data = await this.loadFromPrimaryStorage();

      // Try fallback if primary fails
      if (!data) {
        logger.warn('Primary storage load failed, trying fallback');
        data = await this.loadFromFallbackStorage();
      }

      if (!data) {
        logger.info('No data found in any storage');
        return null;
      }

      // Validate data structure
      if (!this.isValidDataStructure(data)) {
        logger.error('Invalid data structure');
        throw new Error('Invalid data structure');
      }

      logger.info('Data loaded', {
        injections: data.injections?.length || 0,
        vials: data.vials?.length || 0,
        weights: data.weights?.length || 0
      });

      return data;
    } catch (error) {
      logger.error('Load failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load from primary storage (localStorage)
   * @returns {Promise<Object|null>} Loaded data or null
   * @private
   */
  async loadFromPrimaryStorage() {
    try {
      if (!this.isLocalStorageAvailable()) {
        return null;
      }

      const stored = localStorage.getItem(this.storageKey);

      if (!stored) {
        return null;
      }

      const data = JSON.parse(stored);
      logger.debug('Loaded from localStorage');

      return data;
    } catch (error) {
      logger.error('Failed to load from localStorage', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Load from fallback storage (IndexedDB)
   * @returns {Promise<Object|null>} Loaded data or null
   * @private
   */
  async loadFromFallbackStorage() {
    if (!this.db) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.get(this.storageKey);

        request.onsuccess = () => {
          if (request.result) {
            logger.debug('Loaded from IndexedDB');
            resolve(request.result.data);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          logger.error('Failed to load from IndexedDB', {
            error: request.error
          });
          resolve(null);
        };
      } catch (error) {
        logger.error('IndexedDB load error', {
          error: error.message
        });
        resolve(null);
      }
    });
  }

  /**
   * Validate data structure
   * @param {Object} data - Data to validate
   * @returns {boolean} True if valid
   * @private
   */
  isValidDataStructure(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }

    return (
      Array.isArray(data.vials) &&
      Array.isArray(data.injections) &&
      Array.isArray(data.weights)
    );
  }

  /**
   * Clear all data
   * @returns {Promise<boolean>} Success status
   */
  async clearData() {
    try {
      // Clear localStorage
      if (this.isLocalStorageAvailable()) {
        localStorage.removeItem(this.storageKey);
      }

      // Clear IndexedDB
      if (this.db) {
        await new Promise((resolve) => {
          const transaction = this.db.transaction([this.storeName], 'readwrite');
          const objectStore = transaction.objectStore(this.storeName);
          const request = objectStore.delete(this.storageKey);

          request.onsuccess = () => resolve(true);
          request.onerror = () => resolve(false);
        });
      }

      logger.info('All data cleared');
      return true;
    } catch (error) {
      logger.error('Failed to clear data', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats
   */
  async getStorageStats() {
    const stats = {
      localStorage: {
        available: this.isLocalStorageAvailable(),
        size: 0,
        hasData: false
      },
      indexedDB: {
        available: !!this.db,
        size: 0,
        hasData: false
      },
      backups: backupManager.getBackupStats()
    };

    // Get localStorage size
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        stats.localStorage.size = new Blob([stored]).size;
        stats.localStorage.hasData = true;
      }
    } catch (error) {
      // Ignore
    }

    return stats;
  }

  /**
   * Sync data between storage layers
   * @returns {Promise<boolean>} Success status
   */
  async syncStorageLayers() {
    try {
      const data = await this.loadData();

      if (!data) {
        logger.info('No data to sync');
        return true;
      }

      // Ensure data is in both storage layers
      await this.saveToPrimaryStorage(data);
      await this.saveToFallbackStorage(data);

      logger.info('Storage layers synced');
      return true;
    } catch (error) {
      logger.error('Failed to sync storage layers', {
        error: error.message
      });
      return false;
    }
  }
}

// Create singleton instance
const resilientStorage = new ResilientStorage();

export default resilientStorage;
export { ResilientStorage };