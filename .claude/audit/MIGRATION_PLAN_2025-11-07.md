# Schema Migration Plan
**Retatrutide Tracker - Data Integrity Audit**
**Date**: November 7, 2025
**Auditor**: Claude Code
**Scope**: Complete migration strategy from snake_case to camelCase schema

---

## Executive Summary

This document provides a comprehensive, step-by-step migration plan to unify frontend and backend schemas, resolving the snake_case vs camelCase inconsistency identified in the audit.

### Migration Goals

1. **Schema Unification**: Adopt camelCase consistently across frontend and backend
2. **Backward Compatibility**: Maintain support for existing localStorage data during transition
3. **Zero Data Loss**: All existing user data preserved and migrated
4. **Phased Rollout**: Gradual migration minimizing user disruption
5. **Rollback Capability**: Ability to revert if issues discovered

### Migration Timeline

**Total Estimated Time**: 12-16 hours of development + 2 weeks monitoring

| Phase | Duration | Risk Level |
|-------|----------|------------|
| Phase 1: Preparation | 2 hours | ✅ Low |
| Phase 2: Backend Migration | 3 hours | ⚠️ Medium |
| Phase 3: Dual-Schema Support | 4 hours | ⚠️ Medium |
| Phase 4: Frontend Migration | 3 hours | ❌ High |
| Phase 5: Cleanup | 2 hours | ✅ Low |
| Monitoring Period | 2 weeks | ⚠️ Medium |

---

## Pre-Migration Checklist

### Required Before Starting

- [ ] **Full Backup**: Export all user data from production DynamoDB
  - Command: `aws dynamodb scan --table-name retatrutide-tracker-prod --profile reta-admin > backup_pre_migration.json`

- [ ] **S3 Backup Verification**: Ensure automatic backups are working
  - Check: Latest backup exists in S3 bucket
  - Test: Download and verify backup integrity

- [ ] **Test Environment**: Set up complete test environment
  - DynamoDB table: `retatrutide-tracker-test`
  - CloudFront distribution: Test domain
  - Lambda functions: Separate test versions

- [ ] **Rollback Plan**: Document exact rollback steps
  - CDK snapshot taken
  - Frontend version tagged in Git
  - Database restoration script ready

- [ ] **User Communication**: Notify users of upcoming changes
  - Email: "We're improving data reliability"
  - In-app banner: "System maintenance scheduled"

- [ ] **Monitoring Setup**: CloudWatch alarms configured
  - Lambda errors > 5% of requests
  - API Gateway 5xx errors
  - DynamoDB throttling events

---

## Phase 1: Preparation (2 hours)

### Step 1.1: Create Migration Utilities

**Location**: `js/migration-utils.js` (new file)

**Purpose**: Shared functions for schema transformation

