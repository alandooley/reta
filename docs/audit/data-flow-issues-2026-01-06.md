# Data Flow Integrity Audit Report

**Date**: 2026-01-06
**Auditor**: Claude Code
**Codebase**: TRT Tracker (RTracker)
**Status**: Issues Identified - Remediation Required

---

## Executive Summary

This audit identifies **6 critical data flow integrity issues** that cause data loss, calculation errors, and sync failures. The root cause is inconsistent property naming conventions across the localStorage → API → DynamoDB → UI data pipeline.

**Priority Order** (Critical first, then by effort):

| # | Issue | Severity | Effort | Risk |
|---|-------|----------|--------|------|
| 1 | Settings sync incomplete (TRT settings not bidirectional) | CRITICAL | S | Data loss on device switch |
| 2 | Concentration field naming chaos (3 variants) | CRITICAL | M | Calculations produce NaN |
| 3 | Cloud sync merge deduplication broken | MAJOR | M | Duplicate/orphaned records |
| 4 | Vial ID inconsistency (vial_id vs id vs vialId) | MAJOR | M | Injections orphaned from vials |
| 5 | Dose calculation property mismatch | MAJOR | S | Wrong dose stored |
| 6 | API response concentration variants | MAJOR | S | Bulk sync breaks field mapping |

---

## Issue #1: Settings Sync Incomplete (TRT Settings Not Bidirectional)

### Severity: CRITICAL

### Description
TRT settings are sent TO the cloud but never received BACK from cloud. Users lose TRT configuration when switching devices.

### Data Flow Trace

```
[BROKEN PATH - Settings FROM Cloud]

1. User logs in on new device
2. Frontend calls apiClient.getSettings()
3. Lambda /v1/settings GET returns:
   {
     heightCm: 180,
     trtSettings: {
       injectionFrequency: 3.5,
       concentrationMgMl: 200,
       defaultDoseMl: 0.5
     }
   }
4. Frontend receives response at syncSettingsFromCloud() [index.html:4886-4931]
5. ONLY processes: heightCm, goalWeightKg, defaultDose, injectionFrequencyDays
6. trtSettings in response is IGNORED - never merged to this.data.trtSettings
7. User sees default TRT settings, not their saved cloud settings
```

### Files Affected

| File | Line Numbers | Issue |
|------|--------------|-------|
| `index.html` | 4886-4931 | `syncSettingsFromCloud()` ignores `trtSettings` in response |
| `index.html` | 4944-4961 | `syncSettingsToCloud()` correctly sends trtSettings |
| `lambda/settings/index.js` | 100-106 | GET correctly returns trtSettings |
| `lambda/settings/index.js` | 153-157 | POST correctly stores trtSettings |

### Root Cause
Asymmetric implementation: upload code exists, download code was never written.

### Proposed Fix

**File**: `index.html`
**Location**: After line 4908 in `syncSettingsFromCloud()`

```javascript
// Add after existing settings sync (line 4908):
if (cloudSettings.trtSettings) {
    const trt = cloudSettings.trtSettings;
    if (trt.injectionFrequency !== null) {
        this.data.trtSettings.injectionFrequency = trt.injectionFrequency;
    }
    if (trt.concentrationMgMl !== null) {
        this.data.trtSettings.concentrationMgMl = trt.concentrationMgMl;
    }
    if (trt.defaultDoseMl !== null) {
        this.data.trtSettings.defaultDoseMl = trt.defaultDoseMl;
    }
    if (trt.defaultDoseMg !== null) {
        this.data.trtSettings.defaultDoseMg = trt.defaultDoseMg;
    }
    if (trt.injectionSites !== null) {
        this.data.trtSettings.injectionSites = trt.injectionSites;
    }
}
```

### Risk If Not Fixed
- Users lose TRT configuration on device switch
- Support tickets for "my settings disappeared"
- Data inconsistency between devices

### Effort Estimate: **S (Small)** - ~20 lines of code, single file

---

## Issue #2: Concentration Field Naming Chaos

### Severity: CRITICAL

