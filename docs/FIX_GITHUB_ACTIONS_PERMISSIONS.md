# Fix GitHub Actions Deployment Permissions

## Problem
Your GitHub Actions workflow is failing with this error:
```
User: arn:aws:iam::372208783486:user/github-actions-deploy is not authorized to perform:
ssm:GetParameter on resource: arn:aws:ssm:eu-west-1:372208783486:parameter/cdk-bootstrap/hnb659fds/version
```

## Root Cause
The `github-actions-deploy` IAM user needs permission to:
1. Read CDK bootstrap parameters from SSM Parameter Store
2. Assume CDK deployment roles
3. Access S3 and CloudFront for frontend deployment

## Solution

### Step 1: Update IAM Policy Using AWS Console

1. **Go to IAM Console:**
   - Navigate to: https://console.aws.amazon.com/iam/
   - Click "Users" in the left sidebar
   - Click on user: `github-actions-deploy`

2. **Add Inline Policy:**
   - Click "Add permissions" → "Create inline policy"
   - Click "JSON" tab
   - Paste the contents of [github-actions-iam-policy.json](github-actions-iam-policy.json)
   - Click "Review policy"
   - Name it: `GitHubActionsDeploymentPolicy`
   - Click "Create policy"

### Step 2: Update IAM Policy Using AWS CLI

If you prefer using the command line:

```bash
# Navigate to the docs directory
cd docs

# Apply the policy to the github-actions-deploy user
aws iam put-user-policy \
  --user-name github-actions-deploy \
  --policy-name GitHubActionsDeploymentPolicy \
  --policy-document file://github-actions-iam-policy.json

# Verify the policy was applied
aws iam get-user-policy \
  --user-name github-actions-deploy \
  --policy-name GitHubActionsDeploymentPolicy
```

### Step 3: Verify CDK Bootstrap Roles Exist

The policy references specific CDK roles. Verify they exist:

```bash
# Check if CDK bootstrap roles exist
aws iam get-role \
  --role-name cdk-hnb659fds-deploy-role-372208783486-eu-west-1

aws iam get-role \
  --role-name cdk-hnb659fds-file-publishing-role-372208783486-eu-west-1

aws iam get-role \
  --role-name cdk-hnb659fds-lookup-role-372208783486-eu-west-1
```

If any role doesn't exist, you need to re-bootstrap CDK:

```bash
cd reta-cloud-infrastructure
npx cdk bootstrap aws://372208783486/eu-west-1 --profile reta-admin
```

### Step 4: Update CDK Bootstrap Trust Policies

The CDK roles need to trust your `github-actions-deploy` user. Check the trust policy:

```bash
aws iam get-role \
  --role-name cdk-hnb659fds-deploy-role-372208783486-eu-west-1 \
  --query 'Role.AssumeRolePolicyDocument'
```

If the trust policy doesn't allow your user, update it:

1. Go to IAM Console
2. Click "Roles"
3. Search for: `cdk-hnb659fds-deploy-role-372208783486-eu-west-1`
4. Click "Trust relationships" tab
5. Click "Edit trust policy"
6. Ensure it includes:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::372208783486:user/github-actions-deploy"
      },
      "Action": "sts:AssumeRole"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudformation.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Step 5: Test the Deployment

After updating the permissions, test the deployment:

**Option A: Via GitHub Actions Web UI**
1. Go to: https://github.com/alandooley/reta/actions
2. Click "Deploy Backend to AWS"
3. Click "Run workflow" → Select `main` → Click "Run workflow"

**Option B: Push a commit to trigger deployment**
```bash
# Make a small change
echo "# Test" >> docs/test.txt
git add docs/test.txt
git commit -m "test: Verify GitHub Actions deployment"
git push origin main

# Watch the deployment
# Go to: https://github.com/alandooley/reta/actions
```

## Alternative: Split Frontend and Backend Deployments

Since you already have separate workflows, you can:

### For Frontend Only Deployments
Use the existing `deploy-frontend.yml` workflow - it only needs S3 and CloudFront permissions (which your user already has).

1. Go to: https://github.com/alandooley/reta/actions
2. Click "Deploy Frontend to AWS"
3. Click "Run workflow"

This should work immediately without policy changes.

### For Backend Deployments
The backend deployment requires the CDK permissions above. Apply the policy fix for backend deployments.

## Minimal Permissions for Frontend Only

If you only want to deploy the frontend via GitHub Actions, you can use this minimal policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3FrontendAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::retatrutide-frontend-372208783486",
        "arn:aws:s3:::retatrutide-frontend-372208783486/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::372208783486:distribution/E2ZD0ACBBK8F5K"
    }
  ]
}
```

Then deploy backend changes using the local `deploy.sh` script with your `reta-admin` profile (which has full permissions).

## Recommended Approach

**For now, I recommend:**

1. **Keep backend deployments local** using `deploy.sh` with your `reta-admin` profile
2. **Use GitHub Actions only for frontend** deployments (S3 + CloudFront)

This minimizes the permissions needed for your GitHub Actions user and keeps sensitive infrastructure changes (Lambda, DynamoDB, API Gateway) in your control.

To implement this:

1. Apply the minimal frontend-only policy to `github-actions-deploy` user
2. Use "Deploy Frontend to AWS" workflow in GitHub Actions
3. Run `./deploy.sh` locally when you need to update backend infrastructure

## Verification Commands

After applying the policy, verify permissions:

```bash
# Test SSM access
aws ssm get-parameter \
  --name /cdk-bootstrap/hnb659fds/version \
  --region eu-west-1 \
  --profile reta-admin

# Test S3 access
aws s3 ls s3://retatrutide-frontend-372208783486/ \
  --region eu-west-1 \
  --profile reta-admin

# Test CloudFront access
aws cloudfront get-distribution \
  --id E2ZD0ACBBK8F5K \
  --profile reta-admin

# Test assuming CDK role
aws sts assume-role \
  --role-arn arn:aws:iam::372208783486:role/cdk-hnb659fds-deploy-role-372208783486-eu-west-1 \
  --role-session-name test-session \
  --profile reta-admin
```

## Summary

The error occurred because CDK needs to:
1. Read bootstrap metadata from SSM Parameter Store
2. Assume CDK-created roles to perform deployments
3. These permissions weren't granted to the `github-actions-deploy` user

Choose your approach:
- **Full automation:** Apply the complete policy and update trust relationships
- **Hybrid (recommended):** Frontend via GitHub Actions, backend via local script
