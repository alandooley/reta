# AWS Configuration Checklist

This checklist covers everything you need to deploy your Retatrutide Tracker to AWS.

## 1. AWS Account Setup (5 minutes)

### Create AWS Account
- [ ] Go to https://aws.amazon.com/
- [ ] Click "Create an AWS Account"
- [ ] Provide email, password, and account name
- [ ] Enter billing information (credit card required)
- [ ] Verify phone number
- [ ] Choose support plan (Free tier is fine)

**Cost**: AWS Free Tier includes:
- 5 GB S3 storage for 12 months
- 50 GB CloudFront data transfer/month for 12 months
- After free tier: ~$6-12/month for this app

---

## 2. Install AWS CLI (5 minutes)

### macOS
```bash
brew install awscli
```

### Linux
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Windows
Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi

### Verify Installation
```bash
aws --version
# Should show: aws-cli/2.x.x ...
```

---

## 3. Create AWS IAM User (10 minutes)

### Step 1: Access IAM Console
- [ ] Log in to AWS Console: https://console.aws.amazon.com/
- [ ] Search for "IAM" in the top search bar
- [ ] Click "IAM" (Identity and Access Management)

### Step 2: Create User
- [ ] Click "Users" in the left sidebar
- [ ] Click "Create user"
- [ ] User name: `reta-deployer` (or your choice)
- [ ] Check "Provide user access to AWS Management Console" (optional)
- [ ] Click "Next"

### Step 3: Set Permissions
- [ ] Select "Attach policies directly"
- [ ] Search and check these policies:
  - `AmazonS3FullAccess`
  - `CloudFrontFullAccess`
  - `AWSCloudFormationFullAccess`
  - `IAMReadOnlyAccess`
- [ ] Click "Next"
- [ ] Click "Create user"

### Step 4: Create Access Keys
- [ ] Click on your new user
- [ ] Click "Security credentials" tab
- [ ] Scroll to "Access keys"
- [ ] Click "Create access key"
- [ ] Select "Command Line Interface (CLI)"
- [ ] Check "I understand..." checkbox
- [ ] Click "Next"
- [ ] Optional: Add description tag
- [ ] Click "Create access key"

### Step 5: Save Credentials
**IMPORTANT**: You'll only see these once!

