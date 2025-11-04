# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Retatrutide Tracker is a Progressive Web App (PWA) for tracking medication injections with cloud synchronization. The application consists of:

1. **Frontend**: Single-page application in `index.html` (~5000 lines)
2. **Cloud Infrastructure**: AWS CDK stack in `reta-cloud-infrastructure/`
3. **Backend**: AWS Lambda functions for API endpoints

**Key Constraint**: Ultra-budget AWS deployment targeting $0.30-1.00/month operational costs.

## Architecture

### Frontend Architecture

The application uses a **monolithic single-file architecture** with vanilla JavaScript ES6+:

- **Main Application Class**: `InjectionTracker` in `index.html` (starts ~line 1600)
  - Manages all application state in `this.data` object
  - Contains injections, vials, weights, and settings
  - All data stored in localStorage with browser-based backup system

- **Cloud Integration Modules** (in `js/` directory):
  - `auth-manager.js`: Firebase Authentication with Google Sign-In
  - `api-client.js`: AWS API Gateway client for backend communication
  - `cloud-storage.js`: (Legacy Google Drive sync - being phased out)
  - `migration-wizard.js`: Data migration from localStorage to cloud

### Cloud Infrastructure Architecture

**Stack Pattern**: Single CDK stack deploying all resources in `reta-cloud-infrastructure/lib/reta-cloud-infrastructure-stack.ts`

**Data Storage Pattern**: DynamoDB single-table design
- **Primary Key**: `PK` = `USER#{userId}`, `SK` = `{TYPE}#{id}`
- **GSI1**: Used for timestamp-based queries
- **Types**: `INJECTION#`, `VIAL#`, `WEIGHT#`
- **User Isolation**: All data partitioned by Firebase user ID

**Authentication Flow**:
1. Frontend authenticates with Firebase (Google OAuth)
2. Gets Firebase ID token (expires 60 min, auto-refreshes every 50 min)
3. Sends token in `Authorization: Bearer {token}` header
4. Lambda Authorizer validates token with Firebase Admin SDK
5. Injects `userId` into request context for data isolation

**API Routes** (API Gateway HTTP API):
- `GET /v1/injections` - List user's injections
- `POST /v1/injections` - Create injection
- `DELETE /v1/injections/{id}` - Delete injection (with cloud sync)
- `GET /v1/vials` - List user's vials
- `POST /v1/vials` - Create vial
- `DELETE /v1/vials/{id}` - Delete vial
- `GET /v1/weights` - List user's weights
- `POST /v1/weights` - Create weight entry
- `DELETE /v1/weights/{id}` - Delete weight entry (with cloud sync)
- `POST /v1/sync` - Full data sync (bidirectional merge)
- `POST /v1/backup` - Create S3 backup (auto-cleanup to 4 most recent)
- `GET /v1/backup` - List available backups

**Backup System**:
- **Browser Local**: localStorage + IndexedDB (auto every 5 min, keeps last 10)
- **Cloud Backups**: S3 bucket with Lambda-managed retention (keeps 4 most recent)
- **Auto-backup Schedule**: Every Monday at 9 AM (client-side check)

### Frontend Distribution

- **CloudFront CDN**: Serves static frontend from S3
- **Origin Access Control (OAC)**: Secure S3 access (NOT OAI - deprecated)
- **Cache Policy**: 365-day TTL for cost optimization
- **Auth Gate**: Login screen shown before app content (see `index.html` lines ~1225-1241)
- **SEO Blocking**: robots.txt blocks all crawlers including AI bots

## Development Commands

### Frontend Development

```bash
# Run local development server
npm start                    # Starts Express server on http://localhost:3000

# Run Playwright tests
npm test                     # Run all tests
npm run test:headed         # Run with browser visible
npm run test:debug          # Run in debug mode
npm run test:report         # Show test report
```

### Infrastructure Development

```bash
# AWS CDK operations (use --profile reta-admin)
cd reta-cloud-infrastructure
npm install                                    # Install dependencies
npm run build                                  # Compile TypeScript
npx cdk synth --profile reta-admin            # Generate CloudFormation
npx cdk diff --profile reta-admin             # Show changes
npx cdk deploy --profile reta-admin           # Deploy to AWS
```

### Deployment

**Option 1: Automated Script** (Recommended - with terminal access)
```bash
./deploy.sh  # Deploys backend + frontend + invalidates cache
```

**Option 2: GitHub Actions** (No terminal needed - from web browser)
1. Go to https://github.com/alandooley/reta/actions
2. Click "Deploy to AWS" workflow
3. Click "Run workflow" → Select `main` → Click "Run workflow"
4. Automatic on PR merges to `main`

**Option 3: Manual Commands** (Individual steps)
```bash
# Deploy backend (infrastructure + Lambda functions)
cd reta-cloud-infrastructure && npx cdk deploy --require-approval never --profile reta-admin && cd ..

# Deploy frontend to S3 + CloudFront
aws s3 cp index.html s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp manifest.json s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp robots.txt s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 sync js/ s3://retatrutide-frontend-372208783486/js/ --profile reta-admin --region eu-west-1

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E2ZD0ACBBK8F5K --paths "/*" --profile reta-admin
```

## Important Implementation Details

### Authentication & Security

1. **Firebase Configuration**: Lives in `firebase-config.json` (gitignored)
   - Must be manually created with your Firebase project credentials
   - Required fields: `apiKey`, `authDomain`, `projectId`

2. **AWS Secrets Manager**: Stores `firebase-service-account` JSON
   - Lambda authorizer needs this to validate Firebase tokens
   - Must be created manually before CDK deployment

