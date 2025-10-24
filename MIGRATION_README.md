# Retatrutide Tracker - Data Migration Guide

## Overview

This guide explains how to migrate your injection tracking data from the CSV export to the cloud database.

## Files Created

### 1. Migration Script (`migrate-data.js`)
Parses the CSV file and prepares data for cloud upload.

**Features:**
- Automatically extracts injections from CSV
- Deduplicates weight entries
- Detects vials mentioned in notes
- Links injections to their vials
- Supports dry-run mode (no upload)
- Generates JSON file for manual upload

### 2. Migration Data (`migration-data.json`)
The parsed and structured data ready for upload to cloud.

**Contents:**
- **8 injections** (0.25mg to 4.2mg doses)
- **6 weight entries** (95kg down to 89.7kg)
- **1 vial** (10mg in 1mL BAC water)

**Date Range:** August 6, 2025 - September 27, 2025

## Migration Data Summary

### Injections
```
2025-08-06: 0.25mg (First micro-dose)
2025-08-12: 0.5mg
2025-08-19: 1.0mg
2025-08-30: 2.0mg
2025-09-06: 3.0mg
2025-09-13: 4.0mg (New vial started - vial-1)
2025-09-20: 4.0mg (vial-1)
2025-09-27: 4.2mg (vial-1 finished)
```

### Weight Progress
```
2025-08-06: 95.0kg
2025-08-19: 96.0kg (+1.0kg)
2025-08-30: 93.6kg (-2.4kg)
2025-09-06: 93.0kg (-0.6kg)
2025-09-20: 90.9kg (-2.1kg)
2025-09-27: 89.7kg (-1.2kg)

Total weight loss: 5.3kg (95kg → 89.7kg)
```

### Vial
```
ID: vial-1
Start Date: 2025-09-13
Concentration: 10mg/mL
Initial Volume: 1.0mL
Status: Active (finished in notes)
```

## How to Upload Data

### Option 1: Using the Migration Script (Recommended)

1. **Get Firebase ID Token**
   - Open your browser console
   - Run: `firebase.auth().currentUser.getIdToken().then(console.log)`
   - Copy the token

2. **Run Migration with Token**
   ```bash
   node migrate-data.js injection_log_2025-10-24.csv YOUR_ID_TOKEN_HERE
   ```

### Option 2: Manual Upload via API

1. **Use the generated JSON file** (`migration-data.json`)

2. **Make API request**:
   ```bash
   curl -X POST https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1/sync \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
     -d @migration-data.json
   ```

### Option 3: Via Frontend (Once Deployed)

1. Open the web app at: https://d13m7vzwjqe4pp.cloudfront.net
2. Sign in with Google
3. Navigate to Settings > Import Data
4. Upload `migration-data.json`
5. Click "Import"

## Verification

After upload, verify your data:

1. **Check Injections**:
   ```bash
   curl https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1/injections \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Check Weights**:
   ```bash
   curl https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1/weights \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Check Vials**:
   ```bash
   curl https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1/vials \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Expected Results

Upon successful migration:

```json
{
  "success": true,
  "results": {
    "injections": { "imported": 8, "failed": 0 },
    "vials": { "imported": 1, "failed": 0 },
    "weights": { "imported": 6, "failed": 0 }
  },
  "totalImported": 15,
  "totalFailed": 0
}
```

## Troubleshooting

### "Unauthorized" Error
- Your Firebase ID token may have expired (tokens expire after 1 hour)
- Get a fresh token and try again

### "Missing required fields" Error
- Check that `migration-data.json` has valid structure
- Ensure all required fields are present (timestamp, doseMg, site, weightKg, etc.)

### Partial Import
- The sync endpoint processes in batches of 25 items
- Check the response to see which items succeeded/failed
- Re-run the migration to retry failed items

## Data Backup

Before migration:
1. Your original CSV is at: `injection_log_2025-10-24.csv`
2. The parsed JSON is at: `migration-data.json`
3. Consider creating a backup:
   ```bash
   cp injection_log_2025-10-24.csv injection_log_2025-10-24_BACKUP.csv
   ```

After migration, you can create cloud backups:
```bash
curl -X POST https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1/backup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This creates a timestamped backup in S3 (retained for 7 days).

## Next Steps

1. ✅ **Migration data prepared** - `migration-data.json` ready
2. ⏳ **Upload to cloud** - Use one of the methods above
3. ⏳ **Verify data** - Check all records imported correctly
4. ⏳ **Test frontend** - Ensure app displays migrated data
5. ⏳ **Continue tracking** - Add new injections via the app

## API Endpoints

All endpoints require Firebase authentication token in `Authorization: Bearer TOKEN` header.

- `POST /v1/sync` - Bulk import data
- `GET /v1/injections` - List all injections
- `POST /v1/injections` - Create new injection
- `GET /v1/vials` - List all vials
- `POST /v1/vials` - Create new vial
- `GET /v1/weights` - List all weights
- `POST /v1/weights` - Create new weight entry
- `POST /v1/backup` - Create backup
- `GET /v1/backup` - Retrieve backup

---

**Generated:** 2025-10-24
**API Base URL:** https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com
**CloudFront URL:** https://d13m7vzwjqe4pp.cloudfront.net
**Region:** eu-west-1 (Dublin)
