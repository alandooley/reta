# Retatrutide Tracker 💉

A comprehensive Progressive Web App (PWA) for tracking Retatrutide injections with advanced vial management, weight tracking, and cloud synchronization capabilities.

**Live App**: https://d13m7vzwjqe4pp.cloudfront.net/

## 🌟 Features

### Core Functionality
- **📊 Shot History & Tracking**: Complete injection logging with sites, doses, and notes
- **📈 Medication Level Visualization**: Real-time half-life calculations and projections
- **⚖️ Weight & Dose Correlation**: Dual-axis charts showing progress analysis
- **📦 Vial & Inventory Management**: Comprehensive cost tracking and expiration alerts
- **⏰ Next Shot Countdown**: Live countdown with visual progress indicators
- **☁️ Cloud Sync**: AWS-powered real-time synchronization across devices
- **🔐 Firebase Authentication**: Secure Google Sign-In with user data isolation
- **📱 PWA Support**: Install as a native app on any device
- **💾 Automatic Backups**: Browser-based and cloud backups with retention policies

## 🏗️ Architecture

### Frontend
- **Single-page application** in `index.html` (~5400 lines)
- **Vanilla JavaScript ES6+** with no framework dependencies
- **Progressive Web App** with Service Worker for offline support
- **Hosted on CloudFront CDN** with S3 origin

### Backend (Ultra-Budget AWS)
- **API Gateway HTTP API** with Lambda authorizer
- **DynamoDB single-table design** for data storage
- **Lambda functions** (ARM64, 256MB) for all endpoints
- **S3 backup storage** with automated cleanup (4 most recent)
- **AWS CDK** for infrastructure as code

**Monthly Cost Target**: $0.30-1.00 USD

### Key Constraint
All AWS resources optimized for ultra-low costs:
- ARM64 Lambdas (20% cheaper)
- 256MB memory (reduced from default)
- 3-day log retention
- Lambda-managed S3 cleanup (not lifecycle rules)
- Single-table DynamoDB design

## 🚀 Deployment

### Prerequisites
- **AWS CLI** configured with `reta-admin` profile
- **Node.js** 18+ and npm
- **AWS CDK** installed globally: `npm install -g aws-cdk`

### Quick Deploy

Use the automated deployment script:

```bash
# Deploy frontend only (fastest - ~2 minutes)
./deploy.sh frontend

# Deploy backend infrastructure (slower - ~5-10 minutes)
./deploy.sh backend

# Deploy everything
./deploy.sh all
```

The script:
- ✅ Uploads frontend files to S3
- ✅ Invalidates CloudFront cache automatically
- ✅ Builds and deploys CDK infrastructure
- ✅ Color-coded output for easy monitoring

### Manual Deployment

#### Frontend
```bash
# Upload to S3
aws s3 cp index.html s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp manifest.json s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp robots.txt s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp sw.js s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 sync js/ s3://retatrutide-frontend-372208783486/js/ --profile reta-admin --region eu-west-1

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id E2ZD0ACBBK8F5K --paths "/*" --profile reta-admin
```

#### Backend
```bash
cd reta-cloud-infrastructure
npm install
npm run build
npx cdk deploy --require-approval never --profile reta-admin
```

## 📋 API Endpoints

Base URL: `https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1`

All endpoints require Firebase authentication token in header:
```
Authorization: Bearer <firebase-id-token>
```

### Endpoints
- `GET /v1/injections` - List user's injections
- `POST /v1/injections` - Create injection
- `GET /v1/vials` - List user's vials
- `POST /v1/vials` - Create vial
- `DELETE /v1/vials/{id}` - Delete vial
- `GET /v1/weights` - List user's weights
- `POST /v1/weights` - Create weight entry
- `POST /v1/sync` - Full data sync (bidirectional merge)
- `POST /v1/backup` - Create S3 backup (auto-cleanup)
- `GET /v1/backup` - List available backups

## 🔧 Configuration

### Firebase Setup

1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project
   - Enable Authentication > Google Sign-In

2. **Get Credentials**:
   - Project Settings > General > Your apps
   - Copy Web API Key, Project ID, Auth Domain

3. **Create `firebase-config.json`** (gitignored):
   ```json
   {
     "apiKey": "YOUR_API_KEY",
     "authDomain": "your-project.firebaseapp.com",
     "projectId": "your-project-id"
   }
   ```

4. **Get Service Account** (for Lambda):
   - Project Settings > Service Accounts
   - Generate new private key
   - Save as `firebase-service-account.json`
   - Upload to AWS Secrets Manager as `firebase-service-account`

5. **Add CloudFront to Authorized Domains**:
   - Authentication > Settings > Authorized domains
   - Add your CloudFront domain (e.g., `d13m7vzwjqe4pp.cloudfront.net`)

### AWS Secrets Manager

Store Firebase service account in AWS:
```bash
aws secretsmanager create-secret \
  --name firebase-service-account \
  --secret-string file://firebase-service-account.json \
  --region eu-west-1 \
  --profile reta-admin
```

## 📊 Data Management

### Data Format
The app uses **snake_case** internally but the API uses **camelCase**:

**Internal Format** (localStorage):
```json
{
  "injections": [{
    "id": "uuid",
    "timestamp": "2025-09-27T10:51:00.000Z",
    "dose_mg": 4.2,
    "injection_site": "abdomen",
    "vial_id": "uuid-or-null",
    "notes": "..."
  }],
  "weights": [{
    "id": "uuid",
    "timestamp": "2025-09-27T10:51:00.000Z",
    "weight_kg": 89.7,
    "notes": ""
  }],
  "vials": [{
    "vial_id": "uuid",
    "order_date": "2025-09-13",
    "total_mg": 10,
    "bac_water_ml": 1,
    "concentration_mg_per_ml": 10,
    "current_volume_ml": 0,
    "used_volume_ml": 1,
    "status": "finished",
    "supplier": "",
    "notes": "..."
  }]
}
```