- [ ] **Access key ID**: Copy and save (looks like: `AKIAIOSFODNN7EXAMPLE`)
- [ ] **Secret access key**: Copy and save (looks like: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
- [ ] Click "Download .csv file" for backup
- [ ] Store in a secure location (password manager recommended)

---

## 4. Configure AWS CLI (2 minutes)

```bash
aws configure
```

You'll be prompted for:

```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

**Region Options**:
- `us-east-1` - US East (N. Virginia) - Cheapest, most services
- `us-west-2` - US West (Oregon)
- `eu-west-1` - Europe (Ireland)
- `ap-southeast-1` - Asia Pacific (Singapore)

### Verify Configuration
```bash
aws sts get-caller-identity
```

Should return:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/reta-deployer"
}
```

---

## 5. Install Amplify CLI (Optional - 2 minutes)

Only needed if using AWS Amplify deployment method (recommended).

```bash
npm install -g @aws-amplify/cli
```

### Verify Installation
```bash
amplify --version
# Should show: 12.x.x or higher
```

---

## 6. Deployment Method Choice

Choose ONE of these methods:

### ✅ Method 1: AWS Amplify (Recommended)
**Best for**: Quick setup, automatic HTTPS, easiest maintenance

**What you need**:
- ✓ AWS CLI configured (steps above)
- ✓ Amplify CLI installed
- ✓ Your GitHub repo access

**Command**:
```bash
npm run aws:init
npm run deploy:amplify
```

**Time**: 10 minutes
**Cost**: $5-10/month

---

### ✅ Method 2: CloudFormation (Full Control)
**Best for**: Production deployments, infrastructure as code

**What you need**:
- ✓ AWS CLI configured (steps above)
- ✓ IAM permissions for CloudFormation, S3, CloudFront

**Command**:
```bash
./deploy-cloudformation.sh
```

**Time**: 15 minutes
**Cost**: $6-12/month

---

### ✅ Method 3: Simple S3 (Quickest)
**Best for**: Testing, simple deployments

**What you need**:
- ✓ AWS CLI configured (steps above)
- ✓ IAM permissions for S3

**Command**:
```bash
export S3_BUCKET=reta-tracker-yourname
./deploy-s3.sh
```

**Time**: 5 minutes
**Cost**: $1-3/month (no HTTPS without CloudFront)

---

## 7. Environment Variables (Optional)

Only needed if you want Google Drive sync or Withings integration.

### Create .env file
```bash
cp .env.example .env
```

### Edit .env
```bash
nano .env  # or use your preferred editor
```

### Google Drive Setup
1. Go to: https://console.cloud.google.com/
2. Create new project: "Retatrutide Tracker"
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Add to .env:
   ```
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_API_KEY=your_api_key
   ```

### Withings Health Setup
1. Go to: https://developer.withings.com/
2. Create developer account
3. Create new application
4. Add to .env:
   ```
   WITHINGS_CLIENT_ID=your_client_id
   WITHINGS_CLIENT_SECRET=your_client_secret
   ```

**Note**: The .env file is gitignored and won't be deployed to AWS. You'll need to manually add these to your deployed app if needed.

---

## 8. Pre-Deployment Checklist

Before deploying, verify:

### Technical Requirements
- [ ] AWS CLI configured: `aws sts get-caller-identity`
- [ ] Node.js installed: `node --version` (16+ required)
- [ ] Tests passing: `npm test`
- [ ] Git status clean (or committed changes)

### AWS Account Verification
- [ ] IAM user has required permissions
- [ ] AWS region selected
- [ ] No existing resources with same names (check S3 bucket names)

### Data Migration Plan
- [ ] Current app accessible: https://alandooley.github.io/reta/
- [ ] Know how to export data (Settings → Data Management)
- [ ] Have browser access to export before switching

---

## 9. Deployment Execution

### Quick Start (Amplify)
```bash
cd /home/user/reta

# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize
npm run aws:init

# Add hosting
npm run aws:add-hosting

# Deploy!
npm run deploy:amplify
```

### Full Infrastructure (CloudFormation)
```bash
cd /home/user/reta

# Deploy everything
./deploy-cloudformation.sh

# Note the CloudFront URL from output
```

### Simple Deployment (S3)
```bash
cd /home/user/reta

# Set bucket name
export S3_BUCKET=reta-tracker-$(whoami)

# Deploy
./deploy-s3.sh

# Note the S3 website URL from output
```

---

## 10. Post-Deployment Verification

### Test the Deployment
- [ ] Visit your deployment URL
- [ ] Verify PWA loads correctly
- [ ] Check browser console for errors (F12)
- [ ] Verify Service Worker registers
- [ ] Test offline functionality (disconnect network)

### Migrate Your Data
- [ ] Export from: https://alandooley.github.io/reta/
- [ ] Import to: your new AWS URL
- [ ] Verify all data migrated correctly

### Install PWA
- [ ] iOS: Safari → Share → Add to Home Screen
- [ ] Android: Chrome → Menu → Add to Home Screen
- [ ] Desktop: Chrome/Edge → Install icon

### Set Up Monitoring (Optional)
- [ ] CloudWatch dashboard
- [ ] Billing alerts
- [ ] Error notifications

---

## 11. Troubleshooting Common Issues

### "AccessDenied" Error
**Cause**: IAM permissions insufficient

**Fix**:
```bash
# Verify your identity
aws sts get-caller-identity

# Check your user's policies in IAM console
```

### "BucketAlreadyExists" Error
**Cause**: S3 bucket names must be globally unique

**Fix**:
```bash
# Use a more unique name
export S3_BUCKET=reta-tracker-$(whoami)-$(date +%s)
./deploy-s3.sh
```

### "InvalidCredentials" Error
**Cause**: AWS CLI not configured correctly

**Fix**:
```bash
# Reconfigure
aws configure

# Verify
aws sts get-caller-identity
```

### Amplify Init Fails
**Cause**: Missing Amplify CLI or wrong permissions

**Fix**:
```bash
# Reinstall Amplify CLI
npm uninstall -g @aws-amplify/cli
npm install -g @aws-amplify/cli

# Verify
amplify --version
```

---

## 12. Security Best Practices

### Protect Your Credentials
- [ ] Never commit .env to git (already in .gitignore)
- [ ] Store access keys in password manager
- [ ] Rotate access keys every 90 days
- [ ] Use AWS Secrets Manager for production

### Enable MFA
- [ ] IAM Console → Your user → Security credentials
- [ ] Multi-factor authentication → Manage
- [ ] Follow setup instructions

### Monitoring
- [ ] Enable AWS CloudTrail (logs all API calls)
- [ ] Set up billing alerts
- [ ] Review IAM Access Analyzer recommendations

### Bucket Security
- [ ] S3 bucket versioning enabled (by scripts)
- [ ] Block public access except for website hosting
- [ ] Enable access logging

---

## 13. Cost Management

### Set Up Billing Alerts

1. **Go to Billing Dashboard**:
   - https://console.aws.amazon.com/billing/

2. **Create Budget**:
   - Click "Budgets" → "Create budget"
   - Type: Cost budget
   - Amount: $20/month (or your preference)
   - Alert threshold: 80% of budget
   - Email: your email

3. **Monitor Costs**:
   ```bash
   # View current month costs
   aws ce get-cost-and-usage \
     --time-period Start=2025-10-01,End=2025-10-31 \
     --granularity MONTHLY \
     --metrics BlendedCost
   ```

### Expected Costs

**First 12 months (Free Tier)**:
- S3: Free (5GB)
- CloudFront: Free (50GB/month)
- Data transfer: Free (1GB)
- **Total**: ~$0-5/month

**After Free Tier**:
- S3: ~$1-2/month
- CloudFront: ~$5-10/month
- Route 53 (if custom domain): ~$0.50/month
- **Total**: ~$6-12/month

---

## 14. Maintenance Tasks

### Regular Updates
```bash
# Pull latest code
git pull

# Test
npm test

# Deploy
npm run deploy:amplify  # or your chosen method
```

### Backup Data
- Automatic backups run every 5 minutes in the app
- Manual backup: Settings → Create Manual Backup
- Export monthly for offline storage

### Monitor Performance
```bash
# CloudFront statistics
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID

# S3 bucket size
aws s3 ls s3://your-bucket --recursive --human-readable --summarize
```

---

## 15. Quick Reference Card

**Save this for future reference:**

```bash
# My AWS Configuration
AWS Region: us-east-1
IAM User: reta-deployer
S3 Bucket: [your bucket name]
CloudFront ID: [your distribution ID]
Deployment URL: [your URL]

# Common Commands
aws sts get-caller-identity          # Verify identity
npm run deploy:amplify               # Deploy with Amplify
./deploy-cloudformation.sh           # Deploy with CloudFormation
./deploy-s3.sh                       # Deploy to S3

# Monitoring
aws s3 ls s3://[bucket]              # List bucket contents
aws cloudfront create-invalidation   # Clear CDN cache
npm test                             # Run tests before deploy

# Data Migration
1. Old site: https://alandooley.github.io/reta/
2. Settings → Data Management → Export
3. New site: [your AWS URL]
4. Settings → Data Management → Import
```

---

## Summary

You now have everything you need to deploy to AWS:

1. ✅ **AWS Account** - Created and verified
2. ✅ **AWS CLI** - Installed and configured
3. ✅ **IAM User** - Created with proper permissions
4. ✅ **Access Keys** - Generated and stored securely
5. ✅ **Deployment Scripts** - Ready to run
6. ✅ **Data Migration Plan** - Export → Import
7. ✅ **Monitoring** - Billing alerts and logs

**Next step**: Choose your deployment method and run the appropriate command!

---

## Need Help?

- **AWS Documentation**: https://docs.aws.amazon.com/
- **Amplify Docs**: https://docs.amplify.aws/
- **This project**: https://github.com/alandooley/reta
- **Issues**: https://github.com/alandooley/reta/issues

**Estimated total setup time**: 30-45 minutes (including AWS account creation)

**Ready to deploy!** 🚀
