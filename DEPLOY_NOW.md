# Deploy to AWS Now - Quick Guide

You have AWS Free Tier, so this will cost **$0/month for 12 months**!

## Before You Start (2 minutes)

Make sure you have:

1. **AWS CLI configured**:
   ```bash
   aws sts get-caller-identity
   ```

   If this fails, run:
   ```bash
   aws configure
   # Enter your Access Key ID
   # Enter your Secret Access Key
   # Region: us-east-1
   # Format: json
   ```

2. **IAM permissions**:
   Your user needs: `AmazonS3FullAccess`, `CloudFrontFullAccess`

## Deploy (1 command, 10 minutes)

```bash
cd /home/user/reta
./deploy-minimal.sh
```

That's it! The script will:
- ✅ Create S3 bucket
- ✅ Upload your app
- ✅ Configure static website hosting
- ✅ Create CloudFront distribution (HTTPS)
- ✅ Set up proper caching

## What Happens

```
Step 1: Running tests...                    [30 sec]
Step 2: Creating S3 bucket...              [5 sec]
Step 3: Uploading files...                 [10 sec]
Step 4: Configuring static hosting...      [5 sec]
Step 5: Setting public access...           [5 sec]
Step 6: Creating CloudFront distribution... [2 min]
───────────────────────────────────────────────────
Total: ~3 minutes
```

CloudFront then takes 5-15 minutes to propagate globally.

## You'll Get

At the end, you'll see:

```
========================================
Deployment Complete!
========================================

Access URLs:

  S3 (HTTP):  http://reta-tracker-yourname-123456.s3-website-us-east-1.amazonaws.com
  CloudFront (HTTPS): https://d1a2b3c4d5e6f7.cloudfront.net

⏰ CloudFront deployment takes 5-15 minutes to propagate
```

**Save that CloudFront URL!** That's your new app.

## Check CloudFront Status

While waiting:

```bash
# Check if CloudFront is ready
aws cloudfront get-distribution \
  --id YOUR_DISTRIBUTION_ID \
  --query 'Distribution.Status'

# When it shows "Deployed", you're ready!
```

## Migrate Your Data (5 minutes)

### Step 1: Export from GitHub Pages

1. Open: https://alandooley.github.io/reta/
2. Tap **Settings** (bottom nav)
3. Scroll to **Data Management**
4. Tap **Create Manual Backup**
5. Label: `Migration-to-AWS-2025-10-22`
6. Tap **Export Data to File**
7. Save the JSON file (e.g., `reta-backup.json`)

### Step 2: Import to AWS

1. Open: `https://YOUR_CLOUDFRONT_URL` (from deploy output)
2. Tap **Settings**
3. Scroll to **Data Management**
4. Tap **Import Data from File**
5. Select your `reta-backup.json`
6. Review the preview
7. Tap **Confirm Import**

### Step 3: Verify

Check that everything migrated:
- Tap **Log** - see all injections
- Tap **Vials** - see vial data
- Tap **Weight** - see weight history
- Tap **Trends** - charts render correctly

## Install as PWA

### iPhone
1. Open CloudFront URL in Safari
2. Tap Share button
3. **Add to Home Screen**

### Android
1. Open CloudFront URL in Chrome
2. Tap menu (⋮)
3. **Add to Home Screen**

### Desktop
1. Open in Chrome/Edge
2. Click install icon in address bar
3. Click **Install**

## Troubleshooting

### "AccessDenied" Error

**Problem**: IAM permissions insufficient

**Fix**:
1. Go to AWS Console → IAM
2. Find your user
3. Add policies: `AmazonS3FullAccess`, `CloudFrontFullAccess`

### "aws: command not found"

**Problem**: AWS CLI not installed

**Fix**:
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Then configure
aws configure
```

### "BucketAlreadyExists"

**Problem**: Bucket name taken (globally unique)

**Fix**: Script auto-generates unique name with timestamp

### CloudFront Takes Forever

**Normal**: CloudFront propagation takes 5-15 minutes

**Check status**:
```bash
aws cloudfront list-distributions --query 'DistributionList.Items[0].Status'
```

Wait for: `"Deployed"`

### Can't Import Data

**Problem**: JSON format issue

**Fix**:
1. Re-export from GitHub Pages
2. Verify file isn't empty: `ls -lh reta-backup.json`
3. Check JSON is valid: `cat reta-backup.json | jq`

## Future Updates

To update your deployment:

```bash
# Make changes to your code
# Test locally
npm test

# Deploy update
./deploy-minimal.sh

# CloudFront cache clear (if needed)
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Costs

**With Free Tier (12 months):**
- S3: 5GB free (you use <1MB)
- CloudFront: 50GB free (you use ~1GB/month)
- **Total: $0/month** ✅

**After Free Tier:**
- S3: ~$0.01/month
- CloudFront: ~$2-3/month
- **Total: ~$2-3/month**

## Monitor Costs

Set up billing alert:

1. Go to: https://console.aws.amazon.com/billing/
2. Click **Budgets** → **Create budget**
3. Type: Cost budget
4. Amount: $10/month
5. Alert threshold: 80%
6. Enter your email

You'll get alerted if costs exceed $8.

## What You Get

✅ **HTTPS** (required for PWA)
✅ **Global CDN** (CloudFront)
✅ **Offline support** (Service Worker)
✅ **Push notifications** (after PWA install)
✅ **Automatic backups** (every 5 minutes in app)
✅ **Version control** (S3 versioning enabled)
✅ **Professional hosting** (AWS infrastructure)

## Need Help?

**Check deployment config**:
```bash
cat .aws-deployment-config
```

**Re-run deployment**:
```bash
./deploy-minimal.sh
```

**View this guide**:
- Full guide: [AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md)
- Cost optimization: [AWS_MINIMAL_COST_DEPLOYMENT.md](AWS_MINIMAL_COST_DEPLOYMENT.md)

---

## Quick Command Reference

```bash
# Deploy
./deploy-minimal.sh

# Check AWS credentials
aws sts get-caller-identity

# List buckets
aws s3 ls

# Check CloudFront status
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,Status,DomainName]'

# View costs (current month)
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost

# Delete deployment (if needed)
aws s3 rb s3://YOUR_BUCKET_NAME --force
aws cloudfront delete-distribution --id YOUR_DISTRIBUTION_ID --if-match YOUR_ETAG
```

---

**Ready?** Run this now:

```bash
cd /home/user/reta
./deploy-minimal.sh
```

Then wait 15 minutes, and visit your new HTTPS CloudFront URL! 🚀