3. **Firebase Authorized Domains**:
   - CloudFront domain must be added to Firebase Console
   - Path: Firebase Console → Authentication → Settings → Authorized domains
   - Add: `d13m7vzwjqe4pp.cloudfront.net` (or your CloudFront domain)

### Chart Configuration

The application uses **Chart.js** for weight tracking with custom styling:

**Results Page Chart** (Colorful gradient design):
- **Multi-colored line**: Each point cycles through 6 colors (red, orange, green, cyan, blue, purple)
- **Colorful segments**: Line segments match starting point color
- **Dose labels**: Displayed as colored pills above weight points, matching point colors
- **X-axis padding**: 2 days on each side for visibility
- **Y-axis (Weight)**: `beginAtZero: false`, `grace: '5%'` to prevent compression
- **Time Adapter**: Uses `chartjs-adapter-date-fns` for time-based X-axis
- **Data Format**: Objects with `x: timestamp, y: value` format
- **Units**: All measurements in **kg** (not lb)

### Data Property Naming

**Critical**: The codebase uses **camelCase** for data properties:
- ✅ `weightKg`, `doseMg`, `vialId`
- ❌ NOT `weight_kg`, `dose_mg`, `vial_id`

This is consistent across localStorage, API, and DynamoDB.

### Key Metrics and Calculations

**Results Page - 6 Metric Cards**:
1. **Total change**: `lastWeight - firstWeight` (in kg)
2. **Current BMI**: `weight / (height²)` (requires height in settings)
3. **Weight**: Current weight (in kg)
4. **Percent change**: `(weightChange / startWeight) × 100`
5. **Weekly avg**: `weightChange / weeks` (in kg/wk)
6. **Goal progress**: `(lostSoFar / totalToLose) × 100`

**Supply Forecast Calculation**:
- **Formula**: `Total capacity - Total used`
- **Total capacity**: `All vials × 1ml × concentration` (assumes 1ml bac water per vial)
- **Total used**: Sum of all injection doses
- **Includes**: Both dry (unused) and activated vials
- **Example**: 4 vials @ 10mg each = 40mg total; used 4mg = 36mg remaining

**Level at Last Shot**:
- Shows **remaining vial volume** (in ml), not body medication level
- Calculates: `1.0ml - (total doses from vial / concentration)`
- Example: If vial used 0.15ml total, shows `0.85 ml` remaining

### Lambda Budget Optimizations

All Lambdas use cost-saving configurations:
- **Architecture**: ARM64 (20% cheaper than x86_64)
- **Memory**: 256MB (reduced from default 512MB)
- **Timeout**: 10 seconds (except authorizer: 5s)
- **Logs**: 3-day retention (not 7 days)
- **Bundling**: esbuild with minification enabled

### S3 Lifecycle Management

Backup cleanup is **Lambda-managed, not S3 lifecycle rules**:
- S3 lifecycle rule is only a 60-day fallback
- Primary cleanup: Lambda lists objects, sorts by date, deletes oldest
- Keeps exactly 4 most recent backups per user

## Firebase Session Management

- **Session Type**: Persistent (stored in IndexedDB)
- **ID Token Expiry**: 60 minutes
- **Auto-refresh**: Every 50 minutes (pre-emptive)
- **Refresh Logic**: Lives in `auth-manager.js` lines 48-52, 103-106

## Working with the Monolithic Frontend

The `index.html` file contains ~5000 lines. Key sections:

- **Lines 1-200**: HTML structure, meta tags, CSS
- **Lines 200-1600**: CSS styles (dark theme, responsive design)
- **Lines 1600-4900**: `InjectionTracker` class (main application logic)
- **Lines 4900-5000**: Initialization and event handlers

When editing, use specific line searches in the Read tool rather than reading the entire file.

## Git Workflow

**Files to NEVER commit**:
- `firebase-config.json` - Contains API keys
- `firebase-service-account.json` - Service account credentials
- `*.csv` files - Personal health data
- `.claude/settings.local.json` - Local IDE settings
- `nul` - Temporary Windows file

**Commit Message Format**: Use conventional commits with Claude Code footer:
```
{type}: {description}

{detailed explanation}

Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

## CloudFront Cache Invalidation

**Always invalidate after frontend deployments**:
- Use `/*` for paths (NOT `/index.html` - that will fail)
- Cache has 365-day TTL, so invalidation is required for updates
- Distribution ID: `E2ZD0ACBBK8F5K`

## Common Pitfalls

1. **OAI vs OAC**: Always use `S3BucketOrigin.withOriginAccessControl()`, NOT `S3Origin` (deprecated)

2. **Chart Not Showing Data**: Usually Y-axis scaling issue. Check:
   - Property names are camelCase (`weightKg` not `weight_kg`)
   - `beginAtZero` is appropriate for data range
   - Date adapter is loaded (`chartjs-adapter-date-fns`)

3. **Firebase Auth Domain Errors**: CloudFront domain must be in Firebase Console authorized domains list

4. **Lambda Cold Starts**: ARM64 + small memory = slower cold starts. This is acceptable for ultra-budget constraint.

5. **Auto-backup Not Running**: Only triggers when:
   - User is authenticated
   - It's Monday between 9-10 AM
   - App is open and active
   - No backup in last 7 days

## Testing Notes

Playwright tests in `tests/` directory:
- `app.spec.js` - Core application functionality
- `data-integrity.spec.js` - Data validation tests
- `live-site.spec.js` - Production site smoke tests

Tests expect local server on port 3000 or live CloudFront URL.

## AWS Profile

All AWS commands use `--profile reta-admin`:
- Defined in `~/.aws/config` and `~/.aws/credentials`
- Points to AWS account ID: `372208783486`
- Region: `eu-west-1` (Ireland)