```javascript
/**
 * Migration utilities for schema transformation
 * Handles snake_case ↔ camelCase conversions
 */
class MigrationUtils {
    constructor() {
        this.version = '1.0.0';
        this.migrationLog = [];
    }

    /**
     * Transform frontend (snake_case) to backend (camelCase)
     */
    toBackend(entity, entityType) {
        const transformers = {
            injection: this.injectionToBackend.bind(this),
            vial: this.vialToBackend.bind(this),
            weight: this.weightToBackend.bind(this)
        };

        const transformer = transformers[entityType];
        if (!transformer) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        return transformer(entity);
    }

    /**
     * Transform backend (camelCase) to frontend (snake_case)
     */
    toFrontend(entity, entityType) {
        const transformers = {
            injection: this.injectionToFrontend.bind(this),
            vial: this.vialToFrontend.bind(this),
            weight: this.weightToFrontend.bind(this)
        };

        const transformer = transformers[entityType];
        if (!transformer) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        return transformer(entity);
    }

    /**
     * Transform injection to backend format
     */
    injectionToBackend(injection) {
        return {
            id: injection.id,
            timestamp: injection.timestamp,
            doseMg: injection.dose_mg,
            site: injection.injection_site,
            vialId: injection.vial_id || null,
            notes: injection.notes || '',
            weightKg: injection.weight_kg || null
        };
    }

    /**
     * Transform injection to frontend format
     */
    injectionToFrontend(injection) {
        return {
            id: injection.id,
            timestamp: injection.timestamp,
            dose_mg: injection.doseMg,
            injection_site: injection.site,
            vial_id: injection.vialId || null,
            notes: injection.notes || '',
            weight_kg: injection.weightKg || null
        };
    }

    /**
     * Transform vial to backend format
     */
    vialToBackend(vial) {
        return {
            id: vial.vial_id || vial.id,
            concentrationMgPerMl: vial.concentration_mg_per_ml,
            status: vial.status,
            source: vial.source || '',
            activatedDate: vial.activated_date || null,
            notes: vial.notes || '',
            currentVolumeMl: vial.current_volume_ml || null,
            usedVolumeMl: vial.used_volume_ml || null
        };
    }

    /**
     * Transform vial to frontend format
     */
    vialToFrontend(vial) {
        return {
            id: vial.id,
            concentration_mg_per_ml: vial.concentrationMgPerMl,
            status: vial.status,
            source: vial.source || '',
            activated_date: vial.activatedDate || null,
            notes: vial.notes || '',
            current_volume_ml: vial.currentVolumeMl || null,
            used_volume_ml: vial.usedVolumeMl || null
        };
    }

    /**
     * Transform weight to backend format
     */
    weightToBackend(weight) {
        return {
            id: weight.id,
            timestamp: weight.timestamp,
            weightKg: weight.weight_kg,
            notes: weight.notes || ''
        };
    }

    /**
     * Transform weight to frontend format
     */
    weightToFrontend(weight) {
        return {
            id: weight.id,
            timestamp: weight.timestamp,
            weight_kg: weight.weightKg,
            notes: weight.notes || ''
        };
    }

    /**
     * Validate transformed entity
     */
    validate(entity, entityType, schemaVersion) {
        const validators = {
            injection: this.validateInjection.bind(this),
            vial: this.validateVial.bind(this),
            weight: this.validateWeight.bind(this)
        };

        const validator = validators[entityType];
        if (!validator) {
            return { valid: false, errors: [`Unknown entity type: ${entityType}`] };
        }

        return validator(entity, schemaVersion);
    }

    validateInjection(injection, schemaVersion) {
        const errors = [];

        // Required fields check
        if (!injection.id) errors.push('Missing id');
        if (!injection.timestamp) errors.push('Missing timestamp');

        if (schemaVersion === 'snake_case') {
            if (!injection.dose_mg) errors.push('Missing dose_mg');
            if (!injection.injection_site) errors.push('Missing injection_site');
            if (injection.dose_mg && (injection.dose_mg < 0.1 || injection.dose_mg > 20)) {
                errors.push('dose_mg out of range (0.1-20)');
            }
        } else if (schemaVersion === 'camelCase') {
            if (!injection.doseMg) errors.push('Missing doseMg');
            if (!injection.site) errors.push('Missing site');
            if (injection.doseMg && (injection.doseMg < 0.1 || injection.doseMg > 20)) {
                errors.push('doseMg out of range (0.1-20)');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    validateVial(vial, schemaVersion) {
        const errors = [];

        if (!vial.id) errors.push('Missing id');

        if (schemaVersion === 'snake_case') {
            if (!vial.concentration_mg_per_ml) errors.push('Missing concentration_mg_per_ml');
            if (vial.concentration_mg_per_ml && (vial.concentration_mg_per_ml < 1 || vial.concentration_mg_per_ml > 100)) {
                errors.push('concentration_mg_per_ml out of range (1-100)');
            }
        } else if (schemaVersion === 'camelCase') {
            if (!vial.concentrationMgPerMl) errors.push('Missing concentrationMgPerMl');
            if (vial.concentrationMgPerMl && (vial.concentrationMgPerMl < 1 || vial.concentrationMgPerMl > 100)) {
                errors.push('concentrationMgPerMl out of range (1-100)');
            }
        }

        if (vial.status && !['dry', 'active', 'finished'].includes(vial.status)) {
            errors.push('Invalid status (must be: dry, active, finished)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    validateWeight(weight, schemaVersion) {
        const errors = [];

        if (!weight.id) errors.push('Missing id');
        if (!weight.timestamp) errors.push('Missing timestamp');

        if (schemaVersion === 'snake_case') {
            if (!weight.weight_kg) errors.push('Missing weight_kg');
            if (weight.weight_kg && (weight.weight_kg < 20 || weight.weight_kg > 300)) {
                errors.push('weight_kg out of range (20-300)');
            }
        } else if (schemaVersion === 'camelCase') {
            if (!weight.weightKg) errors.push('Missing weightKg');
            if (weight.weightKg && (weight.weightKg < 20 || weight.weightKg > 300)) {
                errors.push('weightKg out of range (20-300)');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Log migration action
     */
    log(action, entityType, entityId, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            entityType,
            entityId,
            details
        };

        this.migrationLog.push(entry);
        console.log('[Migration]', entry);

        // Persist log to localStorage
        const existingLog = JSON.parse(localStorage.getItem('migration_log') || '[]');
        existingLog.push(entry);
        localStorage.setItem('migration_log', JSON.stringify(existingLog));
    }
}

// Export singleton instance
window.migrationUtils = new MigrationUtils();
```

