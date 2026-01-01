# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TRT Tracker is a Progressive Web App (PWA) for tracking Testosterone Replacement Therapy (TRT) injections with cloud synchronization. The application consists of:

1. **Frontend**: Single-page application in `index.html` (~12,600 lines)
2. **Cloud Infrastructure**: AWS CDK stack in `reta-cloud-infrastructure/`
3. **Backend**: AWS Lambda functions for API endpoints

**Key Constraint**: Ultra-budget AWS deployment targeting $0.30-1.00/month operational costs.

## Architecture

### Frontend Architecture

The application uses a **monolithic single-file architecture** with vanilla JavaScript ES6+:

- **Main Application Class**: `InjectionTracker` in `index.html` (starts line 3632)
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
- **Auth Gate**: Login screen shown before app content (see `index.html` lines ~2423-2500)
- **SEO Blocking**: robots.txt blocks all crawlers including AI bots

## Change Management & Impact Analysis

**CRITICAL**: Before implementing ANY change, you MUST follow these guidelines to ensure complete, working functionality without regressions.

### Pre-Change Impact Analysis

Before making changes, analyze and document:

1. **Identify all affected components**:
   - Search for all usages of functions/variables being modified
   - Check both frontend (`index.html`, `js/`) and backend (`reta-cloud-infrastructure/`)
   - Look for related event handlers, callbacks, and data flows
   - Consider localStorage ↔ API data format mappings (snake_case vs camelCase)

2. **Map dependencies**:
   - What calls this code? What does this code call?
   - Are there UI elements that depend on this functionality?
   - Are there calculations or metrics that use this data?
   - Does this affect cloud sync, backups, or data persistence?

3. **Identify test coverage**:
   - Which existing tests cover the affected functionality?
   - Run `npm test -- --grep "{feature}"` to find related tests
   - Note any gaps in test coverage for the change

### Complete Implementation Requirements

When adding or changing functionality, ensure **ALL** supporting pieces are built:

1. **Full data flow**: If adding a field, ensure it flows through:
   - UI input/display elements
   - JavaScript data handling
   - localStorage persistence
   - API serialization/deserialization (with correct naming conventions)
   - DynamoDB schema (if backend change)
   - Cloud sync bidirectional merge logic

2. **UI completeness**: If adding a feature visible to users:
   - Add necessary HTML elements
   - Add CSS styling (including dark theme, mobile responsive)
   - Add JavaScript event handlers
   - Add validation and error handling
   - Add loading states if async

3. **CRUD completeness**: If adding a data type, implement ALL operations:
   - Create, Read, Update, Delete
   - List/query functionality
   - Cloud sync support
   - Backup inclusion

### Regression Prevention

**Before finalizing any change**:

1. **Run the full test suite**: `npm test`
   - All tests MUST pass before considering work complete
   - If tests fail, fix the regression before proceeding

2. **Test related functionality manually**:
   - If changing injections → verify vial tracking still works
   - If changing vials → verify supply forecast still calculates correctly
   - If changing weights → verify Results page metrics still work
   - If changing auth → verify cloud sync still works

3. **Verify no console errors**: Check browser dev tools for JavaScript errors

4. **Test edge cases**:
   - Empty states (no data)
   - Single item
   - Many items (performance)
   - Invalid input

### Post-Change Verification Checklist

After implementing changes, verify:

- [ ] Feature works as intended (happy path)
- [ ] All existing tests pass (`npm test`)
- [ ] No console errors in browser
- [ ] Data persists correctly (refresh page, data still there)
- [ ] Cloud sync works (if applicable)
- [ ] Mobile/responsive layout not broken
- [ ] Related features still work (see dependency mapping)

### Common Cross-Cutting Concerns

Changes often have hidden impacts on:

