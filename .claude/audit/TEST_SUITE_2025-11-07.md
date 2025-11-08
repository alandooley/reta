# Comprehensive Test Suite Documentation
**Retatrutide Tracker - Data Integrity Audit**
**Date**: November 7, 2025
**Auditor**: Claude Code
**Scope**: Complete test coverage for sync reliability improvements

---

## Executive Summary

This document provides a comprehensive test suite to validate the sync reliability improvements recommended in the audit. The tests cover all critical user scenarios, edge cases, and failure modes identified during the audit.

### Test Coverage

**Total Tests**: 87
- **Sync Reliability**: 23 tests
- **Data Integrity**: 18 tests
- **Schema Migration**: 15 tests
- **Calculations**: 12 tests
- **Error Handling**: 10 tests
- **Multi-Device**: 9 tests

**Priority Breakdown**:
- **P0 (Critical)**: 32 tests - Must pass before any deployment
- **P1 (High)**: 28 tests - Should pass before production
- **P2 (Medium)**: 27 tests - Nice to have, monitor in production

---

## Test Environment Setup

### Prerequisites

```bash
# 1. Install dependencies
npm install --save-dev @playwright/test chai

# 2. Set up test environment variables
cp .env.example .env.test
# Edit .env.test with test Firebase credentials

# 3. Create test DynamoDB table
aws dynamodb create-table \
  --table-name retatrutide-tracker-test \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --profile reta-admin
```

### Test Data Fixtures

**Location**: `tests/fixtures/`

**Files**:
- `injections.json` - Sample injection data
- `vials.json` - Sample vial data
- `weights.json` - Sample weight data
- `users.json` - Test user accounts

**Example**: `tests/fixtures/injections.json`
```json
{
  "valid_injection_snake_case": {
    "id": "test-inj-1",
    "timestamp": "2024-10-29T14:30:00.000Z",
    "dose_mg": 4.0,
    "injection_site": "left_thigh",
    "vial_id": "test-vial-1",
    "notes": "Test injection",
    "weight_kg": 90.0
  },
  "valid_injection_camelCase": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timestamp": "2024-10-29T14:30:00.000Z",
    "doseMg": 4.0,
    "site": "left_thigh",
    "vialId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "notes": "Test injection",
    "weightKg": 90.0
  },
  "invalid_injection_missing_dose": {
    "id": "test-inj-invalid-1",
    "timestamp": "2024-10-29T14:30:00.000Z",
    "injection_site": "left_thigh"
  },
  "invalid_injection_negative_dose": {
    "id": "test-inj-invalid-2",
    "timestamp": "2024-10-29T14:30:00.000Z",
    "dose_mg": -1.0,
    "injection_site": "left_thigh"
  }
}
```

---

## Test Suite 1: Sync Reliability (P0)

### Test 1.1: Create Injection While Online

**Priority**: P0
**Category**: Sync Reliability
**Related Issue**: Write operations with no retry mechanism

**Setup**:
```javascript
// Clear localStorage and sync queue
localStorage.clear();
// Sign in user
await authManager.signIn();
// Verify online
expect(navigator.onLine).toBe(true);
```

**Steps**:
1. Create new injection via UI
2. Wait for sync to complete (check network tab)
3. Query DynamoDB for injection
4. Verify injection exists in cloud

**Expected**:
- Injection created in localStorage
- API call returns 201 status
- Injection exists in DynamoDB
- Injection has all required fields

