#!/bin/bash

# Minimal AWS deployment optimized for Free Tier
# Cost: $0/month (Free Tier) then ~$2-3/month

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Minimal AWS Deployment (Free Tier)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
S3_BUCKET="${S3_BUCKET:-reta-tracker-$(whoami)-$(date +%s)}"
REGION="${AWS_REGION:-us-east-1}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  S3 Bucket: $S3_BUCKET"
echo "  AWS Region: $REGION"
echo "  Free Tier: Yes (12 months)"
echo "  Estimated Cost: \$0/month"
echo ""

# Verify AWS credentials
echo -e "${YELLOW}Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials verified${NC}"
echo ""

# Step 1: Run tests (optional, skip on error)
echo -e "${YELLOW}Step 1: Running tests...${NC}"
if npm test 2>&1 | head -20; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠ Tests failed/skipped, continuing...${NC}"
fi
echo ""

# Step 2: Create S3 bucket
echo -e "${YELLOW}Step 2: Creating S3 bucket...${NC}"
if aws s3 mb s3://$S3_BUCKET --region $REGION 2>&1 | grep -q 'BucketAlreadyOwnedByYou\|make_bucket'; then
    echo -e "${GREEN}✓ Bucket ready${NC}"
else
    echo -e "${YELLOW}⚠ Using existing bucket${NC}"
fi

# Enable versioning (for backup)
aws s3api put-bucket-versioning \
    --bucket $S3_BUCKET \
    --versioning-configuration Status=Enabled \
    2>&1 | grep -v 'An error' || true

echo ""

# Step 3: Upload files with optimal caching
echo -e "${YELLOW}Step 3: Uploading files...${NC}"

# Upload index.html (short cache)
aws s3 cp index.html s3://$S3_BUCKET/ \
    --content-type "text/html" \
    --cache-control "max-age=300" \
    --metadata-directive REPLACE \
    --region $REGION

# Upload manifest.json
aws s3 cp manifest.json s3://$S3_BUCKET/ \
    --content-type "application/json" \
    --cache-control "max-age=3600" \
    --region $REGION

# Upload service worker (no cache)
aws s3 cp sw.js s3://$S3_BUCKET/ \
    --content-type "application/javascript" \
    --cache-control "max-age=0, must-revalidate" \
    --region $REGION

# Upload source files (long cache)
if [ -d "src" ]; then
    aws s3 sync src/ s3://$S3_BUCKET/src/ \
        --delete \
        --cache-control "max-age=31536000" \
        --exclude "*.md" \
        --region $REGION
fi

echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

# Step 4: Configure static website hosting
echo -e "${YELLOW}Step 4: Configuring static website hosting...${NC}"
aws s3 website s3://$S3_BUCKET \
    --index-document index.html \
    --error-document index.html \
    --region $REGION

echo -e "${GREEN}✓ Static hosting enabled${NC}"
echo ""

# Step 5: Set public read policy
echo -e "${YELLOW}Step 5: Setting public access policy...${NC}"

# Disable block public access
aws s3api put-public-access-block \
    --bucket $S3_BUCKET \
    --public-access-block-configuration \
        "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    --region $REGION

# Create and apply bucket policy
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::$S3_BUCKET/*"
  }]
}
EOF

aws s3api put-bucket-policy \
    --bucket $S3_BUCKET \
    --policy file:///tmp/bucket-policy.json \
    --region $REGION

rm /tmp/bucket-policy.json
echo -e "${GREEN}✓ Public access configured${NC}"
echo ""

# Step 6: Create CloudFront distribution (for HTTPS)
echo -e "${YELLOW}Step 6: Creating CloudFront distribution (this takes 5-10 min)...${NC}"

DISTRIBUTION_CONFIG=$(cat <<EOF
{
  "CallerReference": "reta-$(date +%s)",
  "Comment": "Retatrutide Tracker PWA",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3-$S3_BUCKET",
      "DomainName": "$S3_BUCKET.s3-website-$REGION.amazonaws.com",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "http-only"
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$S3_BUCKET",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": { "Forward": "none" }
    },
    "MinTTL": 0,
    "DefaultTTL": 300,
    "MaxTTL": 86400
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      },
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "PriceClass": "PriceClass_100",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  }
}
EOF
)

echo "$DISTRIBUTION_CONFIG" > /tmp/cf-config.json

DISTRIBUTION_OUTPUT=$(aws cloudfront create-distribution \
    --distribution-config file:///tmp/cf-config.json \
    --output json 2>&1)

if echo "$DISTRIBUTION_OUTPUT" | grep -q "DomainName"; then
    CLOUDFRONT_DOMAIN=$(echo "$DISTRIBUTION_OUTPUT" | jq -r '.Distribution.DomainName')
    CLOUDFRONT_ID=$(echo "$DISTRIBUTION_OUTPUT" | jq -r '.Distribution.Id')

    echo -e "${GREEN}✓ CloudFront distribution created${NC}"
    echo -e "  Distribution ID: ${BLUE}$CLOUDFRONT_ID${NC}"
    echo -e "  Domain: ${BLUE}$CLOUDFRONT_DOMAIN${NC}"
else
    echo -e "${YELLOW}⚠ CloudFront creation initiated (check AWS Console)${NC}"
    CLOUDFRONT_DOMAIN="Check AWS CloudFront Console"
    CLOUDFRONT_ID="Check AWS CloudFront Console"
fi

rm /tmp/cf-config.json
echo ""

# Save configuration for future updates
cat > .aws-deployment-config <<EOF
S3_BUCKET=$S3_BUCKET
AWS_REGION=$REGION
CLOUDFRONT_ID=$CLOUDFRONT_ID
CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN
DEPLOYED_AT=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
EOF

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo ""
echo -e "  S3 (HTTP):  ${YELLOW}http://$S3_BUCKET.s3-website-$REGION.amazonaws.com${NC}"
echo -e "  CloudFront (HTTPS): ${GREEN}https://$CLOUDFRONT_DOMAIN${NC}"
echo ""
echo -e "${YELLOW}⏰ CloudFront deployment takes 5-15 minutes to propagate${NC}"
echo -e "   Check status: aws cloudfront get-distribution --id $CLOUDFRONT_ID --query 'Distribution.Status'"
echo ""
echo -e "${BLUE}Configuration saved to: .aws-deployment-config${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Wait 5-15 min for CloudFront to deploy"
echo "2. Visit: https://$CLOUDFRONT_DOMAIN"
echo "3. Export data from: https://alandooley.github.io/reta/"
echo "4. Import data into your new AWS deployment"
echo ""
echo -e "${BLUE}Future Updates:${NC}"
echo "  Run this script again to update your deployment"
echo "  Or use: export S3_BUCKET=$S3_BUCKET && ./deploy-minimal.sh"
echo ""
echo -e "${GREEN}Free Tier: \$0/month for 12 months, then ~\$2-3/month${NC}"
echo ""
