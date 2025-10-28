#!/bin/bash
# Deploy Retatrutide Tracker to AWS
# Usage: ./deploy.sh [frontend|backend|all]

set -e  # Exit on error

PROFILE="reta-admin"
REGION="eu-west-1"
BUCKET="retatrutide-frontend-372208783486"
DISTRIBUTION_ID="E2ZD0ACBBK8F5K"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

deploy_frontend() {
    echo -e "${BLUE}Deploying frontend to S3...${NC}"

    # Upload main files
    aws s3 cp index.html s3://${BUCKET}/ --profile ${PROFILE} --region ${REGION}
    aws s3 cp manifest.json s3://${BUCKET}/ --profile ${PROFILE} --region ${REGION}
    aws s3 cp robots.txt s3://${BUCKET}/ --profile ${PROFILE} --region ${REGION}
    aws s3 cp sw.js s3://${BUCKET}/ --profile ${PROFILE} --region ${REGION}

    # Sync js directory
    aws s3 sync js/ s3://${BUCKET}/js/ --delete --profile ${PROFILE} --region ${REGION}

    echo -e "${GREEN}✓ Frontend uploaded to S3${NC}"

    # Invalidate CloudFront cache
    echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id ${DISTRIBUTION_ID} \
        --paths "/*" \
        --profile ${PROFILE} \
        --query 'Invalidation.Id' \
        --output text)

    echo -e "${GREEN}✓ CloudFront invalidation created: ${INVALIDATION_ID}${NC}"
    echo -e "${BLUE}Cache will be cleared in 1-2 minutes${NC}"
}

deploy_backend() {
    echo -e "${BLUE}Deploying backend infrastructure...${NC}"

    cd reta-cloud-infrastructure

    # Build TypeScript
    echo -e "${BLUE}Building TypeScript...${NC}"
    npm run build

    # Deploy with CDK
    echo -e "${BLUE}Deploying CDK stack...${NC}"
    npx cdk deploy --require-approval never --profile ${PROFILE}

    cd ..

    echo -e "${GREEN}✓ Backend infrastructure deployed${NC}"
}

# Main deployment logic
case "${1:-all}" in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend
        ;;
    all)
        deploy_frontend
        deploy_backend
        ;;
    *)
        echo -e "${RED}Usage: $0 [frontend|backend|all]${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ Deployment complete!${NC}"
echo -e "${BLUE}Frontend: https://d13m7vzwjqe4pp.cloudfront.net/${NC}"