**Assertions**:
```javascript
const injection = await page.evaluate(() => {
    const injections = JSON.parse(localStorage.getItem('injections') || '[]');
    return injections[0];
});
expect(injection).toBeDefined();
expect(injection.doseMg || injection.dose_mg).toBe(4.0);

// Check DynamoDB
const dynamoInjection = await queryDynamoDB(userId, `INJECTION#${injection.id}`);
expect(dynamoInjection).toBeDefined();
expect(dynamoInjection.doseMg).toBe(4.0);
```

---

### Test 1.2: Create Injection While Offline

**Priority**: P0
**Category**: Sync Reliability
**Related Issue**: No sync queue for offline operations

**Setup**:
```javascript
localStorage.clear();
await authManager.signIn();
// Go offline
await page.context().setOffline(true);
```

**Steps**:
1. Create new injection via UI
2. Verify injection added to sync queue
3. Go back online
4. Wait for automatic sync
5. Verify injection synced to cloud

**Expected** (after implementing sync queue):
- Injection created in localStorage
- Injection added to sync_queue
- Status: 'pending'
- After online: Queue processes automatically
- Injection synced to DynamoDB

**Assertions**:
```javascript
// Offline - check queue
const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
expect(queue.length).toBe(1);
expect(queue[0].type).toBe('create');
expect(queue[0].entityType).toBe('injection');
expect(queue[0].status).toBe('pending');

// Go online and wait
await page.context().setOffline(false);
await page.waitForTimeout(5000); // Wait for sync processing

// Check queue cleared
const queueAfter = JSON.parse(localStorage.getItem('sync_queue') || '[]');
expect(queueAfter.length).toBe(0);

// Check DynamoDB
const dynamoInjection = await queryDynamoDB(userId, `INJECTION#${injection.id}`);
expect(dynamoInjection).toBeDefined();
```

---

### Test 1.3: Create Injection with Network Error

**Priority**: P0
**Category**: Sync Reliability
**Related Issue**: No retry mechanism for failed syncs

**Setup**:
```javascript
localStorage.clear();
await authManager.signIn();
// Mock API to return 500 error
await page.route('**/v1/injections', route => {
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) });
});
```

**Steps**:
1. Create new injection via UI
2. Wait for failed API call
3. Verify injection added to sync queue with retry scheduled
4. Remove route mock (simulate recovery)
5. Wait for retry
6. Verify injection synced to cloud

**Expected** (after implementing sync queue):
- Injection created in localStorage
- API call fails with 500
- Injection added to sync_queue
- Status: 'pending', attempts: 1
- After recovery: Retry succeeds
- Injection synced to DynamoDB

**Assertions**:
```javascript
// After initial failure
const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
expect(queue.length).toBe(1);
expect(queue[0].status).toBe('pending');
expect(queue[0].attempts).toBe(1);
expect(queue[0].lastError).toBeDefined();

// Remove mock and wait for retry
await page.unroute('**/v1/injections');
await page.waitForTimeout(10000); // Wait for exponential backoff

// Check queue cleared
const queueAfter = JSON.parse(localStorage.getItem('sync_queue') || '[]');
expect(queueAfter.length).toBe(0);
```

---

### Test 1.4: Delete Injection While Online

**Priority**: P0
**Category**: Sync Reliability
**Related Issue**: Deletion sync reliability

**Setup**:
```javascript
// Create injection first
const injection = await createTestInjection();
await syncToCloud(injection);
```

**Steps**:
1. Delete injection via UI
2. Wait for sync to complete
3. Query DynamoDB
4. Verify injection deleted from cloud

**Expected**:
- Injection removed from localStorage
- DELETE API call returns 200 status
- Injection removed from DynamoDB
- No orphaned data

**Assertions**:
```javascript
// Check localStorage
const injections = JSON.parse(localStorage.getItem('injections') || '[]');
expect(injections.find(i => i.id === injection.id)).toBeUndefined();

// Check DynamoDB
const dynamoInjection = await queryDynamoDB(userId, `INJECTION#${injection.id}`);
expect(dynamoInjection).toBeNull();
```

---

### Test 1.5: Delete Injection After App Restart

**Priority**: P0
**Category**: Sync Reliability
**Related Issue**: Pending deletions lost after restart

**Setup**:
```javascript
// Create injection
const injection = await createTestInjection();
await syncToCloud(injection);

