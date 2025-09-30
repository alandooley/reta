/**
 * Backup Manager
 * Handles automatic and manual backups, data protection, and recovery
 */

import logger from '../utils/logger.js';
import { APP_CONFIG } from '../config/constants.js';

/**
 * Backup Manager Class
 */
class BackupManager {
  constructor() {
    this.storageKey = APP_CONFIG.STORAGE_KEY;
    this.backupPrefix = `${this.storageKey}_backup_`;
    this.autoBackupPrefix = `${this.storageKey}_auto_`;
    this.maxAutoBackups = 10;
    this.maxManualBackups = 5;
    this.autoBackupInterval = 5 * 60 * 1000; // 5 minutes
    this.lastBackupTime = null;
    this.autoBackupEnabled = true;
  }

  /**
   * Initialize backup manager and start auto-backup
   */
  initialize() {
    logger.info('Backup Manager initialized');

    // Start auto-backup timer
    if (this.autoBackupEnabled) {
      this.startAutoBackup();
    }

    // Cleanup old backups on init
    this.cleanupOldBackups();
  }

  /**
   * Create a manual backup
   * @param {Object} data - Data to backup
   * @param {string} [label] - Optional label for the backup
   * @returns {string} Backup key
   */
  createManualBackup(data, label = '') {
    try {
      const timestamp = Date.now();
      const backupKey = `${this.backupPrefix}manual_${timestamp}`;

      const backupData = {
        data: data,
        timestamp: timestamp,
        date: new Date().toISOString(),
        label: label || 'Manual backup',
        version: APP_CONFIG.VERSION,
        type: 'manual'
      };

      const serialized = JSON.stringify(backupData);
      localStorage.setItem(backupKey, serialized);

      logger.info('Manual backup created', {
        backupKey,
        size: serialized.length,
        label
      });

      // Cleanup old manual backups
      this.cleanupOldBackups('manual');

      return backupKey;
    } catch (error) {
      logger.error('Failed to create manual backup', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create an automatic backup
   * @param {Object} data - Data to backup
   * @returns {string|null} Backup key or null
   */
  createAutoBackup(data) {
    try {
      // Check if enough time has passed since last backup
      const now = Date.now();
      if (this.lastBackupTime && (now - this.lastBackupTime) < this.autoBackupInterval) {
        logger.debug('Skipping auto-backup - too soon since last backup');
        return null;
      }

      const timestamp = now;
      const backupKey = `${this.autoBackupPrefix}${timestamp}`;

      const backupData = {
        data: data,
        timestamp: timestamp,
        date: new Date().toISOString(),
        version: APP_CONFIG.VERSION,
        type: 'auto'
      };

      const serialized = JSON.stringify(backupData);
      localStorage.setItem(backupKey, serialized);

      this.lastBackupTime = timestamp;

      logger.debug('Auto backup created', {
        backupKey,
        size: serialized.length
      });

      // Cleanup old auto backups
      this.cleanupOldBackups('auto');

      return backupKey;
    } catch (error) {
      logger.error('Failed to create auto backup', {
        error: error.message
      });
      // Don't throw - auto backup failure shouldn't break the app
      return null;
    }
  }

  /**
   * Start automatic backup timer
   */
  startAutoBackup() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
    }

    this.autoBackupTimer = setInterval(() => {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          this.createAutoBackup(data);
        }
      } catch (error) {
        logger.error('Auto backup failed', { error: error.message });
      }
    }, this.autoBackupInterval);

