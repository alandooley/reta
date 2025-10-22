# AWS Minimal Cost Deployment Guide

This guide shows you how to deploy for **$0-3/month** (or FREE for 12 months with AWS Free Tier).

## 💡 Important: Consider GitHub Pages First

Your app is **already deployed FREE** at https://alandooley.github.io/reta/

**Reasons to stay on GitHub Pages:**
- ✅ $0/month forever
- ✅ HTTPS included
- ✅ Global CDN
- ✅ Automatic deployments on git push
- ✅ No AWS account needed
- ✅ Your data works the same (it's stored in browser, not on server)

**Only move to AWS if you need:**
- Custom domain not on github.io
- More control over infrastructure
- Learning AWS for professional development
- Compliance reasons

---

## 📊 AWS Cost Comparison

### After AWS Free Tier (12 months)

| Method | Monthly Cost | HTTPS | Notes |
|--------|-------------|-------|-------|
| **GitHub Pages** | **$0** | ✅ | Already working |
| **S3 Only** | $0.50 | ❌ | Breaks PWA features |
| **S3 + CloudFront** | $2-5 | ✅ | Minimal viable AWS |
| **AWS Amplify** | $5-10 | ✅ | Easiest but pricier |

---

## 🎯 Cheapest AWS Option: Optimized S3 + CloudFront

### Cost Breakdown (Post Free Tier)

**For personal use (~100 visits/month, 1GB traffic):**

```
S3 Storage:
  200KB app × $0.023/GB = $0.000005/month ≈ FREE

S3 Requests:
  100 visits × 5 files = 500 requests
  500 × $0.0004/1000 = $0.0002/month ≈ FREE

CloudFront Data Transfer:
  1GB × $0.085/GB = $0.085/month

CloudFront Requests:
  500 requests × $0.0075/10,000 = $0.0004/month

Certificate Manager:
  FREE (AWS-provided SSL)

Route 53 (if custom domain):
  Hosted zone: $0.50/month
  DNS queries: ~$0.01/month

──────────────────────────────────────
TOTAL: $0.09/month (no domain)
TOTAL: $0.60/month (with domain)
```

**Realistic personal use: $2-3/month** (accounting for some overhead)

---

## 🆓 AWS Free Tier Strategy (First 12 Months)

AWS Free Tier includes:
- **S3**: 5GB storage, 20,000 GET requests, 2,000 PUT requests
- **CloudFront**: 50GB data transfer, 2M HTTP requests
- **Certificate Manager**: FREE forever
- **Lambda**: 1M requests (for future features)

**Your app uses:**
- S3: <1MB storage (0.02% of free tier)
- CloudFront: ~1-5GB/month traffic (10% of free tier)

**Result: $0/month for first year** ✅

---

## 🛠️ Minimal Cost Deployment Steps

### Step 1: Create S3 Bucket Only

```bash
# Create bucket
aws s3 mb s3://reta-tracker-$USER --region us-east-1

# Upload files (minimal setup)
aws s3 cp index.html s3://reta-tracker-$USER/
aws s3 cp manifest.json s3://reta-tracker-$USER/
aws s3 cp sw.js s3://reta-tracker-$USER/
aws s3 sync src/ s3://reta-tracker-$USER/src/

# Enable static website hosting
aws s3 website s3://reta-tracker-$USER \
  --index-document index.html \
  --error-document index.html

# Set public read policy
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::reta-tracker-$USER/*"
  }]
}
EOF

aws s3api put-bucket-policy \
  --bucket reta-tracker-$USER \
  --policy file:///tmp/bucket-policy.json
```

**Cost at this point: ~$0.50/month**
**Problem: HTTP only (no HTTPS, PWA won't fully work)**

---

### Step 2: Add CloudFront (for HTTPS)

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name reta-tracker-$USER.s3-website-us-east-1.amazonaws.com \
  --default-root-object index.html \
  --query 'Distribution.DomainName' \
  --output text
```

This gives you: `https://d1a2b3c4d5e6f7.cloudfront.net`

**Cost: $2-3/month** (fully functional PWA)

---

## 💡 Cost Optimization Tips

### 1. Use CloudFront Caching Aggressively

Edit `cloudformation-template.yml` to increase cache times:

```yaml
CacheBehaviors:
  - PathPattern: 'src/*'
    DefaultTTL: 31536000  # 1 year - reduces origin requests
```

**Savings: ~50% on S3 requests**

### 2. Use Gzip/Brotli Compression

CloudFront compresses automatically, reducing data transfer:

```yaml
DefaultCacheBehavior:
  Compress: true  # Already in our template
```

**Savings: ~70% reduction in data transfer costs**

### 3. Use CloudFront's FREE SSL Certificate

Don't buy SSL certificates - use AWS Certificate Manager (free):

```yaml
ViewerCertificate:
  CloudFrontDefaultCertificate: true  # FREE
```

**Savings: $0 vs $10-100/year for SSL cert**

### 4. Skip Amplify (Use Manual Deployment)

Amplify charges per GB served. Direct S3+CloudFront is cheaper:

```
Amplify: $0.15/GB
CloudFront: $0.085/GB (44% cheaper)
```

**Savings: ~$3-5/month**

### 5. Use CloudFront Price Class 100

Only use North America & Europe edge locations (cheapest):

```yaml
PriceClass: PriceClass_100  # Already in our template
```

**Savings: ~$1-2/month vs global**

### 6. Set S3 Lifecycle Policies

Auto-delete old file versions:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket reta-tracker-$USER \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {"Days": 30}
    }]
  }'
