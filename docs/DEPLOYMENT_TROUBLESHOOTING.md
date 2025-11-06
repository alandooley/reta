# Deployment Troubleshooting Guide

## AWS Credentials & IAM Policy Issues

### Common Error Messages and Solutions

#### 1. "Access Denied" Errors

**Error Examples:**
```
An error occurred (AccessDenied) when calling the PutObject operation
An error occurred (AccessDenied) when calling the CreateInvalidation operation
```

**Solution:**
- Check that your IAM user/role has the required permissions
- See [required-iam-policy.json](required-iam-policy.json) for the complete policy
- Ensure the policy is attached to your IAM user or role

**To check your current permissions:**
```bash
aws iam get-user --profile reta-admin
aws iam list-attached-user-policies --user-name YOUR_USERNAME --profile reta-admin
```

#### 2. "Invalid Credentials" or "SignatureDoesNotMatch"

**Error Examples:**
```
The request signature we calculated does not match the signature you provided
The security token included in the request is invalid
```

**Solutions:**

**For GitHub Actions:**
1. Go to: https://github.com/alandooley/reta/settings/secrets/actions
2. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set correctly
3. Re-create the secrets if unsure (delete and add again)

**For Local `deploy.sh` script:**
1. Check your AWS credentials file:
   ```bash
   cat ~/.aws/credentials
   ```
2. Verify the `[reta-admin]` profile exists with valid keys:
   ```ini
   [reta-admin]
   aws_access_key_id = YOUR_ACCESS_KEY
   aws_secret_access_key = YOUR_SECRET_KEY
   ```
3. Check your AWS config file:
   ```bash
   cat ~/.aws/config
   ```
4. Verify the region is set:
   ```ini
   [profile reta-admin]
   region = eu-west-1
   output = json
   ```

#### 3. CDK Deployment Errors

**Error Examples:**
```
❌ Deployment failed: Error: Need to perform AWS calls for account, but no credentials have been configured
❌ Stack RetaCloudInfrastructureStack failed: CREATE_FAILED
```

**Solutions:**

**CDK Not Bootstrapped:**
```bash
cd reta-cloud-infrastructure
npx cdk bootstrap aws://372208783486/eu-west-1 --profile reta-admin
```

**Missing CDK Execution Roles:**
Ensure your IAM user can assume CDK roles:
```json
{
  "Sid": "CDKBootstrapAccess",
  "Effect": "Allow",
  "Action": ["sts:AssumeRole"],
  "Resource": [
    "arn:aws:iam::372208783486:role/cdk-*-deploy-role-*",
    "arn:aws:iam::372208783486:role/cdk-*-file-publishing-role-*"
  ]
}
```

**Check CDK Diff First:**
```bash
cd reta-cloud-infrastructure
npx cdk diff --profile reta-admin
```

#### 4. S3 Upload Failures

**Error Examples:**
```
An error occurred (NoSuchBucket) when calling the PutObject operation
An error occurred (AccessDenied) when calling the PutObject operation
```

**Solutions:**

**Verify bucket exists:**
```bash
aws s3 ls s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1
```

**Check bucket policy allows your IAM user:**
```bash
aws s3api get-bucket-policy --bucket retatrutide-frontend-372208783486 --profile reta-admin --region eu-west-1
```

**Test upload manually:**
```bash
echo "test" > test.txt
aws s3 cp test.txt s3://retatrutide-frontend-372208783486/test.txt --profile reta-admin --region eu-west-1
aws s3 rm s3://retatrutide-frontend-372208783486/test.txt --profile reta-admin --region eu-west-1
rm test.txt
```

#### 5. CloudFront Invalidation Errors

**Error Examples:**
```
An error occurred (AccessDenied) when calling the CreateInvalidation operation
An error occurred (NoSuchDistribution) when calling the CreateInvalidation operation
```

**Solutions:**

**Verify distribution ID:**
```bash
aws cloudfront list-distributions --profile reta-admin --query "DistributionList.Items[].{Id:Id,DomainName:DomainName}"
```

**Check if you have CloudFront permissions:**
```bash
aws cloudfront get-distribution --id E2ZD0ACBBK8F5K --profile reta-admin
```

**Test invalidation manually:**
```bash
aws cloudfront create-invalidation \
  --distribution-id E2ZD0ACBBK8F5K \
  --paths "/*" \
  --profile reta-admin
```

#### 6. GitHub Actions Workflow Failures

**Error: "Resource not accessible by integration"**

**Solution:**
- Go to: https://github.com/alandooley/reta/settings/actions
- Under "Workflow permissions", ensure "Read and write permissions" is selected

**Error: "Secrets not found"**

**Solution:**
1. Go to: https://github.com/alandooley/reta/settings/secrets/actions
2. Add secrets:
   - Name: `AWS_ACCESS_KEY_ID`
   - Value: Your AWS access key ID
   - Name: `AWS_SECRET_ACCESS_KEY`
   - Value: Your AWS secret access key

