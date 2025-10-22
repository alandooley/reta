#!/bin/bash

# AWS S3 + CloudFront Deployment Script for Retatrutide Tracker
# This script deploys the PWA to AWS S3 with CloudFront distribution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Retatrutide Tracker - AWS Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
S3_BUCKET="${S3_BUCKET:-reta-tracker-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID}"

# Validate environment variables
if [ -z "$S3_BUCKET" ]; then
    echo -e "${RED}Error: S3_BUCKET environment variable is not set${NC}"
    echo "Usage: S3_BUCKET=my-bucket ./deploy-s3.sh"
    exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  S3 Bucket: $S3_BUCKET"
echo "  AWS Region: $AWS_REGION"
echo "  CloudFront Distribution: ${CLOUDFRONT_DISTRIBUTION_ID:-Not configured}"
echo ""

# Step 1: Run tests
echo -e "${YELLOW}Step 1: Running tests...${NC}"
if npm test; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Step 2: Create S3 bucket if it doesn't exist
echo -e "${YELLOW}Step 2: Checking S3 bucket...${NC}"
if aws s3 ls "s3://$S3_BUCKET" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Creating S3 bucket: $S3_BUCKET"
    aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION"

    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$S3_BUCKET" \
        --versioning-configuration Status=Enabled

    # Configure bucket for static website hosting
    aws s3 website "s3://$S3_BUCKET" \
        --index-document index.html \
        --error-document index.html

    echo -e "${GREEN}✓ Bucket created and configured${NC}"
else
    echo -e "${GREEN}✓ Bucket exists${NC}"
fi
echo ""

# Step 3: Sync files to S3
echo -e "${YELLOW}Step 3: Uploading files to S3...${NC}"

# Upload main files with appropriate cache headers
aws s3 cp index.html "s3://$S3_BUCKET/" \
    --content-type "text/html" \
    --cache-control "max-age=300" \
    --metadata-directive REPLACE

aws s3 cp manifest.json "s3://$S3_BUCKET/" \
    --content-type "application/json" \
    --cache-control "max-age=3600" \
    --metadata-directive REPLACE

aws s3 cp sw.js "s3://$S3_BUCKET/" \
    --content-type "application/javascript" \
    --cache-control "max-age=0, must-revalidate" \
    --metadata-directive REPLACE

# Upload source files
aws s3 sync src/ "s3://$S3_BUCKET/src/" \
    --delete \
    --cache-control "max-age=31536000" \
    --exclude "*.md"

echo -e "${GREEN}✓ Files uploaded to S3${NC}"
echo ""

# Step 4: Set bucket policy for public access
echo -e "${YELLOW}Step 4: Setting bucket policy...${NC}"
cat > /tmp/bucket-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$S3_BUCKET/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy \
    --bucket "$S3_BUCKET" \
    --policy file:///tmp/bucket-policy.json

rm /tmp/bucket-policy.json
echo -e "${GREEN}✓ Bucket policy set${NC}"
echo ""

# Step 5: Invalidate CloudFront cache (if configured)
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${YELLOW}Step 5: Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*"
    echo -e "${GREEN}✓ CloudFront cache invalidated${NC}"
else
    echo -e "${YELLOW}Step 5: Skipping CloudFront invalidation (not configured)${NC}"
fi
echo ""

# Display deployment URL
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "S3 Website URL: ${GREEN}http://$S3_BUCKET.s3-website-$AWS_REGION.amazonaws.com${NC}"
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "CloudFront URL: ${GREEN}Check AWS Console for CloudFront domain${NC}"
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Visit the S3 URL to verify the deployment"
echo "2. Export your data from: https://alandooley.github.io/reta/"
echo "3. Import your data into the new AWS deployment"
echo "4. (Optional) Set up CloudFront for HTTPS and CDN"
echo ""
