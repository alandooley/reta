#!/bin/bash

# AWS CloudFormation Deployment Script for Retatrutide Tracker
# This script creates the full AWS infrastructure using CloudFormation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}CloudFormation Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Configuration
STACK_NAME="${STACK_NAME:-reta-tracker-stack}"
PROJECT_NAME="${PROJECT_NAME:-reta-tracker}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Stack Name: $STACK_NAME"
echo "  Project Name: $PROJECT_NAME"
echo "  AWS Region: $AWS_REGION"
echo ""

# Step 1: Validate template
echo -e "${YELLOW}Step 1: Validating CloudFormation template...${NC}"
if aws cloudformation validate-template \
    --template-body file://cloudformation-template.yml \
    --region "$AWS_REGION" > /dev/null; then
    echo -e "${GREEN}✓ Template is valid${NC}"
else
    echo -e "${RED}✗ Template validation failed${NC}"
    exit 1
fi
echo ""

# Step 2: Create or update stack
echo -e "${YELLOW}Step 2: Creating CloudFormation stack...${NC}"
if aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" &> /dev/null; then

    echo "Stack exists, updating..."
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://cloudformation-template.yml \
        --parameters ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_IAM

    echo "Waiting for stack update to complete..."
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION"
else
    echo "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://cloudformation-template.yml \
        --parameters ParameterKey=ProjectName,ParameterValue="$PROJECT_NAME" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_IAM

    echo "Waiting for stack creation to complete..."
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION"
fi
echo -e "${GREEN}✓ Stack ready${NC}"
echo ""

# Step 3: Get stack outputs
echo -e "${YELLOW}Step 3: Retrieving stack outputs...${NC}"
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs' \
    --output json)

BUCKET_NAME=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue')
CLOUDFRONT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CloudFrontDistributionId") | .OutputValue')
CLOUDFRONT_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CloudFrontURL") | .OutputValue')
S3_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="BucketWebsiteURL") | .OutputValue')

echo -e "${GREEN}✓ Stack outputs retrieved${NC}"
echo ""

# Step 4: Deploy application files
echo -e "${YELLOW}Step 4: Deploying application files to S3...${NC}"

# Upload main files
aws s3 cp index.html "s3://$BUCKET_NAME/" \
    --content-type "text/html" \
    --cache-control "max-age=300" \
    --metadata-directive REPLACE

aws s3 cp manifest.json "s3://$BUCKET_NAME/" \
    --content-type "application/json" \
    --cache-control "max-age=3600" \
    --metadata-directive REPLACE

aws s3 cp sw.js "s3://$BUCKET_NAME/" \
    --content-type "application/javascript" \
    --cache-control "max-age=0, must-revalidate" \
    --metadata-directive REPLACE

# Sync source directory
aws s3 sync src/ "s3://$BUCKET_NAME/src/" \
    --delete \
    --cache-control "max-age=31536000" \
    --exclude "*.md"

echo -e "${GREEN}✓ Files deployed to S3${NC}"
echo ""

# Step 5: Invalidate CloudFront cache
echo -e "${YELLOW}Step 5: Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}✓ CloudFront invalidation created: $INVALIDATION_ID${NC}"
echo ""

# Display results
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Stack Information:${NC}"
echo "  Stack Name: $STACK_NAME"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  CloudFront Distribution: $CLOUDFRONT_ID"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  CloudFront (HTTPS): ${GREEN}https://$CLOUDFRONT_URL${NC}"
echo "  S3 Website: ${YELLOW}$S3_URL${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Visit https://$CLOUDFRONT_URL to verify deployment"
echo "2. Export your data from: https://alandooley.github.io/reta/"
echo "3. Import your data into the new AWS deployment"
echo "4. (Optional) Set up custom domain via Route 53"
echo ""
echo -e "${BLUE}Save these for future deployments:${NC}"
echo "  export S3_BUCKET=$BUCKET_NAME"
echo "  export CLOUDFRONT_DISTRIBUTION_ID=$CLOUDFRONT_ID"
echo ""
