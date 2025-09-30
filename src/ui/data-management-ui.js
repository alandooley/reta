/**
 * Data Management UI Components
 * UI helpers for backup, restore, and delete operations
 */

import backupManager from '../core/backup-manager.js';
import deleteManager from '../managers/delete-manager.js';
import resilientStorage from '../core/resilient-storage.js';
import logger from '../utils/logger.js';

/**
 * Create backup section UI
 * @returns {string} HTML string
 */
export function createBackupSectionUI() {
  return `
    <div class="data-management-section">
      <h3>Data Protection & Backup</h3>

      <!-- Manual Backup -->
      <div class="backup-controls">
        <button id="create-manual-backup-btn" class="btn btn-primary">
          <span class="icon">💾</span>
          Create Manual Backup
        </button>

        <button id="export-data-btn" class="btn btn-success">
          <span class="icon">📥</span>
          Export Data to File
        </button>

        <button id="import-data-btn" class="btn btn-warning">
          <span class="icon">📤</span>
          Import Data from File
        </button>
      </div>

      <!-- Auto Backup Toggle -->
      <div class="backup-setting">
        <label class="switch">
          <input type="checkbox" id="auto-backup-toggle" checked>
          <span class="slider"></span>
        </label>
        <span>Automatic Backups (every 5 minutes)</span>
      </div>

      <!-- Backup Statistics -->
      <div id="backup-stats" class="backup-stats">
        <p>Loading backup statistics...</p>
      </div>

      <!-- Backup List -->
      <div class="backup-list-container">
        <h4>Available Backups</h4>
        <div id="backup-list" class="backup-list">
          <p>Loading backups...</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create delete section UI for a specific item type
 * @param {string} itemType - Type of item ('injection', 'vial', 'weight')
 * @returns {string} HTML string
 */
export function createDeleteSectionUI(itemType) {
  const labels = {
    injection: 'Injections',
    vial: 'Vials',
    weight: 'Weight Entries'
  };

  return `
    <div class="delete-section">
      <h4>Manage ${labels[itemType]}</h4>
      <div id="${itemType}-list" class="item-list">
        <p>Loading ${labels[itemType].toLowerCase()}...</p>
      </div>

      ${deleteManager.canUndo() ? `
        <button id="undo-delete-btn" class="btn btn-secondary">
          <span class="icon">↩️</span>
          Undo Last Delete
        </button>
      ` : ''}
    </div>
  `;
}

/**
 * Render backup list
 * @param {HTMLElement} container - Container element
 */
export function renderBackupList(container) {
  const backups = backupManager.listBackups();

  if (backups.length === 0) {
    container.innerHTML = '<p class="no-data">No backups available</p>';
    return;
  }

  const html = backups.map(backup => `
    <div class="backup-item ${backup.type}" data-key="${backup.key}">
      <div class="backup-info">
        <div class="backup-header">
          <span class="backup-type">${backup.type === 'auto' ? '🤖 Auto' : '👤 Manual'}</span>
          <span class="backup-date">${new Date(backup.date).toLocaleString()}</span>
        </div>
        <div class="backup-label">${backup.label}</div>
        <div class="backup-details">
          <span>${backup.injections} injections</span>
          <span>${backup.vials} vials</span>
          <span>${backup.weights} weights</span>
          <span>${(backup.size / 1024).toFixed(1)} KB</span>
        </div>
      </div>
      <div class="backup-actions">
        <button class="btn btn-sm btn-primary restore-backup-btn" data-key="${backup.key}">
          Restore
        </button>
        <button class="btn btn-sm btn-danger delete-backup-btn" data-key="${backup.key}">
          Delete
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;

  // Attach event listeners
  container.querySelectorAll('.restore-backup-btn').forEach(btn => {
    btn.addEventListener('click', () => handleRestoreBackup(btn.dataset.key));
  });

  container.querySelectorAll('.delete-backup-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteBackup(btn.dataset.key));
  });
}

/**
 * Render backup statistics
 * @param {HTMLElement} container - Container element
 */