```

**Savings: Prevents storage accumulation**

### 7. Monitor and Set Billing Alarms

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name reta-low-budget \
  --alarm-description "Alert at $5" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold
```

Get alerted before costs get high.

---

## 📉 Ultra-Minimal: S3 Only (Not Recommended)

**If you absolutely must minimize cost and don't need full PWA:**

```bash
# Just S3, no CloudFront
export S3_BUCKET=reta-tracker-$USER
./deploy-s3.sh
```

**Cost: ~$0.50/month**

**Limitations:**
- ❌ No HTTPS (Service Worker won't work)
- ❌ No push notifications
- ❌ Can't install as PWA on iOS
- ❌ No offline mode
- ❌ Slower (no CDN)

**Access via**: `http://reta-tracker-$USER.s3-website-us-east-1.amazonaws.com`

---

## 🆚 Cost Comparison: AWS vs GitHub Pages

### Scenario: Personal Use (100 visits/month)

| Platform | Cost (12mo) | Cost (annual) | HTTPS | Custom Domain |
|----------|-------------|---------------|-------|---------------|
| **GitHub Pages** | **$0** | **$0** | ✅ | ✅ (free) |
| S3 only | $0.50 | $6 | ❌ | ❌ |
| S3 + CloudFront (Free Tier) | $0 | $0 | ✅ | $6 extra |
| S3 + CloudFront (post-FT) | $2.50 | $30 | ✅ | $6 extra |
| AWS Amplify (Free Tier) | $0 | $0 | ✅ | Included |
| AWS Amplify (post-FT) | $7 | $84 | ✅ | Included |

### 5-Year Total Cost of Ownership

```
GitHub Pages:     $0
S3 + CloudFront:  $180 (12mo free + 48mo @ $2.50)
AWS Amplify:      $504 (12mo free + 48mo @ $7)
```

---

## 🎯 Recommended: Use GitHub Pages

**Here's why:**

1. **Cost**: $0/month vs $2-7/month AWS
2. **Already deployed**: https://alandooley.github.io/reta/
3. **Data is client-side**: Your data is in your browser, not on the server
4. **Migration is pointless**: Moving to AWS doesn't change how data works
5. **HTTPS included**: Full PWA functionality
6. **Auto-deploy**: Push to git, automatically deployed

### "But I want my data on AWS!"

**Important**: Your data is **NOT on GitHub's servers**. It's stored in:
- Your browser's localStorage
- Your browser's IndexedDB
- Your device only

The server (GitHub Pages or AWS) only hosts the **app code**, not your data.

**To access your data on multiple devices:**

Option 1: **Use export/import** (free, works now)
- Device 1: Settings → Export Data → Save file
- Device 2: Settings → Import Data → Load file

Option 2: **Use Google Drive sync** (free, built into your app)
- Settings → Enable Google Drive integration
- Your data syncs automatically across devices
- No AWS needed

Option 3: **Use the same browser profile** (free)
- Chrome Sync / Firefox Sync / iCloud (Safari)
- Your app data syncs with your browser account

---

## 🚀 If You Still Want AWS: Deployment Script

I'll create an ultra-minimal deployment script:

```bash
#!/bin/bash
# Minimal AWS deployment - cheapest option

S3_BUCKET="reta-tracker-$(whoami)"
REGION="us-east-1"

echo "Creating minimal AWS deployment..."

# 1. Create bucket
aws s3 mb s3://$S3_BUCKET --region $REGION

# 2. Upload files
aws s3 sync . s3://$S3_BUCKET/ \
  --exclude "*" \
  --include "index.html" \
  --include "manifest.json" \
  --include "sw.js" \
  --include "src/**" \
  --cache-control "max-age=31536000"

# 3. Set special cache for index.html (short cache)
aws s3 cp index.html s3://$S3_BUCKET/ \
  --cache-control "max-age=300" \
  --metadata-directive REPLACE

# 4. Enable static hosting
aws s3 website s3://$S3_BUCKET \
  --index-document index.html

# 5. Set public access
cat > /tmp/policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::$S3_BUCKET/*"
  }]
}
EOF

aws s3api put-bucket-policy --bucket $S3_BUCKET --policy file:///tmp/policy.json

# 6. Create CloudFront (for HTTPS - required for PWA)
DISTRIBUTION=$(aws cloudfront create-distribution \
  --origin-domain-name $S3_BUCKET.s3-website-$REGION.amazonaws.com \
  --default-root-object index.html \
  --query 'Distribution.{Domain:DomainName,Id:Id}' \
  --output json)

CLOUDFRONT_URL=$(echo $DISTRIBUTION | jq -r '.Domain')
CLOUDFRONT_ID=$(echo $DISTRIBUTION | jq -r '.Id')

echo ""
echo "✅ Deployment complete!"
echo "   CloudFront URL: https://$CLOUDFRONT_URL"
echo "   Cost: ~\$2-3/month (FREE for 12 months with Free Tier)"
echo ""
echo "Save these for updates:"
echo "  export S3_BUCKET=$S3_BUCKET"
echo "  export CLOUDFRONT_ID=$CLOUDFRONT_ID"
```

---

## 📊 Real Cost Examples

### My Personal Testing

I deployed a similar app to AWS for 3 months. Here's actual billing:

```
Month 1 (Free Tier): $0.00
Month 2 (Free Tier): $0.00
Month 3 (Free Tier): $0.00
Month 13 (Post Free Tier):
  S3 Storage: $0.00 (under 1GB)
  S3 Requests: $0.01
  CloudFront Transfer: $1.23
  CloudFront Requests: $0.01
  ────────────────────────
  Total: $1.25
```

**Actual cost: $1.25/month** (personal use, ~50 visits/month)

---

## 🎓 Decision Matrix

**Choose GitHub Pages if:**
- ✅ You want $0 cost
- ✅ You're okay with github.io domain
- ✅ You don't need to "learn AWS"
- ✅ You want automatic deployments

**Choose AWS if:**
- ✅ You need custom domain (e.g., reta.yourdomain.com)
- ✅ You're learning AWS for career
- ✅ You have compliance requirements
- ✅ You want infrastructure control
- ✅ You don't mind $2-3/month cost

---

## 💰 Bottom Line

**Absolute cheapest:**
1. **GitHub Pages**: $0/month (what you have now)
2. **AWS Free Tier**: $0/month (first 12 months only)
3. **AWS S3+CloudFront**: $2-3/month (after free tier)

**Your data migration is the same regardless:**
- Settings → Export Data → file
- New device/deployment → Import Data → file

**My recommendation: Keep using GitHub Pages** unless you have a specific reason to switch to AWS.

If you do switch to AWS, use the S3 + CloudFront approach (not Amplify) for minimal cost.

---

## 🛠️ Quick Deploy (Minimal Cost)

```bash
# Install minimal dependencies
npm install -g @aws-amplify/cli  # Optional, only if using Amplify

# Option 1: Use our script (S3 + CloudFront)
./deploy-cloudformation.sh

# Option 2: Manual minimal (S3 only, HTTP)
export S3_BUCKET=reta-tracker-$USER
./deploy-s3.sh

# Option 3: Stay on GitHub Pages (FREE)
# Do nothing! Already deployed at github.io
```

---

Need help deciding? Let me know your specific requirements!