### Description
Three different property names used for the same data across the codebase:
- `concentration_mg_ml` (localStorage/frontend - snake_case)
- `concentrationMgMl` (some API endpoints - camelCase variant 1)
- `concentrationMgPerMl` (sync endpoint - camelCase variant 2)

### Data Flow Trace

```
[BROKEN PATH - Vial Creation → Sync → Calculation]

1. User creates vial in UI
2. Frontend stores: { concentration_mg_ml: 200 }               [index.html:5173]
3. Cloud-storage converts: { concentrationMgPerMl: 200 }       [cloud-storage.js:130]
4. API POST /v1/vials receives concentrationMgPerMl
5. Lambda stores in DynamoDB: { concentrationMgMl: 200 }       [vials/post.js:75]
   ^^^ MISMATCH: received MgPerMl, stored MgMl
6. API GET /v1/vials returns: { concentration_mg_ml: 200 }     [vials/get.js:49]
   (via fallback: item.concentrationMgMl || item.concentration_mg_ml)
7. Frontend receives and merges to local storage
8. Supply forecast calculation at line 10774:
   vial.concentration_mg_ml ? ((remainingMl * vial.concentration_mg_ml)...)
9. If field name wrong or undefined → calculation returns 0 or NaN
```

### Files Affected

| File | Line Numbers | Variant Used |
|------|--------------|--------------|
| `index.html` | 5173, 5223, 5274, 5302, 5353, 6052, 6059, 6196, 7250, 7769, 7874, 8916, 9202, 9421, 9524, 9671, 9892, 9945, 9949, 10012, 10139, 10186, 10202, 10287, 10502, 10503, 10508, 10774, 10791, 10810, 10901, 12696 | `concentration_mg_ml` |
| `js/cloud-storage.js` | 130 | `concentrationMgPerMl` |
| `js/cloud-storage.js` | 364 | `concentrationMgMl` |
| `lambda/vials/post.js` | 75, 114 | Stores `concentrationMgMl`, returns `concentration_mg_ml` |
| `lambda/vials/get.js` | 49 | Fallback logic for both |
| `lambda/sync/index.js` | 53 | `concentrationMgPerMl` |
| `lambda/trt/vials/post.js` | 100, 132 | `concentrationMgMl` |

### Root Cause
- No canonical data mapper between localStorage format and API format
- Different developers used different naming conventions
- Fallback logic masks the problem until edge cases hit

### Proposed Fix

**Step 1**: Create data mapper utility

**File**: `js/data-mapper.js` (NEW FILE)

```javascript
// Canonical property mappings: localStorage (snake) ↔ API (camel)
const PROPERTY_MAP = {
    // Vial properties
    concentration_mg_ml: 'concentrationMgMl',
    current_volume_ml: 'currentVolumeMl',
    initial_volume_ml: 'initialVolumeMl',
    vial_id: 'vialId',

    // Injection properties
    dose_mg: 'doseMg',
    volume_ml: 'volumeMl',
    injection_site: 'site',

    // Weight properties
    weight_kg: 'weightKg',
};

export function toApiFormat(localData) {
    const result = {};
    for (const [key, value] of Object.entries(localData)) {
        const apiKey = PROPERTY_MAP[key] || key;
        result[apiKey] = value;
    }
    return result;
}

export function toLocalFormat(apiData) {
    const reverseMap = Object.fromEntries(
        Object.entries(PROPERTY_MAP).map(([k, v]) => [v, k])
    );
    const result = {};
    for (const [key, value] of Object.entries(apiData)) {
        const localKey = reverseMap[key] || key;
        result[localKey] = value;
    }
    return result;
}
```

**Step 2**: Update cloud-storage.js to use mapper consistently

**Step 3**: Update Lambda endpoints to use consistent camelCase internally

**Step 4**: Add validation that all required fields exist after transformation

### Risk If Not Fixed
- Supply forecast shows 0mg remaining when vials have product
- Concentration displays as "undefinedmg/ml" in UI
- Vial selection dropdowns missing concentration info
- Calculation errors produce NaN

### Effort Estimate: **M (Medium)** - New utility file + updates to 8 files

---

## Issue #3: Cloud Sync Merge Deduplication Broken

