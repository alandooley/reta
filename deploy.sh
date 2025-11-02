#!/bin/bash

# Retatrutide Tracker - Deployment Script
# This script deploys the frontend to AWS S3 + CloudFront

set -e  # Exit on any error

echo "🚀 Deploying Retatrutide Tracker..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROFILE="reta-admin"
REGION="eu-west-1"
BUCKET="retatrutide-frontend-372208783486"
DISTRIBUTION_ID="E2ZD0ACBBK8F5K"

# Check if on correct branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Current branch: $CURRENT_BRANCH${NC}"
echo ""

# Step 1: Deploy Backend Infrastructure
echo -e "${BLUE}🏗️  Step 1/4: Deploying backend infrastructure (Lambda + API Gateway)...${NC}"
echo -e "${YELLOW}   This may take 2-3 minutes...${NC}"
echo ""

cd reta-cloud-infrastructure
npx cdk deploy --require-approval never --profile $PROFILE 2>&1 | grep -E "(deployed|CREATE|UPDATE|Error|error)" || true
cd ..

echo -e "${GREEN}✓ Backend deployment complete${NC}"
echo ""

# Step 2: Upload Frontend to S3
echo -e "${BLUE}📤 Step 2/4: Uploading frontend files to S3...${NC}"

# Upload index.html
aws s3 cp index.html s3://$BUCKET/ \
    --profile $PROFILE \
    --region $REGION

# Upload manifest.json
aws s3 cp manifest.json s3://$BUCKET/ \
    --profile $PROFILE \
    --region $REGION

# Upload robots.txt
aws s3 cp robots.txt s3://$BUCKET/ \
    --profile $PROFILE \
    --region $REGION

# Sync js/ directory
aws s3 sync js/ s3://$BUCKET/js/ \
    --profile $PROFILE \
    --region $REGION

echo -e "${GREEN}✓ Frontend upload complete${NC}"
echo ""

# Step 3: Invalidate CloudFront cache
echo -e "${BLUE}🔄 Step 3/4: Invalidating CloudFront cache...${NC}"
INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --profile $PROFILE \
    --output json)

INVALIDATION_ID=$(echo $INVALIDATION_OUTPUT | grep -o '"Id": "[^"]*' | grep -o '[^"]*$')

echo -e "${GREEN}✓ Cache invalidation started${NC}"
echo -e "   Invalidation ID: ${INVALIDATION_ID}"
echo ""

# Step 4: Wait for propagation
echo -e "${BLUE}⏳ Step 4/4: Waiting for cache invalidation to complete...${NC}"
echo -e "   This usually takes 2-5 minutes"
echo ""

aws cloudfront wait invalidation-completed \
    --distribution-id $DISTRIBUTION_ID \
    --id $INVALIDATION_ID \
    --profile $PROFILE \
    2>/dev/null &

WAIT_PID=$!
SECONDS=0

# Show progress spinner
spin='-\|/'
i=0
while kill -0 $WAIT_PID 2>/dev/null; do
    i=$(( (i+1) %4 ))
    printf "\r   ${spin:$i:1} Waiting... ${SECONDS}s elapsed"
    sleep 1
done
wait $WAIT_PID

echo ""
echo -e "${GREEN}✓ Cache invalidation complete${NC}"
echo ""

# Success message
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo ""
echo "Your app is now live at:"
echo -e "${BLUE}https://d13m7vzwjqe4pp.cloudfront.net${NC}"
echo ""
echo "Test the delete fix:"
echo "  1. Open the app and log in"
echo "  2. Go to the Shots tab"
echo "  3. Delete a shot by swiping left and tapping Delete"
echo "  4. Reload the page"
echo "  5. The deletion should persist! 🎉"
echo ""
echo -e "${YELLOW}Note: You may need to clear browser cache if changes don't appear immediately${NC}"