    logger.info('Auto backup started', {
      interval: this.autoBackupInterval / 1000 + 's'
    });
  }

  /**
   * Stop automatic backup timer
   */
  stopAutoBackup() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
      logger.info('Auto backup stopped');
    }
  }

  /**
   * List all available backups
   * @param {string} [type] - Filter by type ('manual', 'auto', or undefined for all)
   * @returns {Array<Object>} Array of backup info objects
   */
  listBackups(type = null) {
    const backups = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        // Check if it's a backup key
        const isManual = key.startsWith(this.backupPrefix);
        const isAuto = key.startsWith(this.autoBackupPrefix);

        if (!isManual && !isAuto) continue;

        // Filter by type if specified
        if (type === 'manual' && !isManual) continue;
        if (type === 'auto' && !isAuto) continue;

        try {
          const stored = localStorage.getItem(key);
          const backup = JSON.parse(stored);

          backups.push({
            key: key,
            timestamp: backup.timestamp,
            date: backup.date,
            label: backup.label || (isAuto ? 'Auto backup' : 'Manual backup'),
            version: backup.version,
            type: backup.type || (isAuto ? 'auto' : 'manual'),
            size: stored.length,
            injections: backup.data?.injections?.length || 0,
            vials: backup.data?.vials?.length || 0,
            weights: backup.data?.weights?.length || 0
          });
        } catch (parseError) {
          logger.warn('Failed to parse backup', { key, error: parseError.message });
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp - a.timestamp);

      logger.info('Backups listed', {
        total: backups.length,
        type: type || 'all'
      });
    } catch (error) {
      logger.error('Failed to list backups', { error: error.message });
    }

    return backups;
  }

  /**
   * Restore data from a backup
   * @param {string} backupKey - Backup key to restore from
   * @returns {Object} Restored data
   */
  restoreBackup(backupKey) {
    try {
      const stored = localStorage.getItem(backupKey);

      if (!stored) {
        throw new Error('Backup not found');
      }

      const backup = JSON.parse(stored);

      if (!backup.data) {
        throw new Error('Invalid backup structure');
      }

      logger.info('Backup restored', {
        backupKey,
        timestamp: backup.timestamp,
        version: backup.version
      });

      return backup.data;
    } catch (error) {
      logger.error('Failed to restore backup', {
        backupKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete a specific backup
   * @param {string} backupKey - Backup key to delete
   */
  deleteBackup(backupKey) {
    try {
      localStorage.removeItem(backupKey);
      logger.info('Backup deleted', { backupKey });
    } catch (error) {
      logger.error('Failed to delete backup', {
        backupKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cleanup old backups (keep only the most recent N)
   * @param {string} [type] - Type of backups to cleanup ('manual', 'auto')
   */
  cleanupOldBackups(type = null) {
    try {
      const backups = this.listBackups(type);
      const maxBackups = type === 'manual' ? this.maxManualBackups : this.maxAutoBackups;

      if (backups.length <= maxBackups) {
        return;
      }

      // Delete old backups
      const toDelete = backups.slice(maxBackups);
      toDelete.forEach(backup => {
        this.deleteBackup(backup.key);
      });

      logger.info('Old backups cleaned up', {
        type: type || 'all',
        deleted: toDelete.length,
        kept: maxBackups
      });
    } catch (error) {
      logger.error('Failed to cleanup old backups', {
        error: error.message
      });
    }
  }

  /**
   * Export all data as downloadable JSON file
   * @param {Object} data - Data to export
   * @param {string} [filename] - Optional filename
   */
  exportToFile(data, filename = null) {
    try {
      const exportData = {
        data: data,
        exportDate: new Date().toISOString(),
        version: APP_CONFIG.VERSION,
        app: APP_CONFIG.NAME
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const defaultFilename = `${APP_CONFIG.STORAGE_KEY}_export_${Date.now()}.json`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || defaultFilename;
      link.click();

      URL.revokeObjectURL(url);

      logger.info('Data exported to file', {
        filename: link.download,
        size: json.length
      });

      return link.download;
    } catch (error) {
      logger.error('Failed to export data', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Import data from file
   * @param {File} file - File to import from
   * @returns {Promise<Object>} Imported data
   */
  async importFromFile(file) {
    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (!imported.data) {
        throw new Error('Invalid import file structure');
      }

      logger.info('Data imported from file', {
        filename: file.name,
        version: imported.version,
        injections: imported.data.injections?.length || 0,
        vials: imported.data.vials?.length || 0
      });

      return imported.data;
    } catch (error) {
      logger.error('Failed to import data', {
        filename: file.name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get backup statistics
   * @returns {Object} Backup stats
   */
  getBackupStats() {
    const manualBackups = this.listBackups('manual');
    const autoBackups = this.listBackups('auto');

    const totalSize = [...manualBackups, ...autoBackups]
      .reduce((sum, backup) => sum + backup.size, 0);

    return {
      manualBackups: manualBackups.length,
      autoBackups: autoBackups.length,
      totalBackups: manualBackups.length + autoBackups.length,
      totalSize: totalSize,
      lastBackupDate: manualBackups[0]?.date || autoBackups[0]?.date || null,
      autoBackupEnabled: this.autoBackupEnabled
    };
  }

  /**
   * Enable or disable auto-backup
   * @param {boolean} enabled - Enable state
   */
  setAutoBackupEnabled(enabled) {
    this.autoBackupEnabled = enabled;

    if (enabled) {
      this.startAutoBackup();
    } else {
      this.stopAutoBackup();
    }

    logger.info('Auto backup ' + (enabled ? 'enabled' : 'disabled'));
  }
}

// Create singleton instance
const backupManager = new BackupManager();

export default backupManager;
export { BackupManager };