### Severity: MAJOR

### Description
The `mergeArrays()` function has multiple flaws that cause duplicates, orphaned records, and race conditions with pending deletions.

### Data Flow Trace

```
[BROKEN PATH - Concurrent Sync]

1. User deletes vial locally
2. Deletion added to _pendingDeletions with 2-minute TTL    [index.html:3938]
3. Sync starts, DELETE request sent to API
4. Network slow, takes 90 seconds
5. Meanwhile, another sync triggered (e.g., tab focus)
6. Second sync calls mergeArrays() for vials
7. Cloud still has deleted vial (DELETE not completed yet)
8. mergeArrays checks: _pendingDeletions.has(vialId)? YES → skip
9. DELETE completes successfully
10. 30 seconds later (still within 2-min TTL), third sync
11. Cloud now missing the vial (DELETE worked)
12. But _pendingDeletions.has(vialId)? YES → skip adding from cloud (correct)
13. 60 seconds later, TTL expires, vialId removed from _pendingDeletions
14. Fourth sync happens
15. mergeArrays: vial not in cloud, not in pending → LOST

[BROKEN PATH - keyField Mismatch]

1. API returns vials with { id: "uuid-123" }
2. mergeArrays called with keyField='vial_id'
3. item['vial_id'] is undefined (API returned 'id')
4. merged.set(undefined, item) → All vials collapse to single entry
5. Result: Only last vial survives in merged array
```

### Files Affected

| File | Line Numbers | Issue |
|------|--------------|-------|
| `index.html` | 4701-4748 | `mergeArrays()` flawed logic |
| `index.html` | 4862-4866 | Calls with different keyFields |
| `index.html` | 3922-3965 | Pending deletion management |
| `index.html` | 3938-3941 | 120s TTL too short |