export function renderBackupStats(container) {
  const stats = backupManager.getBackupStats();

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">Manual Backups:</span>
        <span class="stat-value">${stats.manualBackups}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Auto Backups:</span>
        <span class="stat-value">${stats.autoBackups}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Size:</span>
        <span class="stat-value">${(stats.totalSize / 1024).toFixed(1)} KB</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Last Backup:</span>
        <span class="stat-value">${
          stats.lastBackupDate
            ? new Date(stats.lastBackupDate).toLocaleString()
            : 'Never'
        }</span>
      </div>
    </div>
  `;
}

/**
 * Render injection list with delete buttons
 * @param {HTMLElement} container - Container element
 * @param {Array} injections - Array of injection records
 */
export function renderInjectionList(container, injections) {
  if (!injections || injections.length === 0) {
    container.innerHTML = '<p class="no-data">No injections found</p>';
    return;
  }

  // Sort by date (newest first)
  const sorted = [...injections].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  const html = sorted.map(injection => `
    <div class="list-item" data-id="${injection.id}">
      <div class="item-info">
        <div class="item-header">
          <span class="item-date">${new Date(injection.timestamp).toLocaleString()}</span>
          <span class="item-dose">${injection.dose_mg} mg</span>
        </div>
        <div class="item-details">
          <span>${injection.injection_site.replace('_', ' ')}</span>
          ${injection.notes ? `<span class="item-notes">${injection.notes}</span>` : ''}
        </div>
      </div>
      <button class="btn btn-sm btn-danger delete-injection-btn" data-id="${injection.id}">
        Delete
      </button>
    </div>
  `).join('');

  container.innerHTML = html;

  // Attach delete event listeners
  container.querySelectorAll('.delete-injection-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteInjection(btn.dataset.id));
  });
}

/**
 * Render vial list with delete buttons
 * @param {HTMLElement} container - Container element
 * @param {Array} vials - Array of vial records
 */
export function renderVialList(container, vials) {
  if (!vials || vials.length === 0) {
    container.innerHTML = '<p class="no-data">No vials found</p>';
    return;
  }

  const html = vials.map(vial => `
    <div class="list-item" data-id="${vial.vial_id}">
      <div class="item-info">
        <div class="item-header">
          <span class="item-label">${vial.supplier || 'Vial'}</span>
          <span class="item-status status-${vial.status}">${vial.status}</span>
        </div>
        <div class="item-details">
          <span>${vial.total_mg} mg total</span>
          <span>${vial.remaining_ml.toFixed(1)} ml remaining</span>
          <span>${vial.doses_used} doses used</span>
        </div>
      </div>
      <button class="btn btn-sm btn-danger delete-vial-btn" data-id="${vial.vial_id}">
        Delete
      </button>
    </div>
  `).join('');

  container.innerHTML = html;

  // Attach delete event listeners
  container.querySelectorAll('.delete-vial-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteVial(btn.dataset.id));
  });
}

/**
 * Render weight list with delete buttons
 * @param {HTMLElement} container - Container element
 * @param {Array} weights - Array of weight records
 */
export function renderWeightList(container, weights) {
  if (!weights || weights.length === 0) {
    container.innerHTML = '<p class="no-data">No weight entries found</p>';
    return;
  }

  // Sort by date (newest first)
  const sorted = [...weights].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  const html = sorted.map(weight => `
    <div class="list-item" data-timestamp="${weight.timestamp}">
      <div class="item-info">
        <div class="item-header">
          <span class="item-date">${new Date(weight.timestamp).toLocaleString()}</span>
          <span class="item-value">${weight.weight_kg} kg / ${weight.weight_lbs.toFixed(1)} lbs</span>
        </div>
        ${weight.bmi ? `
          <div class="item-details">
            <span>BMI: ${weight.bmi.toFixed(1)}</span>
            ${weight.body_fat_percentage ? `<span>Body Fat: ${weight.body_fat_percentage.toFixed(1)}%</span>` : ''}
          </div>
        ` : ''}
      </div>
      <button class="btn btn-sm btn-danger delete-weight-btn" data-timestamp="${weight.timestamp}">
        Delete
      </button>
    </div>
  `).join('');

  container.innerHTML = html;

  // Attach delete event listeners
  container.querySelectorAll('.delete-weight-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteWeight(btn.dataset.timestamp));
  });
}

/**
 * Handle restore backup
 * @param {string} backupKey - Backup key to restore
 */
async function handleRestoreBackup(backupKey) {
  if (!confirm('Are you sure you want to restore this backup? Current data will be replaced.')) {
    return;
  }

  try {
    const data = backupManager.restoreBackup(backupKey);
    await resilientStorage.saveData(data);

    alert('Backup restored successfully! Please refresh the page.');
    window.location.reload();
  } catch (error) {
    logger.error('Failed to restore backup', { error: error.message });
    alert('Failed to restore backup: ' + error.message);
  }
}

/**
 * Handle delete backup
 * @param {string} backupKey - Backup key to delete
 */
function handleDeleteBackup(backupKey) {
  if (!confirm('Are you sure you want to delete this backup?')) {
    return;
  }

  try {
    backupManager.deleteBackup(backupKey);

    // Refresh backup list
    const container = document.getElementById('backup-list');
    if (container) {
      renderBackupList(container);
    }

    // Update stats
    const statsContainer = document.getElementById('backup-stats');
    if (statsContainer) {
      renderBackupStats(statsContainer);
    }
  } catch (error) {
    logger.error('Failed to delete backup', { error: error.message });
    alert('Failed to delete backup: ' + error.message);
  }
}

/**
 * Handle delete injection
 * @param {string} injectionId - Injection ID to delete
 */
async function handleDeleteInjection(injectionId) {
  if (!confirm('Are you sure you want to delete this injection?')) {
    return;
  }

  try {
    const data = await resilientStorage.loadData();
    const result = deleteManager.deleteInjection(data.injections, injectionId);

    data.injections = result.injections;
    await resilientStorage.saveData(data);

    alert('Injection deleted successfully!');
    window.location.reload();
  } catch (error) {
    logger.error('Failed to delete injection', { error: error.message });
    alert('Failed to delete injection: ' + error.message);
  }
}

/**
 * Handle delete vial
 * @param {string} vialId - Vial ID to delete
 */
async function handleDeleteVial(vialId) {
  try {
    const data = await resilientStorage.loadData();

    // Try normal delete first
    try {
      const result = deleteManager.deleteVial(data.vials, vialId, data.injections);
      data.vials = result.vials;
      await resilientStorage.saveData(data);

      alert('Vial deleted successfully!');
      window.location.reload();
    } catch (error) {
      // If vial has references, ask about cascade delete
      if (error.message.includes('injection(s) reference')) {
        if (confirm(error.message + '\n\nDo you want to delete the vial AND all related injections?')) {
          const result = deleteManager.forceDeleteVial(data.vials, data.injections, vialId);
          data.vials = result.vials;
          data.injections = result.injections;
          await resilientStorage.saveData(data);

          alert('Vial and related injections deleted successfully!');
          window.location.reload();
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Failed to delete vial', { error: error.message });
    alert('Failed to delete vial: ' + error.message);
  }
}

/**
 * Handle delete weight
 * @param {string} timestamp - Weight timestamp to delete
 */
async function handleDeleteWeight(timestamp) {
  if (!confirm('Are you sure you want to delete this weight entry?')) {
    return;
  }

  try {
    const data = await resilientStorage.loadData();
    const result = deleteManager.deleteWeight(data.weights, timestamp);

    data.weights = result.weights;
    await resilientStorage.saveData(data);

    alert('Weight entry deleted successfully!');
    window.location.reload();
  } catch (error) {
    logger.error('Failed to delete weight', { error: error.message });
    alert('Failed to delete weight: ' + error.message);
  }
}

/**
 * Initialize data management UI
 */
export function initializeDataManagementUI() {
  // Create manual backup button handler
  const createBackupBtn = document.getElementById('create-manual-backup-btn');
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', async () => {
      try {
        const data = await resilientStorage.loadData();
        const label = prompt('Enter a label for this backup (optional):') || 'Manual backup';
        backupManager.createManualBackup(data, label);

        alert('Backup created successfully!');

        // Refresh lists
        renderBackupList(document.getElementById('backup-list'));
        renderBackupStats(document.getElementById('backup-stats'));
      } catch (error) {
        alert('Failed to create backup: ' + error.message);
      }
    });
  }

  // Export data button handler
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const data = await resilientStorage.loadData();
        backupManager.exportToFile(data);
      } catch (error) {
        alert('Failed to export data: ' + error.message);
      }
    });
  }

  // Import data button handler
  const importBtn = document.getElementById('import-data-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (e) => {
        try {
          const file = e.target.files[0];
          const data = await backupManager.importFromFile(file);
          await resilientStorage.saveData(data);

          alert('Data imported successfully! Please refresh the page.');
          window.location.reload();
        } catch (error) {
          alert('Failed to import data: ' + error.message);
        }
      };

      input.click();
    });
  }

  // Auto backup toggle handler
  const autoBackupToggle = document.getElementById('auto-backup-toggle');
  if (autoBackupToggle) {
    autoBackupToggle.addEventListener('change', (e) => {
      backupManager.setAutoBackupEnabled(e.target.checked);
    });
  }

  // Undo delete button handler
  const undoBtn = document.getElementById('undo-delete-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      try {
        const data = await resilientStorage.loadData();
        const updated = deleteManager.undoLastDelete(data);
        await resilientStorage.saveData(updated);

        alert('Delete undone successfully!');
        window.location.reload();
      } catch (error) {
        alert('Failed to undo: ' + error.message);
      }
    });
  }

  logger.info('Data management UI initialized');
}