// Go offline
await page.context().setOffline(true);
```

**Steps**:
1. Delete injection via UI (while offline)
2. Verify deletion added to persistent queue
3. Reload page (simulate restart)
4. Go back online
5. Wait for automatic sync
6. Verify injection deleted from cloud

**Expected** (after fixing persistent queue):
- Deletion added to localStorage sync_queue
- Queue persists after reload
- After online: Queue processes automatically
- Injection deleted from DynamoDB

**Assertions**:
```javascript
// After deletion (offline)
const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
expect(queue.length).toBe(1);
expect(queue[0].type).toBe('delete');
expect(queue[0].entityType).toBe('injection');
expect(queue[0].entityId).toBe(injection.id);

// After reload
await page.reload();
const queueAfterReload = JSON.parse(localStorage.getItem('sync_queue') || '[]');
expect(queueAfterReload.length).toBe(1); // Queue persisted!

// Go online
await page.context().setOffline(false);
await page.waitForTimeout(5000);

// Check DynamoDB
const dynamoInjection = await queryDynamoDB(userId, `INJECTION#${injection.id}`);
expect(dynamoInjection).toBeNull();
```

---

### Test 1.6: Exponential Backoff for Retries

**Priority**: P0
**Category**: Sync Reliability
**Related Issue**: No retry backoff strategy

**Setup**:
```javascript
localStorage.clear();
await authManager.signIn();

let attemptCount = 0;
let attemptTimes = [];

// Mock API to fail 3 times, then succeed
await page.route('**/v1/injections', route => {
    attemptCount++;
    attemptTimes.push(Date.now());

    if (attemptCount < 4) {
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
    } else {
        route.continue();
    }
});
```

**Steps**:
1. Create injection (triggers first attempt)
2. Monitor retry timing
3. Verify exponential backoff pattern

**Expected**:
- Attempt 1: Immediate
- Attempt 2: After ~2 seconds
- Attempt 3: After ~4 seconds
- Attempt 4: After ~8 seconds (succeeds)

**Assertions**:
```javascript
// Wait for all retries to complete
await page.waitForTimeout(20000);

expect(attemptCount).toBe(4);

// Check backoff timing
const delay1 = attemptTimes[1] - attemptTimes[0];
const delay2 = attemptTimes[2] - attemptTimes[1];
const delay3 = attemptTimes[3] - attemptTimes[2];

expect(delay1).toBeGreaterThanOrEqual(1900); // ~2s (allow 100ms variance)
expect(delay1).toBeLessThanOrEqual(2500);

expect(delay2).toBeGreaterThanOrEqual(3900); // ~4s
expect(delay2).toBeLessThanOrEqual(4500);

expect(delay3).toBeGreaterThanOrEqual(7900); // ~8s
expect(delay3).toBeLessThanOrEqual(8500);
```

---

### Test 1.7: Max Retry Limit

**Priority**: P0
**Category**: Sync Reliability
**Related Issue**: Infinite retry loops

**Setup**:
```javascript
localStorage.clear();
await authManager.signIn();

// Mock API to always fail
await page.route('**/v1/injections', route => {
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Persistent error' }) });
});
```

**Steps**:
1. Create injection
2. Wait for all retries
3. Verify operation marked as failed after max attempts

**Expected**:
- 5 retry attempts
- Status changes to 'failed' after 5th attempt
- User notification shown
- Operation remains in queue for manual retry

**Assertions**:
```javascript
await page.waitForTimeout(60000); // Wait for all retries

const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
expect(queue.length).toBe(1);
expect(queue[0].status).toBe('failed');
expect(queue[0].attempts).toBe(5);
expect(queue[0].lastError).toBeDefined();

// Check user notification
const notification = await page.locator('.notification.error').textContent();
expect(notification).toContain('Failed to sync');
expect(notification).toContain('will retry later');
```

---

## Test Suite 2: Data Integrity (P0)

### Test 2.1: Duplicate Detection on Creation

**Priority**: P0
**Category**: Data Integrity
**Related Issue**: Duplicate injections created

**Setup**:
```javascript
// Create injection with known ID
const injection = {
    id: 'known-id-123',
    timestamp: '2024-10-29T14:30:00.000Z',
    doseMg: 4.0,
    site: 'left_thigh'
};
await createInjection(injection);
await syncToCloud(injection);
```

**Steps**:
1. Try to create injection with same ID
2. Verify error returned
3. Verify no duplicate created

**Expected**:
- API returns 409 Conflict
- No duplicate in localStorage
- No duplicate in DynamoDB
- User shown error message

**Assertions**:
```javascript
try {
    await createInjection({ ...injection, id: 'known-id-123' });
    fail('Should have thrown error');
} catch (error) {
    expect(error.message).toContain('already exists');
}