### Root Cause
- Boolean `cloudSynced` flag doesn't track which version synced
- Pending deletion TTL (2 minutes) doesn't account for slow networks
- keyField parameter assumes consistent property names (broken by Issue #2)
- No timestamp-based conflict resolution

### Proposed Fix

**Step 1**: Add timestamp-based conflict resolution

```javascript
mergeArrays(localData, cloudData, keyField) {
    const merged = new Map();

    // Build lookup maps
    const localMap = new Map(localData.map(item => [item[keyField], item]));
    const cloudMap = new Map(cloudData.map(item => [item[keyField], item]));

    // All unique keys
    const allKeys = new Set([...localMap.keys(), ...cloudMap.keys()]);

    for (const key of allKeys) {
        if (this._pendingDeletions.has(key)) continue;

        const local = localMap.get(key);
        const cloud = cloudMap.get(key);

        if (local && cloud) {
            // Both exist: use newer based on updatedAt timestamp
            const localTime = new Date(local.updatedAt || 0).getTime();
            const cloudTime = new Date(cloud.updatedAt || 0).getTime();
            merged.set(key, localTime > cloudTime ? local : cloud);
        } else if (local && !cloud) {
            // Only local: keep if not yet synced
            if (!local.cloudSynced) {
                merged.set(key, local);
            }
            // If cloudSynced but not in cloud, it was deleted on another device
        } else if (cloud && !local) {
            // Only cloud: add to local
            merged.set(key, { ...cloud, cloudSynced: true });
        }
    }

    return Array.from(merged.values());
}
```

**Step 2**: Increase pending deletion TTL to 10 minutes

**Step 3**: Add keyField normalization before merge

### Risk If Not Fixed
- Duplicate injections appear in log
- Deleted vials reappear after TTL expires
- Vials and injections become disconnected
- Data loss when concurrent edits happen

### Effort Estimate: **M (Medium)** - Refactor merge function + add timestamp logic

---

## Issue #4: Vial ID Inconsistency

### Severity: MAJOR

### Description
Vials are identified by different property names in different contexts:
- `vial_id` (Retatrutide frontend localStorage)
- `id` (TRT vials, some API responses)
- `vialId` (API request bodies)

### Data Flow Trace

```
[BROKEN PATH - Injection References Wrong Vial]

1. User creates Reta vial, stored as: { vial_id: "vial_20241029_1" }
2. Vial synced to cloud via POST /v1/vials
3. Lambda returns: { id: "vial_20241029_1", vial_id: "vial_20241029_1" }
4. User creates injection, references: { vial_id: "vial_20241029_1" }
5. Injection synced with: { vialId: "vial_20241029_1" }
6. Later, GET /v1/vials returns only { id: "..." } (no vial_id)
7. mergeArrays with keyField='vial_id' doesn't find match
8. Vial appears twice: once with vial_id, once with id
9. Injection references vial_id but vial now has id
10. getVialById(injection.vial_id) returns undefined
11. "Level at Last Shot" shows "No vial selected"
```

### Files Affected

| File | Line Numbers | Variant Used |
|------|--------------|--------------|
| `index.html` | 4585-4589 | Defensive `getVialId()` handles both |
| `index.html` | 4683-4694 | Vial lookup by both formats |
| `index.html` | 4812, 4864 | mergeArrays with 'vial_id' key |
| `index.html` | 5010, 5062, 5077, 5169-5170 | Creation uses vial_id |
| `lambda/vials/post.js` | 105-106 | Returns both id and vial_id |
| `lambda/vials/get.js` | 43 | Returns vial_id with fallback |
| `lambda/trt/vials/post.js` | 131 | Returns only id |

### Root Cause
- Two vial systems (Reta and TRT) designed at different times
- API inconsistency: POST returns both, GET returns one
- No normalization in api-client.js

### Proposed Fix

**Step 1**: Normalize vial ID in api-client.js response handling

```javascript
// In api-client.js, after receiving vials:
function normalizeVialIds(vials) {
    return vials.map(vial => ({
        ...vial,
        vial_id: vial.vial_id || vial.id,
        id: vial.id || vial.vial_id,
    }));
}
```

**Step 2**: Update Lambda GET endpoints to always return both fields

**Step 3**: Use consistent keyField in mergeArrays (always 'id' or always 'vial_id')

### Risk If Not Fixed
- Injections become orphaned from vials
- Vial updates silently fail
- Supply forecast shows wrong remaining amounts
- "Level at Last Shot" breaks

### Effort Estimate: **M (Medium)** - Update 6 files with normalization

---

## Issue #5: Dose Calculation Property Mismatch

### Severity: MAJOR

### Description
Retatrutide and TRT injections handle dose calculation differently:
- Reta: Frontend calculates `dose_mg = volume_ml × concentration_mg_ml`
- TRT: Server calculates `doseMg = volumeMl × concentrationMgMl`

If either system receives data in the wrong format, calculations fail.

### Data Flow Trace

```
[BROKEN PATH - Reta Dose After Concentration Change]

1. User creates vial with concentration_mg_ml: 10
2. Creates injection: volume_ml: 0.5, dose_mg: 5 (calculated)
3. User edits vial, changes concentration to 20
4. Original injection still has dose_mg: 5 (not recalculated)
5. Expected dose for 0.5ml @ 20mg/ml = 10mg, but shows 5mg
6. Results page calculations use stale dose_mg value
```

### Files Affected

| File | Line Numbers | Issue |
|------|--------------|-------|
| `index.html` | 5062 | Reta injection stores pre-calculated dose |
| `index.html` | 5608 | Dose calculation formula |
| `lambda/trt/injections/post.js` | 158 | Server calculates dose |
| `lambda/injections/post.js` | 112 | Server trusts frontend dose |

### Root Cause
- Inconsistent architecture: Reta trusts frontend, TRT trusts server
- No recalculation when vial concentration changes
- No validation that frontend dose matches expected value

### Proposed Fix

**Option A**: Server always recalculates (preferred)

Update `lambda/injections/post.js` to compute dose server-side like TRT does.

**Option B**: Add recalculation trigger on vial edit

When vial concentration changes, recalculate all injection doses for that vial.

### Risk If Not Fixed
- Dose values become stale after vial edits
- Results page calculations wrong
- Supply forecast inaccurate

### Effort Estimate: **S (Small)** - Add 10 lines to Lambda or frontend

---

## Issue #6: API Response Concentration Variants

### Severity: MAJOR

### Description
The sync endpoint uses `concentrationMgPerMl` but individual POST endpoints use `concentrationMgMl`. This creates items in DynamoDB with different field names.

### Data Flow Trace

```
[BROKEN PATH - Bulk Sync vs Individual Create]

1. User creates vial via UI → POST /v1/vials
2. Lambda stores: { concentrationMgMl: 200 }
3. Later, full sync via POST /v1/sync
4. Sync Lambda stores: { concentrationMgPerMl: 200 }
5. GET /v1/vials has fallback: item.concentrationMgMl || item.concentration_mg_ml
6. Vial from sync has concentrationMgPerMl → fallback fails
7. Concentration returns undefined
```

### Files Affected

| File | Line Numbers | Field Name |
|------|--------------|------------|
| `lambda/sync/index.js` | 53 | `concentrationMgPerMl` |
| `lambda/vials/post.js` | 75 | `concentrationMgMl` |
| `lambda/vials/get.js` | 49 | Fallback doesn't include MgPerMl |

### Root Cause
- Sync endpoint developed separately from CRUD endpoints
- No shared schema definition across Lambdas

### Proposed Fix

**Step 1**: Update sync/index.js to use `concentrationMgMl`

```javascript
// Change line 53 from:
concentrationMgPerMl: vial.concentrationMgPerMl || vial.concentration_mg_ml,
// To:
concentrationMgMl: vial.concentrationMgMl || vial.concentrationMgPerMl || vial.concentration_mg_ml,
```

**Step 2**: Update vials/get.js fallback to include all variants

```javascript
concentration_mg_ml: item.concentrationMgMl || item.concentrationMgPerMl || item.concentration_mg_ml,
```

**Step 3**: Create shared Lambda layer with schema definitions

### Risk If Not Fixed
- Bulk sync creates items with wrong field names
- GET endpoint returns undefined for synced items
- Calculation failures after migration/sync

### Effort Estimate: **S (Small)** - Update 3 Lambda files

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)