**View workflow logs:**
- Go to: https://github.com/alandooley/reta/actions
- Click on the failed workflow run
- Expand the failed step to see detailed error messages

### Setting Up IAM User for Deployment

#### Option 1: Create New IAM User (Recommended)

1. **Create IAM User:**
   ```bash
   aws iam create-user --user-name reta-deploy-user
   ```

2. **Attach Policy:**
   ```bash
   aws iam put-user-policy \
     --user-name reta-deploy-user \
     --policy-name RetaDeploymentPolicy \
     --policy-document file://docs/required-iam-policy.json
   ```

3. **Create Access Keys:**
   ```bash
   aws iam create-access-key --user-name reta-deploy-user
   ```

   Save the output - you'll need it for credentials!

4. **Add to AWS CLI Profile:**
   ```bash
   aws configure --profile reta-admin
   # Enter the Access Key ID and Secret Access Key from step 3
   # Region: eu-west-1
   # Output format: json
   ```

5. **Add to GitHub Secrets:**
   - Go to: https://github.com/alandooley/reta/settings/secrets/actions
   - Add `AWS_ACCESS_KEY_ID` with the access key ID
   - Add `AWS_SECRET_ACCESS_KEY` with the secret access key

#### Option 2: Update Existing IAM User

1. **Check current policies:**
   ```bash
   aws iam list-attached-user-policies --user-name YOUR_USERNAME
   aws iam list-user-policies --user-name YOUR_USERNAME
   ```

2. **Attach or update policy:**
   ```bash
   aws iam put-user-policy \
     --user-name YOUR_USERNAME \
     --policy-name RetaDeploymentPolicy \
     --policy-document file://docs/required-iam-policy.json
   ```

### Testing Your Setup

Run this test script to verify all permissions:

```bash
#!/bin/bash
set -e

echo "Testing AWS Credentials and Permissions..."
echo ""

# Test S3 access
echo "✓ Testing S3 bucket access..."
aws s3 ls s3://retatrutide-frontend-372208783486/ --profile reta-admin --region eu-west-1

# Test CloudFront access
echo "✓ Testing CloudFront distribution access..."
aws cloudfront get-distribution --id E2ZD0ACBBK8F5K --profile reta-admin > /dev/null

# Test Secrets Manager access
echo "✓ Testing Secrets Manager access..."
aws secretsmanager describe-secret --secret-id firebase-service-account --profile reta-admin --region eu-west-1 > /dev/null

# Test IAM permissions
echo "✓ Testing IAM access..."
aws iam get-user --profile reta-admin > /dev/null

# Test CDK
echo "✓ Testing CDK access..."
cd reta-cloud-infrastructure
npx cdk list --profile reta-admin > /dev/null
cd ..

echo ""
echo "🎉 All permissions verified successfully!"
```

### Security Best Practices

1. **Use Principle of Least Privilege:**
   - Only grant permissions that are actually needed
   - The provided policy is comprehensive but you can restrict it further

2. **Rotate Access Keys Regularly:**
   ```bash
   aws iam create-access-key --user-name reta-deploy-user
   # Update credentials in AWS CLI and GitHub Secrets
   aws iam delete-access-key --user-name reta-deploy-user --access-key-id OLD_KEY_ID
   ```

3. **Use MFA for IAM User (Optional but Recommended):**
   ```bash
   aws iam enable-mfa-device \
     --user-name reta-deploy-user \
     --serial-number arn:aws:iam::372208783486:mfa/reta-deploy-user \
     --authentication-code1 CODE1 \
     --authentication-code2 CODE2
   ```

4. **Monitor AWS CloudTrail for API Calls:**
   - Go to AWS CloudTrail console
   - Review API calls made by your deployment user
   - Look for any unexpected or denied operations

### Getting Help

If you're still having issues:

1. **Check AWS CloudTrail logs:**
   - Go to: https://console.aws.amazon.com/cloudtrail/
   - Look for denied API calls

2. **Enable debug mode in scripts:**
   ```bash
   # In deploy.sh, add after set -e:
   set -x  # Print each command before executing
   ```

3. **Check GitHub Actions logs:**
   - Go to: https://github.com/alandooley/reta/actions
   - Click on failed workflow
   - Expand each step to see detailed output

4. **Test AWS CLI commands manually:**
   ```bash
   aws sts get-caller-identity --profile reta-admin
   ```
   This shows who you're authenticated as.

### Quick Reference

**AWS Account ID:** 372208783486
**Region:** eu-west-1 (Ireland)
**S3 Bucket:** retatrutide-frontend-372208783486
**CloudFront Distribution:** E2ZD0ACBBK8F5K
**CDK Stack:** RetaCloudInfrastructureStack
**Profile Name:** reta-admin

**GitHub Actions Workflows:**
- Frontend: [deploy-frontend.yml](.github/workflows/deploy-frontend.yml)
- Backend: [deploy-backend.yml](.github/workflows/deploy-backend.yml)

**Local Deployment Script:** [deploy.sh](../deploy.sh)