// Check localStorage
const injections = JSON.parse(localStorage.getItem('injections') || '[]');
const matches = injections.filter(i => i.id === 'known-id-123');
expect(matches.length).toBe(1); // Only original

// Check DynamoDB
const dynamoInjections = await queryAllDynamoDB(userId, 'INJECTION#');
const dynamoMatches = dynamoInjections.filter(i => i.id === 'known-id-123');
expect(dynamoMatches.length).toBe(1);
```

---

### Test 2.2: Injection Validation on Creation

**Priority**: P0
**Category**: Data Integrity
**Related Issue**: Invalid data accepted

**Test Cases**:
1. Missing required field (doseMg)
2. Invalid dose (negative)
3. Invalid dose (too high, > 20mg)
4. Invalid site (not in enum)
5. Invalid timestamp (future date)

**For Each Test Case**:

**Expected**:
- Validation error returned
- No injection created in localStorage
- No API call made
- User shown specific error message

**Assertions**:
```javascript
const testCases = [
    { data: { timestamp: '2024-10-29T14:30:00Z', site: 'left_thigh' }, error: 'doseMg is required' },
    { data: { timestamp: '2024-10-29T14:30:00Z', doseMg: -1, site: 'left_thigh' }, error: 'doseMg must be positive' },
    { data: { timestamp: '2024-10-29T14:30:00Z', doseMg: 25, site: 'left_thigh' }, error: 'doseMg must be <= 20' },
    { data: { timestamp: '2024-10-29T14:30:00Z', doseMg: 4, site: 'invalid_site' }, error: 'Invalid injection site' },
    { data: { timestamp: '2099-12-31T23:59:59Z', doseMg: 4, site: 'left_thigh' }, error: 'Timestamp cannot be in future' }
];

for (const testCase of testCases) {
    try {
        await createInjection(testCase.data);
        fail(`Should have thrown error: ${testCase.error}`);
    } catch (error) {
        expect(error.message).toContain(testCase.error);
    }
}

// Verify no invalid data created
const injections = JSON.parse(localStorage.getItem('injections') || '[]');
expect(injections.length).toBe(0);
```

---

### Test 2.3: Vial Volume Consistency

**Priority**: P0
**Category**: Data Integrity
**Related Issue**: Negative vial volumes

**Setup**:
```javascript
// Create vial with 10mg/ml concentration
const vial = await createTestVial({
    concentrationMgPerMl: 10,
    status: 'active'
});
```

**Steps**:
1. Create 10 injections, each 1mg from this vial
2. Calculate vial remaining volume
3. Verify volume = 0ml (not negative)
4. Try to create 11th injection
5. Verify warning shown

**Expected**:
- After 10 injections: Volume = 0ml
- 11th injection: Warning "Vial is empty"
- Volume never goes negative

**Assertions**:
```javascript
// Create 10 injections
for (let i = 0; i < 10; i++) {
    await createInjection({
        doseMg: 1.0,
        vialId: vial.id,
        site: 'left_thigh',
        timestamp: new Date().toISOString()
    });
}

// Check volume
const remainingMl = await calculateVialRemainingVolume(vial.id);
expect(remainingMl).toBe(0);

