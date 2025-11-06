# Fix IAM Permissions for GitHub Actions Deployment

## Problem

The GitHub Actions deployment fails with:

```
AccessDeniedException: User: arn:aws:iam::372208783486:user/github-actions-deploy
is not authorized to perform: ssm:GetParameter on resource:
arn:aws:ssm:eu-west-1:372208783486:parameter/cdk-bootstrap/hnb659fds/version
```

This means the `github-actions-deploy` IAM user lacks the necessary permissions for CDK deployments.

---

## Solution Options

### Option A: Use AWS Console (Easiest)

1. **Go to AWS IAM Console**:
   - https://console.aws.amazon.com/iam/
   - Sign in with your `reta-admin` credentials

2. **Navigate to the IAM User**:
   - Click **Users** in the left sidebar
   - Click on `github-actions-deploy`

3. **Add Inline Policy**:
   - Click the **Permissions** tab
   - Click **Add permissions** → **Create inline policy**
   - Click the **JSON** tab
   - Copy the contents of `aws-iam-policy-github-actions.json` and paste it
   - Click **Review policy**
   - Name it: `CDKDeploymentPermissions`
   - Click **Create policy**

---

### Option B: Use AWS CLI (if you have access)

Run these commands with your `reta-admin` profile:

```bash
# Navigate to the repo directory
cd /path/to/reta

# Apply the policy
aws iam put-user-policy \
  --user-name github-actions-deploy \
  --policy-name CDKDeploymentPermissions \
  --policy-document file://aws-iam-policy-github-actions.json \
  --profile reta-admin \
  --region eu-west-1
```

Verify it was applied:

```bash
aws iam get-user-policy \
  --user-name github-actions-deploy \
  --policy-name CDKDeploymentPermissions \
  --profile reta-admin
```

---

### Option C: Minimal Quick Fix (Temporary)

If you just want to test quickly, add only the SSM permission:

1. Go to IAM Console → Users → `github-actions-deploy`
2. Add inline policy with this JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:eu-west-1:372208783486:parameter/cdk-bootstrap/hnb659fds/version"
    }
  ]
}
```

**Note**: This is a minimal fix. You'll likely need more permissions as shown in Option A/B.

---

## What This Policy Allows

The comprehensive policy in `aws-iam-policy-github-actions.json` grants:

1. ✅ **SSM Parameter Access** - Check CDK bootstrap version
2. ✅ **CloudFormation** - Create/update/delete stacks
3. ✅ **S3** - Upload CDK assets (Lambda code, etc.)
4. ✅ **ECR** - Container registry access (if needed)
5. ✅ **Lambda** - Create/update Lambda functions
6. ✅ **IAM** - Manage Lambda execution roles
7. ✅ **DynamoDB** - Create/update tables
8. ✅ **API Gateway** - Create/update HTTP APIs
9. ✅ **CloudWatch Logs** - Create/manage log groups

All permissions are scoped to:
- Your AWS account: `372208783486`
- Region: `eu-west-1`
- Resources with prefix: `reta-*` or `RetaCloudInfrastructureStack-*`

---

## After Applying the Policy

1. **Re-run the GitHub Action**:
   - Go to: https://github.com/alandooley/reta/actions
   - Find the failed "Deploy Backend to AWS" workflow
   - Click **Re-run all jobs**

2. **Or trigger manually**:
   - Go to Actions → "Deploy Backend to AWS"
   - Click **Run workflow**
   - Select branch: `claude/fix-shot-weight-issues-011CUrU8h9xbGU45fb5PUt71`
   - Click **Run workflow**

3. **Deployment should succeed** ✅

---

## Security Best Practices

This policy follows AWS security best practices:

- ✅ Least privilege (only necessary actions)
- ✅ Resource-level restrictions (no `Resource: "*"` except where required by AWS)
- ✅ Scoped to specific stack and resources
- ✅ No admin or wildcard permissions

If you later want to tighten it further, monitor CloudWatch Logs for `AccessDenied` errors and add only the specific actions needed.

---

## Alternative: Use IAM Role with OIDC (More Secure)

Instead of using access keys, consider using GitHub OIDC:

https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

Benefits:
- No long-lived credentials
- Automatic credential rotation
- Better audit trail

This would require changes to:
1. AWS IAM setup (create OIDC provider + role)
2. `.github/workflows/deploy-backend.yml` (use `aws-actions/configure-aws-credentials@v4` with `role-to-assume`)

---

## Troubleshooting

### Still getting permission errors?

Check CloudWatch Logs for the specific action being denied:

```bash
aws logs tail /aws/lambda/reta-create-injection --follow --profile reta-admin
```

Add that specific permission to the policy.

### Want to see what CDK is trying to access?

Run CDK with verbose logging:

```bash
cd reta-cloud-infrastructure
npx cdk deploy --verbose --profile reta-admin
```

This will show all AWS API calls being made.

---

## Quick Start Commands

```bash
# 1. Apply the policy
aws iam put-user-policy \
  --user-name github-actions-deploy \
  --policy-name CDKDeploymentPermissions \
  --policy-document file://aws-iam-policy-github-actions.json \
  --profile reta-admin

# 2. Verify
aws iam get-user-policy \
  --user-name github-actions-deploy \
  --policy-name CDKDeploymentPermissions \
  --profile reta-admin

# 3. Re-run GitHub Action or test locally
cd reta-cloud-infrastructure
npx cdk deploy --require-approval never --profile reta-admin
```

---

**After fixing permissions, your deployment will complete successfully and all the fixes will be live! 🚀**