**Verification**:
- [ ] File created: `js/migration-utils.js`
- [ ] Functions tested with sample data
- [ ] Validation rules tested with edge cases

---

### Step 1.2: Add Migration Utilities to index.html

**Location**: [index.html:30](index.html#L30) (in `<head>` section)

**Change**:
```html
<!-- Add before closing </head> tag -->
<script src="js/migration-utils.js"></script>
```

**Verification**:
- [ ] File loaded successfully
- [ ] `window.migrationUtils` available in console

---

### Step 1.3: Create Migration Status Tracking

**Purpose**: Track which entities have been migrated

**Location**: localStorage key `migration_status`

**Structure**:
```json
{
  "version": "1.0.0",
  "started_at": "2025-11-07T12:00:00.000Z",
  "completed_at": null,
  "current_phase": "dual_schema",
  "entities_migrated": {
    "injections": 0,
    "vials": 0,
    "weights": 0
  },
  "total_entities": {
    "injections": 9,
    "vials": 5,
    "weights": 23
  },
  "errors": []
}
```

**Implementation**:
```javascript
// Add to InjectionTracker class
initMigrationStatus() {
    const status = localStorage.getItem('migration_status');
    if (!status) {
        const newStatus = {
            version: '1.0.0',
            started_at: new Date().toISOString(),
            completed_at: null,
            current_phase: 'preparation',
            entities_migrated: {
                injections: 0,
                vials: 0,
                weights: 0
            },
            total_entities: {
                injections: this.data.injections.length,
                vials: this.data.vials.length,
                weights: this.data.weights.length
            },
            errors: []
        };
        localStorage.setItem('migration_status', JSON.stringify(newStatus));
    }
}

updateMigrationStatus(updates) {
    const status = JSON.parse(localStorage.getItem('migration_status'));
    Object.assign(status, updates);
    localStorage.setItem('migration_status', JSON.stringify(status));
}
```

**Verification**:
- [ ] Migration status initialized
- [ ] Status updates working correctly

---

## Phase 2: Backend Migration (3 hours)

### Step 2.1: Update Lambda POST Handlers to Accept Both Schemas

**Location**: `reta-cloud-infrastructure/lambda/injections/post.js`

**Purpose**: Accept both snake_case and camelCase during transition

**Change**:
```javascript
// OLD (Line 31):
const { id, timestamp, doseMg, site } = body;

// NEW:
// Accept both snake_case and camelCase
const id = body.id;
const timestamp = body.timestamp;
const doseMg = body.doseMg || body.dose_mg;
const site = body.site || body.injection_site;
const vialId = body.vialId || body.vial_id;
const notes = body.notes || '';
const weightKg = body.weightKg || body.weight_kg;

// Log which schema was used for monitoring
const schemaUsed = body.doseMg ? 'camelCase' : 'snake_case';
console.log(`[Schema] Client used: ${schemaUsed}`);
```

**Apply Same Pattern To**:
- `lambda/vials/post.js`
- `lambda/weights/post.js`
- `lambda/vials/patch.js` (update operations)

**Verification**:
- [ ] Deploy Lambda functions
- [ ] Test POST with snake_case body → Success
- [ ] Test POST with camelCase body → Success
- [ ] Check CloudWatch logs for schema usage

---

### Step 2.2: Update Lambda GET Handlers to Return camelCase

**Location**: `reta-cloud-infrastructure/lambda/injections/get.js`

**Purpose**: Standardize response format to camelCase

**Current Behavior**: Returns data exactly as stored in DynamoDB

**New Behavior**: Always return camelCase (already current format)

**No Changes Needed**: Backend already returns camelCase

**Verification**:
- [ ] Test GET /v1/injections → Returns camelCase ✅
- [ ] Test GET /v1/vials → Returns camelCase ✅
- [ ] Test GET /v1/weights → Returns camelCase ✅

---

### Step 2.3: Update API Client to Handle Both Formats

**Location**: `js/api-client.js`

**Purpose**: Transform requests and responses during migration

**Change** (Add transformation layer):
```javascript
// Add after line 14 (after constructor)
setTransformMode(enabled) {
    this.transformEnabled = enabled;
    console.log(`[APIClient] Transform mode: ${enabled ? 'ON' : 'OFF'}`);
}

// Modify createInjection (line ~90)
async createInjection(injection) {
    try {
        const token = await this.getValidToken();

        // Transform to camelCase if enabled
        let body = injection;
        if (this.transformEnabled && window.migrationUtils) {
            body = window.migrationUtils.toBackend(injection, 'injection');
            console.log('[APIClient] Transformed injection to camelCase:', body);
        }

        const response = await fetch(`${this.baseUrl}/injections`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Transform response back to snake_case if needed
        if (this.transformEnabled && window.migrationUtils && data.data) {
            data.data = window.migrationUtils.toFrontend(data.data, 'injection');
        }

        return data;
    } catch (error) {
        console.error('[APIClient] createInjection error:', error);
        throw error;
    }
}
```

**Apply Same Pattern To**:
- `createVial()`
- `createWeight()`
- `updateVial()`
- `getInjections()` (transform response array)
- `getVials()` (transform response array)
- `getWeights()` (transform response array)

**Verification**:
- [ ] Transform mode OFF → Uses snake_case (current behavior)
- [ ] Transform mode ON → Uses camelCase (new behavior)
- [ ] Both modes work correctly

---

## Phase 3: Dual-Schema Support (4 hours)

### Step 3.1: Add Schema Version Flag

**Location**: localStorage key `schema_version`

**Purpose**: Track which schema version the app is using

**Values**:
- `"snake_case"` - Original format (backward compatible)
- `"dual"` - Accepts both, prefers camelCase
- `"camelCase"` - New format only

**Implementation**:
```javascript
// Add to InjectionTracker constructor
initSchemaVersion() {
    const version = localStorage.getItem('schema_version');
    if (!version) {
        localStorage.setItem('schema_version', 'snake_case');
        this.schemaVersion = 'snake_case';
    } else {
        this.schemaVersion = version;
    }
    console.log(`[Schema] Using version: ${this.schemaVersion}`);
}
```

**Verification**:
- [ ] Schema version initialized
- [ ] Accessible via `tracker.schemaVersion`

---

### Step 3.2: Update Data Access Layer

**Purpose**: Read data in both formats, write in current format

**Location**: InjectionTracker class methods

**Pattern**: Dual-access getters

```javascript
// Add helper method to InjectionTracker
getFieldValue(obj, fieldName) {
    // Define field mappings
    const fieldMappings = {
        'doseMg': ['doseMg', 'dose_mg'],
        'site': ['site', 'injection_site'],
        'vialId': ['vialId', 'vial_id'],
        'weightKg': ['weightKg', 'weight_kg'],
        'concentrationMgPerMl': ['concentrationMgPerMl', 'concentration_mg_per_ml'],
        'activatedDate': ['activatedDate', 'activated_date'],
        'currentVolumeMl': ['currentVolumeMl', 'current_volume_ml'],
        'usedVolumeMl': ['usedVolumeMl', 'used_volume_ml']
    };

    const possibleNames = fieldMappings[fieldName] || [fieldName];

    for (const name of possibleNames) {
        if (obj.hasOwnProperty(name) && obj[name] !== undefined) {
            return obj[name];
        }
    }

    return undefined;
}

// Update calculations to use getFieldValue
calculateCurrentLevel() {
    const injections = this.data.injections || [];
    if (injections.length === 0) return 0;

    const now = Date.now();
    const HALF_LIFE_HOURS = 165;
    const DECAY_CONSTANT = Math.log(2) / HALF_LIFE_HOURS;

    let totalLevel = 0;

    injections.forEach(inj => {
        const injTime = new Date(inj.timestamp).getTime();
        const hoursElapsed = (now - injTime) / (1000 * 60 * 60);

        // Use dual-access getter
        const doseMg = this.getFieldValue(inj, 'doseMg');
        if (!doseMg) {
            console.warn('[MedicationLevel] Missing dose for injection:', inj.id);
            return;
        }

        const remainingDose = doseMg * Math.exp(-DECAY_CONSTANT * hoursElapsed);
        totalLevel += remainingDose;
    });

    return totalLevel;
}
```

**Apply Pattern To**:
- [ ] `calculateCurrentLevel()` - Use `getFieldValue(inj, 'doseMg')`
- [ ] `calculateSupplyForecast()` - Use `getFieldValue(vial, 'concentrationMgPerMl')`
- [ ] `calculateVialRemainingVolume()` - Use `getFieldValue(inj, 'doseMg')` and `getFieldValue(vial, 'concentrationMgPerMl')`
- [ ] `renderInjectionsList()` - Use `getFieldValue(inj, 'site')`, `getFieldValue(inj, 'doseMg')`
- [ ] `renderVialCard()` - Use `getFieldValue(vial, 'concentrationMgPerMl')`
- [ ] All weight displays - Use `getFieldValue(weight, 'weightKg')`

**Verification**:
- [ ] Read snake_case data → Works
- [ ] Read camelCase data → Works
- [ ] Read mixed data → Works
- [ ] Calculations correct with all formats

---

### Step 3.3: Add In-App Migration Tool

**Purpose**: Allow user to migrate their localStorage data

**Location**: Settings page, new section

**UI**:
```html
<!-- Add to Settings page -->
<div class="settings-section">
    <h3>Data Schema Migration</h3>
    <p>Your data is currently stored in: <strong id="current-schema">snake_case</strong></p>

    <button id="migrate-schema-btn" class="btn btn-primary">
        Migrate to New Format (camelCase)
    </button>

    <div id="migration-progress" style="display: none;">
        <progress id="migration-progress-bar" max="100" value="0"></progress>
        <p id="migration-status-text">Preparing migration...</p>
    </div>

    <div id="migration-complete" style="display: none;">
        <p class="success">✅ Migration completed successfully!</p>
        <p>Migrated: <span id="entities-migrated"></span> entities</p>
    </div>
</div>
```

**Implementation**:
```javascript
// Add to InjectionTracker class
async migrateLocalStorageData() {
    console.log('[Migration] Starting localStorage migration...');

    const progressBar = document.getElementById('migration-progress-bar');
    const statusText = document.getElementById('migration-status-text');
    const progressDiv = document.getElementById('migration-progress');
    const completeDiv = document.getElementById('migration-complete');

    progressDiv.style.display = 'block';

    try {
        // Step 1: Backup current data
        statusText.textContent = 'Creating backup...';
        progressBar.value = 10;
        await this.createBackup();

        // Step 2: Migrate injections
        statusText.textContent = 'Migrating injections...';
        progressBar.value = 20;
        const migratedInjections = this.data.injections.map(inj => {
            if (window.migrationUtils) {
                const camelCase = window.migrationUtils.toBackend(inj, 'injection');
                const validation = window.migrationUtils.validate(camelCase, 'injection', 'camelCase');
                if (!validation.valid) {
                    console.error('[Migration] Invalid injection:', inj.id, validation.errors);
                    throw new Error(`Invalid injection: ${validation.errors.join(', ')}`);
                }
                return camelCase;
            }
            return inj;
        });
        this.data.injections = migratedInjections;
        progressBar.value = 40;

        // Step 3: Migrate vials
        statusText.textContent = 'Migrating vials...';
        const migratedVials = this.data.vials.map(vial => {
            if (window.migrationUtils) {
                const camelCase = window.migrationUtils.toBackend(vial, 'vial');
                const validation = window.migrationUtils.validate(camelCase, 'vial', 'camelCase');
                if (!validation.valid) {
                    console.error('[Migration] Invalid vial:', vial.id, validation.errors);
                    throw new Error(`Invalid vial: ${validation.errors.join(', ')}`);
                }
                return camelCase;
            }
            return vial;
        });
        this.data.vials = migratedVials;
        progressBar.value = 60;

        // Step 4: Migrate weights
        statusText.textContent = 'Migrating weights...';
        const migratedWeights = this.data.weights.map(weight => {
            if (window.migrationUtils) {
                const camelCase = window.migrationUtils.toBackend(weight, 'weight');
                const validation = window.migrationUtils.validate(camelCase, 'weight', 'camelCase');
                if (!validation.valid) {
                    console.error('[Migration] Invalid weight:', weight.id, validation.errors);
                    throw new Error(`Invalid weight: ${validation.errors.join(', ')}`);
                }
                return camelCase;
            }
            return weight;
        });
        this.data.weights = migratedWeights;
        progressBar.value = 80;

        // Step 5: Save migrated data
        statusText.textContent = 'Saving migrated data...';
        this.saveData();
        progressBar.value = 90;

        // Step 6: Update schema version
        localStorage.setItem('schema_version', 'camelCase');
        this.schemaVersion = 'camelCase';
        progressBar.value = 100;

        // Step 7: Show completion
        progressDiv.style.display = 'none';
        completeDiv.style.display = 'block';
        document.getElementById('entities-migrated').textContent =
            `${migratedInjections.length} injections, ${migratedVials.length} vials, ${migratedWeights.length} weights`;

        console.log('[Migration] Migration completed successfully');

        // Update migration status
        this.updateMigrationStatus({
            completed_at: new Date().toISOString(),
            current_phase: 'completed',
            entities_migrated: {
                injections: migratedInjections.length,
                vials: migratedVials.length,
                weights: migratedWeights.length
            }
        });

        // Refresh UI
        this.renderCurrentPage();

    } catch (error) {
        console.error('[Migration] Migration failed:', error);
        statusText.textContent = `Migration failed: ${error.message}`;
        statusText.classList.add('error');

        // Update migration status with error
        this.updateMigrationStatus({
            errors: [...(JSON.parse(localStorage.getItem('migration_status')).errors || []), {
                timestamp: new Date().toISOString(),
                message: error.message,
                stack: error.stack
            }]
        });

        alert('Migration failed. Your data has not been changed. Please contact support.');
    }
}

// Add event listener in initEventListeners()
document.getElementById('migrate-schema-btn')?.addEventListener('click', () => {
    if (confirm('This will migrate your data to the new format. A backup will be created first. Continue?')) {
        this.migrateLocalStorageData();
    }
});
```

**Verification**:
- [ ] UI renders correctly
- [ ] Backup created before migration
- [ ] All data migrated successfully
- [ ] Schema version updated
- [ ] Calculations still work correctly
- [ ] Can roll back if needed

---

## Phase 4: Frontend Migration (3 hours)

### Step 4.1: Enable Transform Mode by Default

**Purpose**: New users and migrated users use camelCase

**Location**: InjectionTracker constructor

**Change**:
```javascript
constructor() {
    // ... existing code ...

    // Enable API transformation based on schema version
    const schemaVersion = localStorage.getItem('schema_version') || 'snake_case';
    if (schemaVersion === 'camelCase') {
        this.apiClient.setTransformMode(true);
        console.log('[App] Using camelCase schema');
    } else {
        this.apiClient.setTransformMode(false);
        console.log('[App] Using snake_case schema (legacy)');
    }
}
```

**Verification**:
- [ ] New users → camelCase
- [ ] Migrated users → camelCase
- [ ] Legacy users → snake_case (until they migrate)

---

### Step 4.2: Update Data Creation Methods

**Purpose**: Create new entities in camelCase format

**Location**: All methods that create new entities

**Pattern**:
```javascript
// OLD (example from addInjection):
const newInjection = {
    id: `id_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
    timestamp: date.toISOString(),
    dose_mg: parseFloat(dose),
    injection_site: site,
    vial_id: vialId || null,
    notes: notes
};