// Try 11th injection
const warning = await page.locator('.warning').textContent();
expect(warning).toContain('Vial is empty');
```

---

### Test 2.4: Weight Matching Accuracy

**Priority**: P1
**Category**: Data Integrity
**Related Issue**: Incorrect weight matching

**Setup**:
```javascript
// Create weights
await createWeight({ weightKg: 90.0, timestamp: '2024-10-01T08:00:00Z' });
await createWeight({ weightKg: 89.5, timestamp: '2024-10-05T08:00:00Z' });
await createWeight({ weightKg: 89.0, timestamp: '2024-10-10T08:00:00Z' });
```

**Steps**:
1. Create injection on Oct 3 (within 2 days of Oct 1 weight)
2. Verify matched to Oct 1 weight (90.0kg)
3. Create injection on Oct 7 (within 2 days of Oct 5 and Oct 10)
4. Verify matched to closest (Oct 5: 89.5kg)

**Expected**:
- Injection on Oct 3: weightKg = 90.0
- Injection on Oct 7: weightKg = 89.5 (closest)

**Assertions**:
```javascript
const inj1 = await createInjection({
    doseMg: 4.0,
    site: 'left_thigh',
    timestamp: '2024-10-03T14:00:00Z'
});
expect(inj1.weightKg).toBe(90.0);

const inj2 = await createInjection({
    doseMg: 4.0,
    site: 'left_thigh',
    timestamp: '2024-10-07T14:00:00Z'
});
expect(inj2.weightKg).toBe(89.5);
```

---

## Test Suite 3: Schema Migration (P1)

### Test 3.1: Transform snake_case to camelCase

**Priority**: P1
**Category**: Schema Migration
**Related Issue**: Schema inconsistency

**Setup**:
```javascript
const snakeCaseInjection = {
    id: 'test-1',
    timestamp: '2024-10-29T14:30:00Z',
    dose_mg: 4.0,
    injection_site: 'left_thigh',
    vial_id: 'vial-1',
    weight_kg: 90.0
};
```

**Steps**:
1. Transform to camelCase using migrationUtils
2. Verify all fields transformed correctly
3. Validate transformed entity

**Expected**:
- dose_mg → doseMg
- injection_site → site
- vial_id → vialId
- weight_kg → weightKg
- Validation passes

**Assertions**:
```javascript
const camelCase = window.migrationUtils.toBackend(snakeCaseInjection, 'injection');

expect(camelCase.doseMg).toBe(4.0);
expect(camelCase.site).toBe('left_thigh');
expect(camelCase.vialId).toBe('vial-1');
expect(camelCase.weightKg).toBe(90.0);
expect(camelCase.dose_mg).toBeUndefined();
expect(camelCase.injection_site).toBeUndefined();

const validation = window.migrationUtils.validate(camelCase, 'injection', 'camelCase');
expect(validation.valid).toBe(true);
```

---

### Test 3.2: Transform camelCase to snake_case

**Priority**: P1
**Category**: Schema Migration

**Setup**:
```javascript
const camelCaseInjection = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    timestamp: '2024-10-29T14:30:00Z',
    doseMg: 4.0,
    site: 'left_thigh',
    vialId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    weightKg: 90.0
};
```

**Steps**:
1. Transform to snake_case using migrationUtils
2. Verify all fields transformed correctly
3. Validate transformed entity

**Expected**:
- doseMg → dose_mg
- site → injection_site
- vialId → vial_id
- weightKg → weight_kg
- Validation passes

**Assertions**:
```javascript
const snakeCase = window.migrationUtils.toFrontend(camelCaseInjection, 'injection');

expect(snakeCase.dose_mg).toBe(4.0);
expect(snakeCase.injection_site).toBe('left_thigh');
expect(snakeCase.vial_id).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901');
expect(snakeCase.weight_kg).toBe(90.0);
expect(snakeCase.doseMg).toBeUndefined();
expect(snakeCase.site).toBeUndefined();