| Issue | Fix | Files | Effort |
|-------|-----|-------|--------|
| #1 Settings sync | Add TRT settings receive code | index.html | S |
| #5 Dose calculation | Add server-side validation | Lambda | S |
| #6 API concentration | Align field names | 3 Lambdas | S |

### Phase 2: Data Mapper (Week 2)

| Issue | Fix | Files | Effort |
|-------|-----|-------|--------|
| #2 Concentration chaos | Create data-mapper.js | New + 8 files | M |
| #4 Vial ID | Add normalization | api-client.js + Lambdas | M |

### Phase 3: Sync Refactor (Week 3)

| Issue | Fix | Files | Effort |
|-------|-----|-------|--------|
| #3 Merge logic | Timestamp-based conflict resolution | index.html | M |

---

## Validation Checklist

After implementing fixes, validate with these tests:

- [ ] Create vial, sync, edit concentration, sync again → calculations correct
- [ ] Create injection, switch devices, verify dose matches
- [ ] Change TRT settings, log out, log in on new device → settings preserved
- [ ] Delete vial, immediately sync twice → no vial reappearance
- [ ] Create vial via UI, then bulk sync → concentration field consistent
- [ ] Verify mergeArrays produces no duplicates with 100 items

---

## Appendix: Full File Impact Matrix

| File | Issues | Total Lines Affected |
|------|--------|---------------------|
| `index.html` | #1, #2, #3, #4, #5 | ~100 lines |
| `js/cloud-storage.js` | #2 | ~20 lines |
| `js/api-client.js` | #4 | ~15 lines |
| `lambda/vials/post.js` | #2, #4, #6 | ~10 lines |
| `lambda/vials/get.js` | #2, #4, #6 | ~10 lines |
| `lambda/sync/index.js` | #6 | ~5 lines |
| `lambda/settings/index.js` | #1 | 0 (already correct) |
| `lambda/injections/post.js` | #5 | ~10 lines |
| `lambda/trt/vials/post.js` | #2 | ~5 lines |
| **NEW: js/data-mapper.js** | #2 | ~50 lines |

**Total estimated changes**: ~225 lines across 10 files