// NEW:
const newInjection = {
    id: crypto.randomUUID(), // Use UUID v4
    timestamp: date.toISOString(),
    doseMg: parseFloat(dose), // camelCase
    site: site, // Simplified name
    vialId: vialId || null, // camelCase
    notes: notes
};
```

**Apply To**:
- [ ] `addInjection()` - Create injection in camelCase
- [ ] `addVial()` - Create vial in camelCase
- [ ] `addWeight()` - Create weight in camelCase

**But Only If**: `this.schemaVersion === 'camelCase'`

**Implementation with Conditional**:
```javascript
addInjection() {
    // ... validation code ...

    let newInjection;

    if (this.schemaVersion === 'camelCase') {
        newInjection = {
            id: crypto.randomUUID(),
            timestamp: date.toISOString(),
            doseMg: parseFloat(dose),
            site: site,
            vialId: vialId || null,
            weightKg: latestWeight?.weight_kg || null,
            notes: notes
        };
    } else {
        // Legacy format
        newInjection = {
            id: `id_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
            timestamp: date.toISOString(),
            dose_mg: parseFloat(dose),
            injection_site: site,
            vial_id: vialId || null,
            weight_kg: latestWeight?.weight_kg || null,
            notes: notes
        };
    }

    this.data.injections.push(newInjection);
    this.saveData();

    // Sync to cloud
    if (authManager && authManager.isAuthenticated()) {
        this.apiClient.createInjection(newInjection).catch(err => {
            console.error('[Sync] Failed to sync injection:', err);
        });
    }
}
```

**Verification**:
- [ ] camelCase mode → Creates entities in camelCase
- [ ] snake_case mode → Creates entities in snake_case (legacy)
- [ ] Both modes sync correctly

---

### Step 4.3: Update UI Rendering

**Purpose**: Render UI correctly regardless of schema

**Location**: All render methods

**Change**: Use `getFieldValue()` helper consistently

**Example**:
```javascript
// OLD:
card.innerHTML = `
    <div class="dose">${inj.dose_mg} mg</div>
    <div class="site">${formatSite(inj.injection_site)}</div>
`;

// NEW:
const doseMg = this.getFieldValue(inj, 'doseMg');
const site = this.getFieldValue(inj, 'site');

card.innerHTML = `
    <div class="dose">${doseMg} mg</div>
    <div class="site">${formatSite(site)}</div>
`;
```

**Apply To**:
- [ ] `renderInjectionsList()`
- [ ] `renderVialCard()`
- [ ] `renderWeightsList()`
- [ ] `renderResultsPage()`
- [ ] All chart rendering functions

**Verification**:
- [ ] UI renders correctly with snake_case data
- [ ] UI renders correctly with camelCase data
- [ ] UI renders correctly with mixed data

---

## Phase 5: Cleanup (2 hours)

### Step 5.1: Monitor Migration Adoption

**Purpose**: Track how many users have migrated

**Implementation**: CloudWatch dashboard

**Metrics**:
- Lambda logs: Count "Client used: snake_case" vs "Client used: camelCase"
- Ratio: `camelCase_requests / total_requests`
- Target: > 95% camelCase before cleanup

**Query**:
```
fields @timestamp, schemaUsed
| filter @message like /Schema/
| stats count() by schemaUsed
```

**Verification**:
- [ ] Dashboard created
- [ ] Metrics showing data
- [ ] Migration adoption > 95%

---

### Step 5.2: Remove Dual-Schema Support

**When**: 2 weeks after Phase 4 deployment AND > 95% migration

**Location**: Lambda handlers

**Change**:
```javascript
// REMOVE dual-schema support
// OLD:
const doseMg = body.doseMg || body.dose_mg;

// NEW (camelCase only):
const doseMg = body.doseMg;

// Add validation error for old schema
if (body.dose_mg) {
    return {
        statusCode: 400,
        body: JSON.stringify({
            success: false,
            error: 'Please update your app to the latest version'
        })
    };
}
```

**Apply To**:
- [ ] `lambda/injections/post.js`
- [ ] `lambda/vials/post.js`
- [ ] `lambda/weights/post.js`
- [ ] `lambda/vials/patch.js`

**Verification**:
- [ ] snake_case requests → 400 error
- [ ] camelCase requests → 200 success

---

### Step 5.3: Remove Frontend Transformation Layer

**Location**: `js/api-client.js`

**Change**: Remove `transformEnabled` conditionals

**OLD**:
```javascript
let body = injection;
if (this.transformEnabled && window.migrationUtils) {
    body = window.migrationUtils.toBackend(injection, 'injection');
}
```

**NEW**:
```javascript
const body = injection; // Always camelCase
```

**Verification**:
- [ ] All API calls use camelCase
- [ ] No transformation overhead

---

### Step 5.4: Remove `getFieldValue()` Helper

**Location**: InjectionTracker class

**Change**: Replace all `getFieldValue()` calls with direct property access

**OLD**:
```javascript
const doseMg = this.getFieldValue(inj, 'doseMg');
```

**NEW**:
```javascript
const doseMg = inj.doseMg;
```

**Verification**:
- [ ] All calculations use direct access
- [ ] All UI rendering uses direct access
- [ ] No getFieldValue() calls remaining

---

### Step 5.5: Archive Migration Code

**Purpose**: Keep migration code for reference but remove from production

**Actions**:
- [ ] Move `js/migration-utils.js` to `js/archive/migration-utils.js`
- [ ] Remove `<script src="js/migration-utils.js"></script>` from index.html
- [ ] Remove migration UI from Settings page
- [ ] Keep migration logs in localStorage for debugging

**Verification**:
- [ ] Migration code not loaded
- [ ] App works without migration utilities

---

## Rollback Procedures

### Rollback from Phase 2 (Backend Migration)

**If**: Lambda errors > 10%

**Steps**:
1. Revert Lambda functions to previous version
   ```bash
   cd reta-cloud-infrastructure
   git checkout <previous-commit>
   npx cdk deploy --profile reta-admin
   ```

2. Verify Lambda logs show errors resolved

3. Investigate errors before retrying migration

---

### Rollback from Phase 3 (Dual-Schema)

**If**: Data corruption or calculation errors

**Steps**:
1. Roll back frontend to previous version
   ```bash
   git checkout <previous-commit>
   aws s3 cp index.html s3://retatrutide-frontend-372208783486/ --profile reta-admin
   aws cloudfront create-invalidation --distribution-id E2ZD0ACBBK8F5K --paths "/*" --profile reta-admin
   ```

2. Users' data in localStorage is unchanged (no backend sync happened)

3. No data loss - users continue with snake_case

---

### Rollback from Phase 4 (Frontend Migration)

**If**: User reports data loss or sync issues

**Steps**:
1. User restores from backup:
   ```javascript
   // In browser console
   const backups = await window.tracker.listBackups();
   const latestBackup = backups[0];
   await window.tracker.restoreFromBackup(latestBackup.id);
   ```

2. Set schema version back to snake_case:
   ```javascript
   localStorage.setItem('schema_version', 'snake_case');
   location.reload();
   ```

3. Disable transform mode:
   ```javascript
   window.tracker.apiClient.setTransformMode(false);
   ```

**Verification**:
- [ ] Data restored from backup
- [ ] App works in snake_case mode
- [ ] User can continue normal operation

---

## Testing Strategy

### Test 1: New User (No Existing Data)

**Setup**: Clear all localStorage

**Steps**:
1. Open app in incognito window
2. Sign in with test account
3. Add 1 injection (camelCase should be created)
4. Verify in localStorage: `dose_mg` field does NOT exist
5. Verify in localStorage: `doseMg` field DOES exist
6. Add 1 vial, 1 weight
7. Verify all entities use camelCase

**Expected**: All new entities created in camelCase

---

### Test 2: Existing User (Legacy Data)

**Setup**: Load localStorage with snake_case data

**Steps**:
1. Load test data:
   ```javascript
   localStorage.setItem('injections', JSON.stringify([
       { id: 'test-1', dose_mg: 4.0, injection_site: 'left_thigh', timestamp: '2024-10-29T10:00:00Z' }
   ]));
   localStorage.setItem('schema_version', 'snake_case');
   ```

2. Reload app
3. Verify injection displays correctly
4. Add new injection
5. Verify new injection created in snake_case (schema not migrated yet)
6. Run migration from Settings
7. Verify all data migrated to camelCase
8. Add new injection
9. Verify new injection created in camelCase

**Expected**:
- Legacy data readable
- New data created in current schema version
- Migration transforms all data

---

### Test 3: Mixed Data (Post-Migration Failure)

**Setup**: Mix of snake_case and camelCase data

**Steps**:
1. Load mixed test data
2. Verify calculations work correctly
3. Verify UI renders correctly
4. Verify sync works correctly

**Expected**: App handles mixed data gracefully using getFieldValue()

---

### Test 4: Cloud Sync During Migration

**Setup**: 2 devices, same user account

**Steps**:
1. Device A: Start with snake_case data
2. Device B: Start with snake_case data
3. Device A: Migrate to camelCase
4. Device A: Add new injection (camelCase)
5. Device B: Sync from cloud
6. Device B: Verify received injection in camelCase
7. Device B: Verify old data still in snake_case
8. Device B: Migrate to camelCase
9. Device B: Add new injection
10. Device A: Sync from cloud

**Expected**: Both devices end up with fully migrated camelCase data

---

### Test 5: Rollback After Migration

**Setup**: Migrated user wants to rollback

**Steps**:
1. Complete migration to camelCase
2. Create backup
3. Restore from pre-migration backup
4. Set schema_version to snake_case
5. Verify app works correctly
6. Verify sync still works

**Expected**: User can rollback and continue using snake_case

---

## Success Criteria

### Phase 1: Preparation
- [ ] Migration utilities tested and working
- [ ] Validation functions catch all edge cases
- [ ] Migration status tracking implemented

### Phase 2: Backend Migration
- [ ] Lambda functions accept both schemas
- [ ] CloudWatch shows both schemas being used
- [ ] No increase in error rate

### Phase 3: Dual-Schema Support
- [ ] App reads both schemas correctly
- [ ] Calculations work with mixed data
- [ ] Migration tool successfully migrates test data

### Phase 4: Frontend Migration
- [ ] > 95% of users migrated within 2 weeks
- [ ] No data loss reports
- [ ] CloudWatch shows majority camelCase usage

### Phase 5: Cleanup
- [ ] Backend only accepts camelCase
- [ ] Frontend only creates camelCase
- [ ] No performance regression
- [ ] Code complexity reduced

---

## Post-Migration Checklist

### Week 1 After Deployment
- [ ] Monitor CloudWatch for errors
- [ ] Check CloudWatch logs for schema usage ratio
- [ ] User feedback: Any migration issues reported?
- [ ] Data integrity: Run audit queries on DynamoDB

### Week 2 After Deployment
- [ ] Verify > 95% migration adoption
- [ ] Plan cleanup deployment
- [ ] Notify remaining users to migrate

### Week 3: Cleanup Deployment
- [ ] Remove dual-schema support from backend
- [ ] Remove transformation layer from frontend
- [ ] Archive migration code
- [ ] Update documentation

### Week 4: Verification
- [ ] Verify all API calls use camelCase
- [ ] Verify no snake_case data being created
- [ ] Performance check: Any improvements?
- [ ] User feedback: Any issues after cleanup?

---

## Risk Mitigation

### Risk: Data Loss During Migration

**Mitigation**:
- Automatic backup before migration
- Validation after each entity migration
- Rollback capability at every phase

**Detection**:
- Entity count before/after migration
- Validation errors logged
- User reports

**Response**:
- Restore from backup
- Set schema version to snake_case
- Investigate validation errors

---

### Risk: Multi-Device Sync Conflict

**Mitigation**:
- Timestamp-based conflict resolution
- Cloud as source of truth
- Transform layer handles both schemas

**Detection**:
- CloudWatch logs show sync errors
- User reports duplicate data

**Response**:
- Force sync from cloud
- Run migration on all devices
- Deduplicate if necessary

---

### Risk: Calculation Errors After Migration

**Mitigation**:
- getFieldValue() helper reads both schemas
- Extensive testing before deployment
- Gradual rollout

**Detection**:
- User reports incorrect values
- Automated tests fail
- CloudWatch shows calculation errors

**Response**:
- Rollback to dual-schema support
- Fix calculation bugs
- Redeploy with fixes

---

**End of Migration Plan**