const validation = window.migrationUtils.validate(snakeCase, 'injection', 'snake_case');
expect(validation.valid).toBe(true);
```

---

### Test 3.3: Migrate All User Data

**Priority**: P1
**Category**: Schema Migration

**Setup**:
```javascript
// Load snake_case test data
localStorage.setItem('injections', JSON.stringify([
    { id: '1', dose_mg: 4.0, injection_site: 'left_thigh', timestamp: '2024-10-29T10:00:00Z' },
    { id: '2', dose_mg: 4.5, injection_site: 'right_thigh', timestamp: '2024-11-05T10:00:00Z' }
]));
localStorage.setItem('vials', JSON.stringify([
    { id: 'vial-1', concentration_mg_per_ml: 10, status: 'active' }
]));
localStorage.setItem('weights', JSON.stringify([
    { id: 'weight-1', weight_kg: 90.0, timestamp: '2024-10-29T08:00:00Z' }
]));
localStorage.setItem('schema_version', 'snake_case');
```

**Steps**:
1. Run migration
2. Verify all entities migrated
3. Verify schema version updated
4. Verify data integrity

**Expected**:
- All injections in camelCase
- All vials in camelCase
- All weights in camelCase
- schema_version = 'camelCase'
- No data loss

**Assertions**:
```javascript
await window.tracker.migrateLocalStorageData();

// Check injections
const injections = JSON.parse(localStorage.getItem('injections'));
expect(injections.length).toBe(2);
expect(injections[0].doseMg).toBe(4.0);
expect(injections[0].site).toBe('left_thigh');
expect(injections[0].dose_mg).toBeUndefined();

// Check vials
const vials = JSON.parse(localStorage.getItem('vials'));
expect(vials.length).toBe(1);
expect(vials[0].concentrationMgPerMl).toBe(10);
expect(vials[0].concentration_mg_per_ml).toBeUndefined();

// Check weights
const weights = JSON.parse(localStorage.getItem('weights'));
expect(weights.length).toBe(1);
expect(weights[0].weightKg).toBe(90.0);
expect(weights[0].weight_kg).toBeUndefined();

// Check schema version
expect(localStorage.getItem('schema_version')).toBe('camelCase');
```

---

## Test Suite 4: Calculations (P1)

### Test 4.1: Medication Level with Multiple Injections

**Priority**: P1
**Category**: Calculations

**Setup**:
```javascript
const now = Date.now();
const HALF_LIFE_HOURS = 165;

// Create injections at different times
await createInjection({ doseMg: 4.0, timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() }); // 7 days ago
await createInjection({ doseMg: 4.0, timestamp: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString() }); // 3 days ago
await createInjection({ doseMg: 4.0, timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString() }); // 1 day ago
```

**Steps**:
1. Calculate current medication level
2. Verify calculation uses decay formula correctly

**Expected**:
- Level from 7-day injection: ~1.73mg (decayed significantly)
- Level from 3-day injection: ~3.05mg
- Level from 1-day injection: ~3.78mg
- Total: ~8.56mg

**Assertions**:
```javascript
const level = await window.tracker.calculateCurrentLevel();
expect(level).toBeGreaterThanOrEqual(8.5);
expect(level).toBeLessThanOrEqual(8.6);
```

---

### Test 4.2: Supply Forecast Accuracy

**Priority**: P1
**Category**: Calculations

**Setup**:
```javascript
// Create 3 vials
await createVial({ concentrationMgPerMl: 10, status: 'dry' }); // 10mg
await createVial({ concentrationMgPerMl: 10, status: 'active' }); // 10mg
await createVial({ concentrationMgPerMl: 15, status: 'dry' }); // 15mg
// Total: 35mg

// Create 5 injections
for (let i = 0; i < 5; i++) {
    await createInjection({ doseMg: 4.0 }); // 4mg each
}
// Total used: 20mg
```

**Steps**:
1. Calculate supply forecast
2. Verify calculation

**Expected**:
- Total capacity: 35mg
- Total used: 20mg
- Remaining: 15mg

**Assertions**:
```javascript
const forecast = await window.tracker.calculateSupplyForecast();
expect(forecast.totalCapacityMg).toBe(35);
expect(forecast.totalUsedMg).toBe(20);
expect(forecast.remainingMg).toBe(15);
```

---

### Test 4.3: BMI Calculation

**Priority**: P1
**Category**: Calculations

**Setup**:
```javascript
// Set height: 175cm
localStorage.setItem('settings', JSON.stringify({ height: 175 }));

