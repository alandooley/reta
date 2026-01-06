# Deploy RETA Command

Deploy the RETA application to AWS.

## Pre-Deployment Checks

1. **Run Tests**
   ```bash
   npm test
   ```
   ALL tests must pass before deployment.

2. **Verify CDK Builds**
   ```bash
   cd reta-cloud-infrastructure
   npm run build
   npx cdk diff --profile reta-admin
   cd ..
   ```

3. **Check for Uncommitted Changes**
   ```bash
   git status
   ```

## Deployment Options

### Option 1: Automated Script (Recommended)
```bash
./deploy.sh
```

### Option 2: GitHub Actions
1. Push to main branch
2. Or manually trigger workflow at: https://github.com/alandooley/reta/actions

### Option 3: Manual Steps
```bash
# 1. Deploy infrastructure
cd reta-cloud-infrastructure
npx cdk deploy --require-approval never --profile reta-admin
cd ..

# 2. Deploy frontend
aws s3 cp index.html s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 cp manifest.json s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
aws s3 sync js/ s3://retatrutide-frontend-372208783486/js/ --profile reta-admin --region eu-west-1

# 3. Invalidate cache
aws cloudfront create-invalidation --distribution-id E2ZD0ACBBK8F5K --paths "/*" --profile reta-admin
```

## Post-Deployment Verification

1. **Check CloudFront URL**: https://d13m7vzwjqe4pp.cloudfront.net
2. **Test Login**: Firebase auth works
3. **Test CRUD**: Add/edit/delete injection
4. **Check CloudWatch Logs** for errors
