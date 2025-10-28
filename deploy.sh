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
TARGET_BRANCH="claude/mobile-graph-ux-review-011CUZTYadnTQvRKxoSkJ2st"

if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
    echo -e "${YELLOW}⚠️  Not on deployment branch. Switching...${NC}"
    git fetch origin
    git checkout $TARGET_BRANCH
    echo -e "${GREEN}✓ Switched to $TARGET_BRANCH${NC}"
    echo ""
fi

# Step 1: Upload to S3
echo -e "${BLUE}📤 Step 1/3: Uploading index.html to S3...${NC}"
aws s3 cp index.html s3://$BUCKET/ \
    --profile $PROFILE \
    --region $REGION

echo -e "${GREEN}✓ Upload complete${NC}"
echo ""

# Step 2: Invalidate CloudFront cache
echo -e "${BLUE}🔄 Step 2/3: Invalidating CloudFront cache...${NC}"
INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --profile $PROFILE \
    --output json)

INVALIDATION_ID=$(echo $INVALIDATION_OUTPUT | grep -o '"Id": "[^"]*' | grep -o '[^"]*$')

echo -e "${GREEN}✓ Cache invalidation started${NC}"
echo -e "   Invalidation ID: ${INVALIDATION_ID}"
echo ""

# Step 3: Wait for propagation
echo -e "${BLUE}⏳ Step 3/3: Waiting for cache invalidation to complete...${NC}"
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
echo "Test on your iPhone 16 Pro:"
echo "  1. Open the URL above in Chrome"
echo "  2. Hard refresh (pull to refresh)"
echo "  3. Look for SVG icons in bottom navigation"
echo "  4. Check that chart is taller on Results tab"
echo "  5. Try the blue FAB button (bottom-right)"
echo ""
echo -e "${YELLOW}Note: You may need to clear Safari cache if changes don't appear immediately${NC}"
