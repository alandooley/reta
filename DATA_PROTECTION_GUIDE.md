# Data Protection & Management Guide

This guide explains how to use the comprehensive data protection and management features in the Retatrutide Tracker app.

## Table of Contents

1. [Overview](#overview)
2. [Automatic Backups](#automatic-backups)
3. [Manual Backups](#manual-backups)
4. [Export/Import Data](#exportimport-data)
5. [Delete Functionality](#delete-functionality)
6. [Data Recovery](#data-recovery)
7. [Advanced Features](#advanced-features)

---

## Overview

The app includes multiple layers of data protection:

- **Automatic backups** every 5 minutes
- **Manual backup** creation on demand
- **Export/Import** to external files
- **IndexedDB fallback** if localStorage fails
- **Undo functionality** for deleted items
- **Multi-version backup** retention

---

## Automatic Backups

### How It Works

- Backups are created automatically every 5 minutes when data changes
- Up to 10 automatic backups are kept
- Older backups are automatically cleaned up
- Backups include all injections, vials, and weight data

### Enable/Disable Auto-Backup

```javascript
import backupManager from './src/core/backup-manager.js';

// Enable automatic backups
backupManager.setAutoBackupEnabled(true);

// Disable automatic backups
backupManager.setAutoBackupEnabled(false);
```

---

## Manual Backups

### Create a Manual Backup

```javascript
import backupManager from './src/core/backup-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

// Load current data
const data = await resilientStorage.loadData();

// Create backup with optional label
const backupKey = backupManager.createManualBackup(data, 'Before vial change');

console.log('Backup created:', backupKey);
```

### List All Backups

```javascript
// List all backups
const allBackups = backupManager.listBackups();

// List only manual backups
const manualBackups = backupManager.listBackups('manual');

// List only auto backups
const autoBackups = backupManager.listBackups('auto');

console.log('Available backups:', allBackups);
```

### Restore from Backup

```javascript
// Restore data from a specific backup
const backupKey = 'retatrutide_data_backup_manual_1234567890';
const restoredData = backupManager.restoreBackup(backupKey);

// Save the restored data
await resilientStorage.saveData(restoredData);

// Reload the app
window.location.reload();
```

---

## Export/Import Data

### Export Data to File

```javascript
import backupManager from './src/core/backup-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

// Load current data
const data = await resilientStorage.loadData();

// Export to downloadable JSON file
const filename = backupManager.exportToFile(data, 'my-backup.json');

console.log('Data exported to:', filename);
```

### Import Data from File

```javascript
// Create file input
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';

input.onchange = async (e) => {
  const file = e.target.files[0];

  // Import data from file
  const importedData = await backupManager.importFromFile(file);

  // Save imported data
  await resilientStorage.saveData(importedData);

  // Reload app
  window.location.reload();
};

input.click();
```

---

## Delete Functionality

### Delete an Injection

```javascript
import deleteManager from './src/managers/delete-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

// Load current data
const data = await resilientStorage.loadData();

// Delete injection by ID
const result = deleteManager.deleteInjection(
  data.injections,
  'injection_id_here'
);

// Update data
data.injections = result.injections;
await resilientStorage.saveData(data);

console.log('Deleted injection:', result.deleted);
```

### Delete a Vial

```javascript
// Delete vial (fails if injections reference it)
try {
  const result = deleteManager.deleteVial(
    data.vials,
    'vial_id_here',
    data.injections
  );

  data.vials = result.vials;
  await resilientStorage.saveData(data);
} catch (error) {
  console.error('Cannot delete vial:', error.message);
}
```

### Force Delete Vial with Injections

```javascript
// Delete vial AND all injections that use it
const result = deleteManager.forceDeleteVial(
  data.vials,
  data.injections,
  'vial_id_here'
);

data.vials = result.vials;
data.injections = result.injections;
await resilientStorage.saveData(data);

console.log('Deleted vial and', result.deleted.injections.length, 'injections');
```

### Delete a Weight Entry

```javascript
// Delete weight entry by timestamp
const result = deleteManager.deleteWeight(
  data.weights,
  '2024-01-01T12:00:00.000Z'
);

data.weights = result.weights;
await resilientStorage.saveData(data);
```

### Delete Multiple Injections

```javascript
const injectionIds = ['id1', 'id2', 'id3'];

const result = deleteManager.deleteMultipleInjections(
  data.injections,
  injectionIds
);

data.injections = result.injections;
await resilientStorage.saveData(data);

console.log('Deleted', result.deleted.length, 'injections');
```

---

## Data Recovery

### Undo Last Delete

```javascript
import deleteManager from './src/managers/delete-manager.js';
import resilientStorage from './src/core/resilient-storage.js';

// Check if undo is available
if (deleteManager.canUndo()) {
  // Get info about last operation
  const lastOp = deleteManager.getLastOperation();
  console.log('Last deleted:', lastOp);

  // Undo the deletion
  const data = await resilientStorage.loadData();
  const restoredData = deleteManager.undoLastDelete(data);

  // Save restored data
  await resilientStorage.saveData(restoredData);
}
```

### Restore Corrupted Data

If your data becomes corrupted, automatic backups are created:

```javascript
// List all backups sorted by date
const backups = backupManager.listBackups();

// Find most recent good backup
const latestBackup = backups[0];

// Restore it
const data = backupManager.restoreBackup(latestBackup.key);
await resilientStorage.saveData(data);
```

---

## Advanced Features

### Storage Statistics

```javascript
import resilientStorage from './src/core/resilient-storage.js';
import backupManager from './src/core/backup-manager.js';

// Get storage stats
const storageStats = await resilientStorage.getStorageStats();
console.log('Storage:', storageStats);

// Get backup stats
const backupStats = backupManager.getBackupStats();
console.log('Backups:', backupStats);
```

### Sync Storage Layers

The app uses both localStorage and IndexedDB for redundancy:

```javascript
// Sync data between localStorage and IndexedDB
await resilientStorage.syncStorageLayers();
```

### Initialize Everything

```javascript
import resilientStorage from './src/core/resilient-storage.js';
import backupManager from './src/core/backup-manager.js';
import { initializeDataManagementUI } from './src/ui/data-management-ui.js';

// Initialize resilient storage
await resilientStorage.initialize();

// Initialize backup manager
backupManager.initialize();

// Initialize UI components
initializeDataManagementUI();
```

---

## UI Integration Example

Here's a complete example of integrating the features into your UI:

```javascript
// Import modules
import resilientStorage from './src/core/resilient-storage.js';
import backupManager from './src/core/backup-manager.js';
import deleteManager from './src/managers/delete-manager.js';
import {
  createBackupSectionUI,
  renderBackupList,
  renderBackupStats,
  renderInjectionList,
  initializeDataManagementUI
} from './src/ui/data-management-ui.js';

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize storage
  await resilientStorage.initialize();

  // Load data
  const data = await resilientStorage.loadData();

  // Create backup section
  const container = document.getElementById('settings-container');
  container.innerHTML = createBackupSectionUI();

  // Render backup list
  renderBackupList(document.getElementById('backup-list'));

  // Render backup stats
  renderBackupStats(document.getElementById('backup-stats'));

  // Render injection list with delete buttons
  renderInjectionList(document.getElementById('injection-list'), data.injections);

  // Initialize all UI handlers
  initializeDataManagementUI();
});
```

---

## Best Practices

1. **Always create a manual backup** before:
   - Importing data
   - Bulk deleting items
   - Major data changes

2. **Keep auto-backups enabled** for continuous protection

3. **Export to file regularly** for offline backups

4. **Test restore functionality** periodically

5. **Don't disable backups** unless storage space is critical

6. **Check backup stats** occasionally to ensure backups are working

---

## Troubleshooting

### No Backups Being Created

```javascript
// Check if auto-backup is enabled
const stats = backupManager.getBackupStats();
console.log('Auto-backup enabled:', stats.autoBackupEnabled);

// Re-enable if disabled
backupManager.setAutoBackupEnabled(true);
```

### Storage Quota Exceeded

```javascript
// Clean up old backups manually
backupManager.cleanupOldBackups('auto');
backupManager.cleanupOldBackups('manual');

// Reduce max backup count
backupManager.maxAutoBackups = 5;
backupManager.maxManualBackups = 3;
```

### Can't Restore Backup

```javascript
// Check if backup exists
const backups = backupManager.listBackups();
console.log('Available backups:', backups);

// Verify backup data
const backupKey = 'your_backup_key';
const stored = localStorage.getItem(backupKey);
if (stored) {
  const backup = JSON.parse(stored);
  console.log('Backup data:', backup);
}
```

---

## API Reference

### BackupManager

- `initialize()` - Start auto-backup system
- `createManualBackup(data, label)` - Create manual backup
- `createAutoBackup(data)` - Create automatic backup
- `listBackups(type)` - List all backups
- `restoreBackup(backupKey)` - Restore from backup
- `deleteBackup(backupKey)` - Delete a backup
- `exportToFile(data, filename)` - Export to file
- `importFromFile(file)` - Import from file
- `getBackupStats()` - Get backup statistics

### DeleteManager

- `deleteInjection(injections, id)` - Delete injection
- `deleteVial(vials, id, injections)` - Delete vial
- `forceDeleteVial(vials, injections, id)` - Force delete vial
- `deleteWeight(weights, timestamp)` - Delete weight
- `undoLastDelete(data)` - Undo last deletion
- `canUndo()` - Check if undo available
- `getLastOperation()` - Get last operation info

### ResilientStorage

- `initialize()` - Initialize storage layers
- `saveData(data)` - Save with auto-backup
- `loadData()` - Load from storage
- `clearData()` - Clear all data
- `getStorageStats()` - Get storage statistics
- `syncStorageLayers()` - Sync localStorage and IndexedDB

---

## Security Notes

- All data is stored **locally** on your device
- No data is sent to external servers
- Backups are stored in browser storage
- Export files contain **unencrypted** data - keep them secure
- Clearing browser data will delete backups

---

## Support

For issues or questions:
1. Check the console for error messages
2. Verify storage availability
3. Try exporting/importing to recover
4. Check GitHub issues for similar problems