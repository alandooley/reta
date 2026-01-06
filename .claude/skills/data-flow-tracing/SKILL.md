---
name: data-flow-tracing
description: "RETA-specific skill for tracing data through the complete stack: UI → localStorage → API → Lambda → DynamoDB → sync merge → UI. Use when debugging data issues or implementing CRUD features."
---

# RETA Data Flow Tracing Skill

## Core Principle

**Data in RETA flows through 6 layers with TWO naming conventions.**

Every data issue stems from a break in this chain. Trace systematically.

## The Data Flow Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RETA DATA FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. UI INPUT                          (User enters data)                     │
│       ↓                                                                      │
│  2. JAVASCRIPT (InjectionTracker)     (snake_case: dose_mg, vial_id)        │
│       ↓                                                                      │
│  3. LOCAL STORAGE                     (snake_case: persisted locally)        │
│       ↓                                                                      │
│  4. API CLIENT (js/api-client.js)     (transforms to camelCase)             │
│       ↓                                                                      │
│  5. LAMBDA HANDLER                    (camelCase: doseMg, vialId)           │
│       ↓                                                                      │
│  6. DYNAMODB                          (camelCase: stored in cloud)          │
│       ↓                                                                      │
│  7. SYNC MERGE                        (bidirectional, handles conflicts)     │
│       ↓                                                                      │
│  8. UI UPDATE                         (snake_case displayed to user)         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Naming Convention Mapping

### CRITICAL: Two Formats Exist

| Entity | localStorage/JS (snake_case) | API/DynamoDB (camelCase) |
|--------|------------------------------|--------------------------|
| Injection dose | `dose_mg` | `doseMg` |
| Injection site | `injection_site` | `site` |
| Vial ID reference | `vial_id` | `vialId` |
| Concentration | `concentration_mg_ml` | `concentrationMgPerMl` |
| Current volume | `current_volume_ml` | `currentVolumeMl` |
| Initial volume | `initial_volume_ml` | `initialVolumeMl` |
| Weight | `weight_kg` | `weightKg` |
| Timestamp | `timestamp` | `timestamp` (unchanged) |
| ID | `id` | `id` (unchanged) |

### Where Transformation Happens

**Frontend → API** (in `api-client.js` or calling code):
- Must transform snake_case to camelCase before POST
- Location: Check each API method

**API → Frontend** (in sync/response handling):
- Must transform camelCase back to snake_case
- Location: `cloud-storage.js`, sync merge functions

## Tracing Checklist

When debugging data issues, verify at EACH layer:

### Layer 1: UI Input
- [ ] Form field captures correct value
- [ ] No validation blocking submission
- [ ] Event handler fires correctly

### Layer 2: JavaScript (InjectionTracker class)
- [ ] Data stored in `this.data.injections[]` (or vials/weights)
- [ ] Property names are snake_case
- [ ] `saveData()` called after changes
- [ ] No data transformation errors

### Layer 3: localStorage
```javascript
// Check localStorage directly:
JSON.parse(localStorage.getItem('injectionTrackerData'))
```
- [ ] Data persists after refresh
- [ ] Structure matches expected format
- [ ] No null/undefined where values expected

### Layer 4: API Client
- [ ] Correct endpoint called (GET/POST/DELETE)
- [ ] Request body has camelCase properties
- [ ] Auth token attached (`Authorization: Bearer`)
- [ ] Response parsed correctly

### Layer 5: Lambda Handler
- [ ] `userId` extracted from `event.requestContext.authorizer.lambda.userId`
- [ ] Request body parsed: `JSON.parse(event.body)`
- [ ] Validation passes
- [ ] DynamoDB command constructed correctly

### Layer 6: DynamoDB
- [ ] PK format: `USER#{userId}`
- [ ] SK format: `INJECTION#{id}` or `VIAL#{id}` or `WEIGHT#{id}`
- [ ] GSI1PK/GSI1SK set correctly for queries
- [ ] All required attributes present

### Layer 7: Sync Merge
- [ ] Cloud data fetched successfully
- [ ] Merge logic handles conflicts (last-write-wins by timestamp)
- [ ] Deletions propagate (check `deletedIds` array)
- [ ] No duplicate IDs after merge

### Layer 8: UI Update
- [ ] Data transformed back to snake_case
- [ ] UI components re-render
- [ ] Calculations update (supply forecast, metrics)
- [ ] No console errors

## Common Data Flow Bugs

### Bug: Data saves locally but not to cloud
**Trace path:**
1. Check network tab for API call
2. Check request body format (should be camelCase)
3. Check response status
4. Check Lambda logs in CloudWatch

### Bug: Cloud data not appearing locally
**Trace path:**
1. Check sync API response
2. Check merge logic in cloud-storage.js
3. Check if camelCase→snake_case transform applied
4. Check if `renderData()` called after sync

### Bug: Duplicate records after sync
**Trace path:**
1. Check if IDs match between local and cloud
2. Check deduplication logic (by `id` field)
3. Check if sync runs multiple times
4. Verify `lastSyncTimestamp` updates correctly

### Bug: Deletions not syncing
**Trace path:**
1. Check `deletedIds` array in sync payload
2. Check DELETE endpoint response
3. Check if local deletedIds cleared after successful sync
4. Verify cloud data actually removed (check DynamoDB)

## Debugging Commands

```bash
# Check localStorage from browser console:
console.log(JSON.parse(localStorage.getItem('injectionTrackerData')))

# Check DynamoDB directly:
aws dynamodb query \
  --table-name retatrutide-tracker-prod \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#YOUR_USER_ID"}}' \
  --profile reta-admin

# Check Lambda logs:
aws logs tail /aws/lambda/RetaCloudInfrastructureStack-InjectionsPost... \
  --profile reta-admin --follow

# Test API directly:
curl -X GET "https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1/injections" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Implementation Checklist for New Fields

When adding a new data field, ensure ALL layers are updated:

- [ ] HTML input/display element in `index.html`
- [ ] JavaScript property in InjectionTracker class (snake_case)
- [ ] localStorage persistence (automatic if in `this.data`)
- [ ] API client method includes field (transform to camelCase)
- [ ] Lambda validates and stores field
- [ ] DynamoDB schema accepts field
- [ ] Sync merge handles field
- [ ] UI calculations updated if needed
- [ ] Tests cover new field

## Related Files

| Layer | Files |
|-------|-------|
| UI/JS | `index.html` (lines 3632-12400) |
| API Client | `js/api-client.js` |
| Auth | `js/auth-manager.js` |
| Sync | `js/cloud-storage.js`, `js/sync-queue.js` |
| Lambda Handlers | `reta-cloud-infrastructure/lambda/*/` |
| CDK Stack | `reta-cloud-infrastructure/lib/reta-cloud-infrastructure-stack.ts` |
| Tests | `tests/e2e/`, `tests/sync/` |