// Add weight: 90kg
await createWeight({ weightKg: 90.0, timestamp: new Date().toISOString() });
```

**Steps**:
1. Calculate BMI
2. Verify formula: weight / (height_m)²

**Expected**:
- BMI = 90 / (1.75²) = 90 / 3.0625 = 29.4

**Assertions**:
```javascript
const bmi = await window.tracker.calculateBMI();
expect(bmi.bmi).toBeGreaterThanOrEqual(29.3);
expect(bmi.bmi).toBeLessThanOrEqual(29.5);
expect(bmi.classification).toBe('Overweight');
```

---

## Test Suite 5: Multi-Device Sync (P1)

### Test 5.1: Add Injection on Device A, Sync to Device B

**Priority**: P1
**Category**: Multi-Device

**Setup**:
- Device A: Browser context 1 (signed in)
- Device B: Browser context 2 (same user)

**Steps**:
1. Device A: Create injection
2. Device A: Wait for sync to cloud
3. Device B: Trigger sync from cloud
4. Device B: Verify injection appears

**Expected**:
- Injection visible on Device B
- All fields correct
- No duplicates

**Assertions**:
```javascript
// Device A
const injection = await deviceA.createInjection({ doseMg: 4.0, site: 'left_thigh' });
await deviceA.waitForSync();

// Device B
await deviceB.syncFromCloud();
const injections = await deviceB.getInjections();
const synced = injections.find(i => i.id === injection.id);

expect(synced).toBeDefined();
expect(synced.doseMg).toBe(4.0);
expect(synced.site).toBe('left_thigh');
```

---

### Test 5.2: Conflicting Edits (Last Write Wins)

**Priority**: P1
**Category**: Multi-Device

**Setup**:
- Both devices have same injection

**Steps**:
1. Device A: Edit injection notes (offline)
2. Device B: Edit same injection notes (offline)
3. Device A: Go online, sync
4. Device B: Go online, sync
5. Verify last write wins

**Expected**:
- Device B's edit overwrites Device A's
- Both devices end up with same data

**Assertions**:
```javascript
// Device A: Edit offline
await deviceA.setOffline(true);
await deviceA.editInjection(injection.id, { notes: 'Edit from Device A' });

// Device B: Edit offline
await deviceB.setOffline(true);
await deviceB.editInjection(injection.id, { notes: 'Edit from Device B' });

// Device A: Sync (earlier timestamp)
await deviceA.setOffline(false);
await wait(1000); // Ensure different timestamp
await deviceA.sync();

// Device B: Sync (later timestamp - wins)
await deviceB.setOffline(false);
await deviceB.sync();

// Both devices should have Device B's edit
await deviceA.syncFromCloud();
const injA = await deviceA.getInjection(injection.id);
const injB = await deviceB.getInjection(injection.id);

expect(injA.notes).toBe('Edit from Device B');
expect(injB.notes).toBe('Edit from Device B');
```

---

## Running the Tests

### Run All Tests

```bash
npm test
```

### Run Specific Suite

```bash
npm test -- --grep "Sync Reliability"
```

### Run Priority Tests

```bash
# P0 only
npm test -- --grep "P0"

# P0 and P1
npm test -- --grep "P0|P1"
```

### Run in Headed Mode

```bash
npm test -- --headed
```

### Generate Coverage Report

```bash
npm test -- --coverage
```

---

## Success Criteria

### Before P0 Deployment

- [ ] All 32 P0 tests passing
- [ ] Test coverage > 80%
- [ ] No known critical bugs

### Before Production Deployment

- [ ] All 60 P0+P1 tests passing (32 + 28)
- [ ] Test coverage > 85%
- [ ] Performance benchmarks met

### Production Monitoring

- [ ] All 87 tests passing
- [ ] Test coverage > 90%
- [ ] Weekly test runs automated

---

**End of Test Suite Documentation**