| If you change... | Also check... |
|-----------------|---------------|
| Injection data | Vial volume tracking, supply forecast, Results metrics |
| Vial data | Injection vial selection, supply forecast, "Level at Last Shot" |
| Weight data | Results page chart, BMI calculation, all 6 metric cards |
| Settings | Any feature that reads from settings (height for BMI, etc.) |
| Auth flow | All cloud operations, sync, backup, API calls |
| Data format | localStorage, API mapping, cloud sync merge logic |
| CSS styles | Dark theme, mobile responsive, all pages using those styles |

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

### TRT Vial Characteristics

**IMPORTANT**: This application tracks **Testosterone Replacement Therapy (TRT)** injections:

- **Pre-mixed Solution**: TRT vials contain testosterone suspended in oil (typically sesame or cottonseed oil)
- **No Reconstitution**: Vials are ready to use - NO bacteriostatic water needed
- **Fixed Volume**: Vials come in standard sizes (1ml, 5ml, 10ml)
- **Standard Concentrations**: Common concentrations are 100mg/ml, 200mg/ml, or 250mg/ml
- **Volume Tracking**: The app tracks actual vial volume depletion based on injection doses

**NOT for peptides**: Unlike peptides (e.g., Retatrutide, Semaglutide) which require reconstitution with bacteriostatic water, TRT vials are pharmaceutical-grade solutions ready for injection.

### Data Property Naming

**Critical**: The codebase uses **two different formats**:

**Internal/localStorage** (snake_case):
- `dose_mg`, `weight_kg`, `vial_id`, `injection_site`
- `concentration_mg_ml`, `current_volume_ml`

**API/DynamoDB** (camelCase):
- `doseMg`, `weightKg`, `vialId`, `site`
- `concentrationMgPerMl`, `initialVolumeMl`

The frontend automatically maps between formats during cloud sync operations.

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
- **Total capacity**: `All vials × vial volume × concentration`
- **Total used**: Sum of all injection doses
- **Includes**: All vials (TRT vials come pre-mixed in oil, ready to use)
- **Example**: 4 vials @ 200mg/ml × 1ml each = 800mg total; used 100mg = 700mg remaining

**Level at Last Shot**:
- Shows **remaining vial volume** (in ml), not body medication level
- Calculates: `vial volume - (total doses from vial / concentration)`
- Example: For a 1ml vial at 200mg/ml, if 50mg used (0.25ml), shows `0.75 ml` remaining
- **Important**: TRT vials come pre-mixed in oil (not reconstituted with bac water)

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

The `index.html` file contains ~12,600 lines. Key sections:

- **Lines 1-50**: HTML structure, meta tags
- **Lines 50-2420**: CSS styles (dark theme, responsive design)
- **Lines 2420-3630**: HTML body, auth gate, main app structure
- **Lines 3632-12400**: `InjectionTracker` class (main application logic)
- **Lines 12400-12664**: Initialization and event handlers

When editing, use Grep to find specific functions or sections rather than reading the entire file.

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

Playwright tests are organized in `tests/` with 40+ test files:

**Test Directories:**
- `tests/e2e/` - End-to-end CRUD tests (injections, vials, weights, charts, settings)
- `tests/integration/` - Feature integration tests
- `tests/sync/` - Cloud sync and offline operations
- `tests/edge-cases/` - Error handling and validation
- `tests/performance/` - Large dataset tests
- `tests/data/` - Data integrity and cleanup
- `tests/smoke/` - Pre-deploy sanity checks

**Running Tests:**
```bash
npm test                           # Run all tests
npm test -- tests/e2e/01-injection-crud.spec.js  # Run single test file
npm test -- --grep "should add"    # Run tests matching pattern
npm run test:headed                # Run with browser visible
npm run test:integration           # Run integration suite only
npm run test:live                  # Test live production site
```

Tests expect local server on `http://localhost:3000` (run `npm start` first).

## AWS Profile

All AWS commands use `--profile reta-admin`:
- Defined in `~/.aws/config` and `~/.aws/credentials`
- Points to AWS account ID: `372208783486`
- Region: `eu-west-1` (Ireland)
