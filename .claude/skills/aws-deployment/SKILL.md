---
name: aws-deployment
description: "RETA-specific deployment skill. Ultra-budget AWS deployment ($0.30-1.00/month). Use when deploying, debugging infrastructure, or modifying Lambda/CDK."
---

# RETA AWS Deployment Skill

## Core Principle

**Ultra-budget deployment: Every decision optimizes for cost while maintaining reliability.**

Target: $0.30-1.00/month operational cost.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RETA CLOUD ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER                                                                        │
│    │                                                                         │
│    ▼                                                                         │
│  CloudFront (CDN)  ───────────►  S3 (Frontend)                              │
│    │                              - index.html                               │
│    │                              - js/*.js                                  │
│    │                              - manifest.json                            │
│    ▼                                                                         │
│  Firebase Auth ◄──────────────►  Frontend (Browser)                         │
│    │                                                                         │
│    │ ID Token                                                                │
│    ▼                                                                         │
│  API Gateway (HTTP API)                                                      │
│    │                                                                         │
│    ├─► Lambda Authorizer ───────► Secrets Manager (Firebase SA)             │
│    │                                                                         │
│    ├─► GET/POST/DELETE /v1/injections ───►  DynamoDB                        │
│    ├─► GET/POST/DELETE /v1/vials      ───►  (Single Table)                  │
│    ├─► GET/POST/DELETE /v1/weights    ───►                                  │
│    ├─► POST /v1/sync                  ───►                                  │
│    └─► GET/POST /v1/backup            ───►  S3 (Backups)                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Budget Optimizations (NEVER REMOVE)

| Resource | Optimization | Savings |
|----------|--------------|---------|
| Lambda | ARM64 architecture | 20% cheaper |
| Lambda | 256MB memory | Minimum needed |
| Lambda | 10s timeout (5s authorizer) | Cost control |
| CloudWatch | 3-day log retention | vs 7-day default |
| DynamoDB | On-Demand billing | Pay per request |
| DynamoDB | No PITR | Saves $0.20/month |
| CloudFront | 365-day cache TTL | Reduced origin requests |
| S3 Backups | Keep 4 most recent | Lambda-managed cleanup |
| No custom domain | Uses CloudFront default | Free |

## Deployment Methods

### Method 1: Automated Script (Recommended)

```bash
./deploy.sh
```

This script:
1. Deploys CDK stack (Lambda + API Gateway + DynamoDB)
2. Syncs frontend files to S3
3. Invalidates CloudFront cache

### Method 2: GitHub Actions (No Terminal)

1. Go to https://github.com/alandooley/reta/actions
2. Click "Deploy to AWS" workflow
3. Click "Run workflow" → Select `main`
4. Wait for completion

Auto-triggers on PR merge to `main`.

### Method 3: Manual Steps

```bash
# 1. Deploy infrastructure
cd reta-cloud-infrastructure
npx cdk deploy --require-approval never --profile reta-admin
cd ..

# 2. Deploy frontend
aws s3 cp index.html s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp manifest.json s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp robots.txt s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 sync js/ s3://retatrutide-frontend-372208783486/js/ --profile reta-admin --region eu-west-1

# 3. Invalidate cache (CRITICAL!)
aws cloudfront create-invalidation \
  --distribution-id E2ZD0ACBBK8F5K \
  --paths "/*" \
  --profile reta-admin
```

## CloudFront Cache Invalidation

**ALWAYS invalidate after frontend changes.**

Cache has 365-day TTL. Without invalidation, users see old version.

```bash
# Correct (wildcard):
aws cloudfront create-invalidation --distribution-id E2ZD0ACBBK8F5K --paths "/*"

# WRONG (will fail):
aws cloudfront create-invalidation --distribution-id E2ZD0ACBBK8F5K --paths "/index.html"
```

## AWS Profile Configuration

All commands use `--profile reta-admin`:

```ini
# ~/.aws/config
[profile reta-admin]
region = eu-west-1
output = json

# ~/.aws/credentials
[reta-admin]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
```

## DynamoDB Single-Table Design

```
┌────────────────────────────────────────────────────────────────┐
│ Table: retatrutide-tracker-prod                                │
├───────────────┬────────────────────┬──────────────────────────┤
│ PK            │ SK                 │ Attributes               │
├───────────────┼────────────────────┼──────────────────────────┤
│ USER#{userId} │ INJECTION#{id}     │ doseMg, site, timestamp  │
│ USER#{userId} │ VIAL#{id}          │ concentration, volume    │
│ USER#{userId} │ WEIGHT#{id}        │ weightKg, timestamp      │
│ USER#{userId} │ SETTINGS           │ height, goalWeight, etc  │
├───────────────┼────────────────────┼──────────────────────────┤
│ GSI1PK        │ GSI1SK             │ (For timestamp queries)  │
│ USER#{userId} │ TIMESTAMP#{ts}     │                          │
└───────────────┴────────────────────┴──────────────────────────┘
```

## Lambda Function Map

| Endpoint | Lambda | File |
|----------|--------|------|
| `ANY /*` (auth) | Authorizer | `lambda/authorizer/index.js` |
| `GET /v1/injections` | InjectionsGet | `lambda/injections/get.js` |
| `POST /v1/injections` | InjectionsPost | `lambda/injections/post.js` |
| `DELETE /v1/injections/{id}` | InjectionsDelete | `lambda/injections/delete.js` |
| `GET /v1/vials` | VialsGet | `lambda/vials/get.js` |
| `POST /v1/vials` | VialsPost | `lambda/vials/post.js` |
| `DELETE /v1/vials/{id}` | VialsDelete | `lambda/vials/delete.js` |
| `GET /v1/weights` | WeightsGet | `lambda/weights/get.js` |
| `POST /v1/weights` | WeightsPost | `lambda/weights/post.js` |
| `DELETE /v1/weights/{id}` | WeightsDelete | `lambda/weights/delete.js` |
| `POST /v1/sync` | SyncHandler | `lambda/sync/index.js` |
| `GET /v1/backup` | BackupGet | `lambda/backup/get.js` |
| `POST /v1/backup` | BackupPost | `lambda/backup/post.js` |

## Common Issues & Solutions

### Issue: "Firebase auth domain error"
**Solution:** Add CloudFront domain to Firebase Console:
1. Firebase Console → Authentication → Settings
2. Add: `d13m7vzwjqe4pp.cloudfront.net`

### Issue: "OAI deprecated" warning
**Solution:** Already using OAC (Origin Access Control), not OAI. Warning is informational.

### Issue: Lambda cold starts slow
**Expected behavior:** ARM64 + 256MB = slower cold starts. Acceptable for budget.

### Issue: Cache not updating after deploy
**Solution:** Run cache invalidation:
```bash
aws cloudfront create-invalidation --distribution-id E2ZD0ACBBK8F5K --paths "/*" --profile reta-admin
```

### Issue: CDK deploy fails
**Debug steps:**
```bash
cd reta-cloud-infrastructure
npm run build          # Check for TypeScript errors
npx cdk synth --profile reta-admin  # Check CloudFormation generation
npx cdk diff --profile reta-admin   # See what would change
```

## Pre-Deployment Checklist

- [ ] All tests pass: `npm test`
- [ ] No console errors in browser
- [ ] CDK builds: `cd reta-cloud-infrastructure && npm run build`
- [ ] Changes committed to git
- [ ] On `main` branch (for GitHub Actions)

## Post-Deployment Verification

- [ ] CloudFront URL loads: `https://d13m7vzwjqe4pp.cloudfront.net`
- [ ] Login works (Firebase auth)
- [ ] Data loads from cloud
- [ ] CRUD operations work
- [ ] No errors in CloudWatch Logs

## Secrets Management

**Firebase Service Account** (in Secrets Manager):
- Secret name: `firebase-service-account`
- Contains: Firebase Admin SDK JSON
- Used by: Lambda Authorizer

**Firebase Config** (gitignored file):
- File: `firebase-config.json`
- Contains: Frontend Firebase config (apiKey, authDomain, projectId)
- Must be created manually on new environments

## Key Resource IDs

| Resource | ID/ARN |
|----------|--------|
| AWS Account | 372208783486 |
| Region | eu-west-1 |
| CloudFront Distribution | E2ZD0ACBBK8F5K |
| S3 Frontend Bucket | retatrutide-frontend-372208783486 |
| S3 Backup Bucket | retatrutide-backups-372208783486 |
| DynamoDB Table | retatrutide-tracker-prod |
| API Gateway | 5is9pmy9be.execute-api.eu-west-1.amazonaws.com |
