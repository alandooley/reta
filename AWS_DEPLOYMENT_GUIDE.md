# AWS Deployment Guide for Retatrutide Tracker

This guide walks you through deploying your Retatrutide Tracker PWA to AWS and migrating your data from the GitHub Pages deployment.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Option A: AWS Amplify (Recommended)](#option-a-aws-amplify-recommended)
4. [Option B: AWS S3 + CloudFront](#option-b-aws-s3--cloudfront)
5. [Data Migration](#data-migration)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

- [ ] **AWS Account** - [Sign up here](https://aws.amazon.com/)
- [ ] **AWS CLI installed** - [Installation guide](https://aws.amazon.com/cli/)
- [ ] **AWS credentials configured** - Run `aws configure`
- [ ] **Node.js 16+** - Already installed if you've run the app locally
- [ ] **Your GitHub Pages data** - Currently at https://alandooley.github.io/reta/

### Verify AWS CLI Setup

```bash
# Check AWS CLI is installed
aws --version

# Verify credentials are configured
aws sts get-caller-identity
```

---

## Deployment Options

### Quick Comparison

| Feature | AWS Amplify | S3 + CloudFront |
|---------|-------------|-----------------|
| Setup Time | 10 minutes | 30-45 minutes |
| Complexity | Low | Medium |
| HTTPS | Automatic | Manual setup |
| Cost | ~$5-10/month | ~$6-12/month |
| CI/CD | Built-in | Manual setup |
| Best For | Quick deployment | Custom control |

---

## Option A: AWS Amplify (Recommended)

AWS Amplify provides the fastest path to deployment with automatic HTTPS, CI/CD, and minimal configuration.

### Step 1: Install Amplify CLI

```bash
npm install -g @aws-amplify/cli
```

### Step 2: Initialize Amplify

```bash
# In your project directory
cd /home/user/reta

# Initialize Amplify
amplify init

# Answer the prompts:
# ? Enter a name for the project: reta
# ? Initialize the project with the above configuration? Yes
# ? Select the authentication method you want to use: AWS profile
# ? Please choose the profile you want to use: default
```

### Step 3: Add Hosting

```bash
amplify add hosting

# Answer the prompts:
# ? Select the plugin module to execute: Hosting with Amplify Console
# ? Choose a type: Manual deployment
```

### Step 4: Deploy

```bash
# Build and deploy
amplify publish

# This will:
# 1. Run your tests
# 2. Upload your files to AWS
# 3. Set up HTTPS
# 4. Provide you with a live URL
```

### Step 5: Note Your Deployment URL

After deployment completes, Amplify will provide a URL like:
```
https://main.d1a2b3c4d5e6f7.amplifyapp.com
```

**Save this URL!** You'll need it for data migration.

---

## Option B: AWS S3 + CloudFront

For more control over your deployment, use S3 for storage and CloudFront for HTTPS/CDN.

### Step 1: Set Environment Variables

```bash
export S3_BUCKET=reta-tracker-YOUR_NAME
export AWS_REGION=us-east-1
```

### Step 2: Run Deployment Script

```bash
# Make the script executable
chmod +x deploy-s3.sh

# Run deployment
./deploy-s3.sh
```

The script will:
- ✓ Run tests
- ✓ Create S3 bucket
- ✓ Upload files
- ✓ Configure static website hosting
- ✓ Set public access policy

### Step 3: Set Up CloudFront (for HTTPS)

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name $S3_BUCKET.s3-website-$AWS_REGION.amazonaws.com \
  --default-root-object index.html

# This will output a Distribution ID and Domain Name
# Save these values!
```

### Step 4: Configure SSL Certificate

1. Go to AWS Certificate Manager (ACM)
2. Request a public certificate
3. Add your domain name
4. Verify domain ownership (DNS or Email)
5. Attach certificate to CloudFront distribution

### Step 5: Update CloudFront Distribution

```bash
# After certificate is issued, update your distribution
export CLOUDFRONT_DISTRIBUTION_ID=YOUR_DISTRIBUTION_ID

# Invalidate cache after updates
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

---

## Data Migration

Your data is currently stored in browser localStorage/IndexedDB on the GitHub Pages site. Here's how to migrate it:

### Step 1: Export Data from GitHub Pages

1. **Open your current site**: https://alandooley.github.io/reta/
2. **Navigate to Settings tab** (bottom navigation)
3. **Scroll to "Data Management" section**
4. **Click "Create Manual Backup"**
5. **Enter a label**: "Migration to AWS - [Today's Date]"
6. **Click "Export Data to File"**
7. **Save the JSON file** to your computer (e.g., `reta-data-backup.json`)

### Step 2: Verify Export

Open the downloaded file and verify it contains:
- `injections` array
- `vials` array
- `weights` array
- `settings` object
- `version` field

### Step 3: Import Data to AWS Deployment

1. **Open your new AWS deployment** (URL from Amplify or CloudFront)
2. **Navigate to Settings tab**
3. **Scroll to "Data Management" section**
4. **Click "Import Data from File"**
5. **Select your exported JSON file**
6. **Review the import preview**
7. **Click "Confirm Import"**

### Step 4: Verify Migration

After import, verify:
- [ ] All injections are present
- [ ] Vial data is correct
- [ ] Weight history matches
- [ ] Charts render correctly
- [ ] Settings are preserved

### Automatic Backups

The app automatically creates backups every 5 minutes. After migration:
- Check Settings → Data Management → Backup History
- You should see automatic backups starting after import
- Download a backup to verify the system is working

---

## Post-Deployment Configuration

### Configure Environment Variables

If you want to enable Google Drive sync or Withings integration:

#### For Amplify:
```bash
amplify env add

# Add environment variables through Amplify Console:
# 1. Go to AWS Amplify Console
# 2. Select your app
# 3. Environment variables → Manage variables
# 4. Add each variable from .env.example
```

#### For S3/CloudFront:
Environment variables need to be added to the deployed `index.html` or served via a backend API.

### Update Service Worker

The Service Worker caches assets. After any update:

1. Update the version in `sw.js`:
```javascript
const CACHE_NAME = 'injection-tracker-v1.1.1'; // Increment version
```

2. Redeploy:
```bash
# Amplify
amplify publish

# S3
./deploy-s3.sh
```

### Set Up Custom Domain (Optional)

#### For Amplify:
```bash
amplify add domain

# Follow prompts to add your custom domain
# Amplify will handle SSL/DNS automatically
```

#### For CloudFront:
1. Update Route 53 with CloudFront distribution
2. Attach ACM certificate
3. Add CNAME record pointing to CloudFront domain

---

## Monitoring and Maintenance

### CloudWatch Logs

Monitor your application:

```bash
# View recent logs
aws logs tail /aws/amplify/reta --follow

# For S3, enable access logging:
aws s3api put-bucket-logging \
  --bucket $S3_BUCKET \
  --bucket-logging-status \
    "LoggingEnabled={TargetBucket=$S3_BUCKET-logs,TargetPrefix=access-logs/}"
```

### Cost Monitoring

Set up billing alerts:

```bash
# Create SNS topic for alerts
aws sns create-topic --name reta-billing-alerts

# Subscribe to topic
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:reta-billing-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Create billing alarm (e.g., $20/month threshold)
aws cloudwatch put-metric-alarm \
  --alarm-name reta-billing-alarm \
  --alarm-description "Alert when billing exceeds $20" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold
```

### Regular Backups

Although the app has automatic backups, consider:

1. **Manual backups before major updates**
2. **Weekly exports** to your local machine
3. **Cloud backup** (Google Drive sync feature)

---

## Troubleshooting

### Issue: PWA Won't Install on AWS Deployment

**Cause**: HTTPS is required for PWA installation.

**Solution**:
- For Amplify: HTTPS is automatic
- For S3: Set up CloudFront with SSL certificate
- Verify manifest.json is being served with correct MIME type

### Issue: Service Worker Not Registering

**Cause**: Service Workers require HTTPS (except localhost).

**Check**:
```bash
# Verify sw.js is accessible
curl https://your-deployment-url/sw.js

# Check response headers
curl -I https://your-deployment-url/sw.js
```

**Solution**: Ensure `sw.js` has `Content-Type: application/javascript`

### Issue: Data Import Fails

**Symptoms**: "Invalid data format" error during import.

**Solution**:
1. Verify JSON file is valid: `cat backup.json | jq`
2. Check version compatibility in the JSON file
3. Try exporting again from GitHub Pages
4. Contact support if issue persists

### Issue: Charts Not Rendering

**Cause**: CDN resources (Chart.js) blocked or failed to load.

**Check**:
1. Open browser console (F12)
2. Look for 404 errors for Chart.js
3. Verify Content Security Policy isn't blocking CDN

**Solution**: Ensure these URLs are accessible:
- https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js
- https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js

### Issue: High AWS Costs

**Check**:
```bash
# View current month costs
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

**Common causes**:
- CloudFront data transfer (high traffic)
- S3 request costs (frequent API calls)
- Data storage (backups accumulating)

**Solutions**:
- Enable CloudFront caching
- Set S3 lifecycle policies to archive old versions
- Use CloudFront's compression

---

## Next Steps

After successful deployment:

1. **Bookmark your AWS deployment URL**
2. **Update PWA on all your devices**
   - iOS: Safari → Share → Add to Home Screen
   - Android: Chrome → Menu → Add to Home Screen
3. **Set up push notifications** (requires HTTPS)
4. **Enable automatic backups** (verify in Settings)
5. **Consider custom domain** for easier access

---

## Support

For issues with:
- **This deployment**: Check GitHub issues at https://github.com/alandooley/reta/issues
- **AWS Amplify**: https://docs.amplify.aws/
- **AWS S3/CloudFront**: https://docs.aws.amazon.com/
- **The app itself**: Create an issue on GitHub

---

## Security Checklist

Before going live:

- [ ] Environment variables (API keys) are not in Git
- [ ] S3 bucket has appropriate access policies
- [ ] CloudFront has security headers configured
- [ ] SSL/TLS certificate is valid
- [ ] Automatic backups are enabled
- [ ] Billing alerts are set up
- [ ] Access logs are enabled

---

## Estimated Timeline

| Task | Time |
|------|------|
| AWS account setup | 10 min |
| Amplify deployment | 10 min |
| Data export | 2 min |
| Data import | 2 min |
| Testing | 10 min |
| **Total (Amplify)** | **~35 min** |
| | |
| S3 + CloudFront setup | 45 min |
| SSL certificate | 15 min |
| **Total (S3 route)** | **~75 min** |

---

## Cost Breakdown

### Amplify Hosting
```
Build time: Free (1000 minutes/month)
Hosting: ~$0.15/GB served
Data transfer: ~$0.15/GB
Estimated: $5-10/month for personal use
```

### S3 + CloudFront
```
S3 Storage: ~$0.023/GB
S3 Requests: ~$0.0004/1000 requests
CloudFront: ~$0.085/GB (first 10TB)
Certificate Manager: Free
Route 53: ~$0.50/month
Estimated: $6-12/month for personal use
```

---

## Rollback Plan

If you need to rollback to GitHub Pages:

1. Your data is still in the browser at https://alandooley.github.io/reta/
2. GitHub Pages deployment is still active
3. No data is lost during AWS deployment
4. You can use both deployments simultaneously

To make GitHub Pages primary again:
- Simply continue using that URL
- Both deployments are independent
- Data can be synced via export/import

---

**Ready to deploy?** Start with [Option A: AWS Amplify](#option-a-aws-amplify-recommended) for the quickest path to production!