**API Format** (DynamoDB/HTTP):
```json
{
  "doseMg": 4.2,
  "site": "abdomen",
  "vialId": "uuid-or-null",
  "weightKg": 89.7,
  "initialVolumeMl": 1,
  "concentrationMgPerMl": 10
}
```

The app automatically maps between formats during sync.

### Backup System

**Browser Backups**:
- **localStorage**: Primary data storage
- **IndexedDB**: Auto-backup every 5 minutes (keeps 10 most recent)

**Cloud Backups**:
- **S3 Storage**: Manual or auto-backup (every Monday 9 AM)
- **Retention**: Keeps 4 most recent backups
- **Cleanup**: Lambda-managed (not S3 lifecycle)

## 🛠️ Technical Details

### Technologies Used
- **Frontend**: Vanilla JavaScript ES6+
- **Charts**: Chart.js 4.x with date-fns adapter
- **PWA**: Service Worker with offline support
- **Auth**: Firebase Authentication
- **Backend**: AWS Lambda (Node.js 18 on ARM64)
- **Database**: DynamoDB single-table design
- **CDN**: CloudFront with S3 origin
- **IaC**: AWS CDK (TypeScript)

### DynamoDB Table Structure
**Primary Key**: `PK` + `SK`
- `PK = USER#{userId}` (partition key)
- `SK = {TYPE}#{id}` (sort key)
  - `INJECTION#{uuid}`
  - `VIAL#{uuid}`
  - `WEIGHT#{uuid}`

**GSI1**: Timestamp-based queries
- `GSI1PK = USER#{userId}`
- `GSI1SK = TIMESTAMP#{iso-date}`

### Lambda Authorizer
- **Type**: SIMPLE (not IAM policy)
- **Validation**: Firebase Admin SDK
- **Token**: Auto-refreshes every 50 minutes (expires at 60)
- **Context Injection**: Adds `userId` to request context

### Browser Support
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile browsers (iOS/Android)

### Performance
- **Initial Load**: < 2 seconds
- **CloudFront Cache**: 365-day TTL
- **Offline Support**: Full functionality with Service Worker
- **Chart Rendering**: Optimized with scatter plots for doses

## 🔒 Privacy & Security

### Data Isolation
- All data partitioned by Firebase user ID
- DynamoDB queries filter by `PK = USER#{userId}`
- No cross-user data access possible

### Authentication Flow
1. User signs in with Google via Firebase
2. Firebase returns ID token (expires 60 min)
3. Token sent in `Authorization: Bearer` header
4. Lambda authorizer validates with Firebase Admin SDK
5. User ID injected into request context

### Security Features
- **No secrets in frontend**: Firebase config only (public info)
- **AWS Secrets Manager**: Stores service account credentials
- **CloudFront OAC**: Secure S3 access (not deprecated OAI)
- **SEO Blocking**: robots.txt blocks all crawlers
- **Auth Gate**: Login required before showing app

## 📱 PWA Features

### Installation
- **Add to Home Screen**: Native app experience
- **Offline Support**: Full functionality offline
- **Auto Updates**: Service worker handles updates
- **Push Notifications**: Injection reminders (if enabled)

### Notifications
- **Injection Due Reminder**: 24 hours before + overdue alerts
- **Vial Expiring Soon**: 3 days before 28-day expiry
- **Low Stock Alert**: When < 2 doses remaining
- **Weekly Progress Summary**: Every Monday at 9 AM

All notification types can be toggled on/off in Settings.

## 🐛 Troubleshooting

### Common Issues

**Data Not Syncing**:
- Check internet connection
- Verify signed in (see user email in Settings)
- Check browser console for errors

**Charts Not Loading**:
- Ensure Chart.js CDN is accessible
- Check data format (snake_case internally)
- Try hard refresh (Ctrl+Shift+R)

**PWA Not Installing**:
- Must be served over HTTPS
- Check Service Worker registration
- CloudFront distribution must be in Firebase authorized domains

**Authentication Errors**:
- Verify Firebase config exists
- Check CloudFront domain in Firebase Console
- Ensure Secrets Manager has service account

## 📄 Important Files

### Not Committed (gitignored)
- `firebase-config.json` - Firebase credentials
- `firebase-service-account.json` - Service account key
- `*.csv` - Personal health data
- `.claude/settings.local.json` - Local IDE settings

### Documentation
- `CLAUDE.md` - Development guide for Claude Code
- `DEPLOYMENT_SUMMARY.md` - Deployment details
- `MIGRATION_README.md` - Data migration guide
- `deploy.sh` - Automated deployment script

## 📞 Support

### Resources
- **Live App**: https://d13m7vzwjqe4pp.cloudfront.net/
- **GitHub**: https://github.com/alandooley/reta
- **CloudFront ID**: E2ZD0ACBBK8F5K
- **Region**: eu-west-1 (Ireland)

### Getting Help
- Check browser console for errors
- Export data before troubleshooting
- Test in incognito mode
- Review logs in CloudWatch (Lambda functions)

## 🙏 Acknowledgments

- Chart.js for visualization
- Firebase for authentication
- AWS for ultra-low-cost hosting
- The Retatrutide community for feedback

---

**Disclaimer**: This application is for personal tracking only. Always consult with healthcare providers for medical decisions. This tool does not provide medical advice.

**Version**: 2.0.0
**Last Updated**: 2025-10-24
**Author**: Alan Dooley

**🤖 Built with Claude Code**
