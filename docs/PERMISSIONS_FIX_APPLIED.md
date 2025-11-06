# GitHub Actions Permissions Fix - Applied

## What Was Done

✅ **IAM Policy Applied Successfully**

Applied the `GitHubActionsDeploymentPolicy` to the `github-actions-deploy` IAM user with the following permissions:

1. **S3 Access** - Upload/read/delete files in the frontend bucket
2. **CloudFront** - Create and monitor cache invalidations
3. **SSM Parameter Store** - Read CDK bootstrap configuration
4. **STS AssumeRole** - Assume CDK deployment roles
5. **CloudFormation** - Read stack information

## Verification Results

✅ CDK bootstrap stack exists (`CDKToolkit`)
✅ All required CDK roles exist:
   - `cdk-hnb659fds-deploy-role-372208783486-eu-west-1`
   - `cdk-hnb659fds-file-publishing-role-372208783486-eu-west-1`
   - `cdk-hnb659fds-lookup-role-372208783486-eu-west-1`

✅ Trust policies allow account users to assume roles

## Potential Remaining Issue

⚠️ The SSM parameter `/cdk-bootstrap/hnb659fds/version` doesn't exist, which suggests either:
1. CDK is using an older bootstrap version that doesn't create SSM parameters
2. The bootstrap needs to be updated

## Next Steps

### Option A: Test GitHub Actions Deployment Now

Try running the GitHub Actions workflow to see if it works:

1. Go to: https://github.com/alandooley/reta/actions
2. Click "Deploy Backend to AWS"
3. Click "Run workflow" → Select `main` → "Run workflow"

**If it fails with the same SSM error**, proceed to Option B.

**If it succeeds**, you're all set! 🎉

### Option B: Update CDK Bootstrap (If Needed)

If GitHub Actions still fails with the SSM parameter error:

```bash
cd reta-cloud-infrastructure
npx cdk bootstrap aws://372208783486/eu-west-1 --profile reta-admin --force
```

This will update your CDK bootstrap to the latest version which creates the SSM parameters.

After bootstrapping, retry the GitHub Actions workflow.

### Option C: Frontend-Only Deployment (Backup Plan)

If backend deployment via GitHub Actions continues to have issues, you can:

1. **Use GitHub Actions for frontend only** (no CDK needed):
   - Go to: https://github.com/alandooley/reta/actions
   - Run "Deploy Frontend to AWS" workflow

2. **Use local script for backend** (when needed):
   ```bash
   ./deploy.sh
   ```

This approach is actually simpler and keeps sensitive infrastructure changes under your direct control.

## Testing the Fix

To verify everything works, you can:

1. **Make a small frontend change**:
   ```bash
   echo "<!-- Test -->" >> index.html
   git add index.html
   git commit -m "test: Verify GitHub Actions permissions"
   git push origin main
   ```

2. **Watch the workflow**: https://github.com/alandooley/reta/actions

3. **Check the deployment logs** for any remaining errors

## Policy Details

The applied policy grants:

```json
{
  "S3": ["PutObject", "GetObject", "DeleteObject", "ListBucket"],
  "CloudFront": ["CreateInvalidation", "GetInvalidation"],
  "SSM": ["GetParameter"],
  "STS": ["AssumeRole"],
  "CloudFormation": ["DescribeStacks", "DescribeStackEvents", "GetTemplate"]
}
```

Scoped to:
- S3 Bucket: `retatrutide-frontend-372208783486`
- CloudFront: `E2ZD0ACBBK8F5K`
- CDK Bootstrap: `/cdk-bootstrap/*`
- CDK Roles: `cdk-hnb659fds-*`
- CloudFormation: `RetaCloudInfrastructureStack`

## Rollback (If Needed)

To remove the policy:

```bash
aws iam delete-user-policy \
  --user-name github-actions-deploy \
  --policy-name GitHubActionsDeploymentPolicy \
  --profile reta-admin
```

## Summary

**Status**: ✅ Permissions have been applied successfully

**Ready to test**: Yes - try running the GitHub Actions workflow

**Fallback option**: Use frontend-only GitHub Actions + local backend deployments

**Expected outcome**: Backend deployment should now work, or you may need to update CDK bootstrap

---

**Applied**: 2025-11-06
**IAM User**: `github-actions-deploy`
**Policy Name**: `GitHubActionsDeploymentPolicy`
