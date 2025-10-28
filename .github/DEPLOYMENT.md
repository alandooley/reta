# Automated Deployment Setup

This repository uses GitHub Actions to automatically deploy to AWS S3 + CloudFront.

## 🚀 How It Works

Every time you push to these branches, deployment happens automatically:
- `main` branch
- Any branch starting with `claude/mobile-graph-ux-review-`

### Deployment Process

1. **Upload** → `index.html` uploaded to S3 bucket
2. **Invalidate** → CloudFront cache cleared
3. **Wait** → Waits for cache propagation (2-5 minutes)
4. **Done!** → Changes live at https://d13m7vzwjqe4pp.cloudfront.net

## 🔐 Initial Setup (One-Time)

### Step 1: Get AWS Credentials

From your AWS IAM user (`reta-admin`), get:
- AWS Access Key ID
- AWS Secret Access Key

**To get these:**

```bash
# View your credentials (if already configured locally)
cat ~/.aws/credentials | grep -A2 "\[reta-admin\]"
```

You'll see something like:
```
[reta-admin]
aws_access_key_id = AKIAXXXXXXXXXXXXXXXX
aws_secret_access_key = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 2: Add to GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:

**Secret 1:**
- Name: `AWS_ACCESS_KEY_ID`
- Value: Your AWS access key ID (starts with `AKIA`)

**Secret 2:**
- Name: `AWS_SECRET_ACCESS_KEY`
- Value: Your AWS secret access key (40 characters)

### Step 3: Enable GitHub Actions

1. Go to **Actions** tab in your repository
2. If disabled, click **"I understand my workflows, go ahead and enable them"**

## ✅ That's It!

Now every push will automatically deploy!

## 📊 Monitoring Deployments

### View Deployment Status

1. Go to **Actions** tab in GitHub
2. Click on the latest workflow run
3. Watch real-time logs

### Manual Deployment

You can also trigger deployment manually:

1. Go to **Actions** tab
2. Click **Deploy to AWS** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## 🔍 What Gets Deployed

- **File:** `index.html` (the entire app)
- **Destination:** S3 bucket `retatrutide-frontend-372208783486`
- **CDN:** CloudFront distribution `E2ZD0ACBBK8F5K`
- **URL:** https://d13m7vzwjqe4pp.cloudfront.net

## 🛡️ Security Notes

- AWS credentials are stored as encrypted GitHub Secrets
- Secrets are never exposed in logs
- Only repository admins can view/edit secrets
- GitHub Actions runs in isolated containers

## ⏱️ Deployment Timeline

- **Trigger:** Push to branch
- **Upload:** ~10 seconds
- **Cache invalidation:** ~2-5 minutes
- **Total:** ~5-6 minutes from push to live

## 🆘 Troubleshooting

### Deployment fails with "InvalidAccessKeyId"

**Solution:** Check that GitHub Secrets are set correctly:
- Go to Settings → Secrets → Actions
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` exist
- Re-add if necessary

### Changes don't appear after deployment

**Wait 5 minutes** for CloudFront cache invalidation to complete.

If still not showing:
1. Clear browser cache
2. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
3. Try incognito/private mode

### Workflow doesn't trigger

**Check branch name:**
- Must be `main` or start with `claude/mobile-graph-ux-review-`
- Push directly (not just commit locally)

## 🔧 Advanced Configuration

### Deploy to Different Branches

Edit `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches:
      - main
      - develop
      - staging
```

### Deploy Different Files

Add to the "Upload to S3" step:

```yaml
- name: Upload to S3
  run: |
    aws s3 cp index.html s3://retatrutide-frontend-372208783486/
    aws s3 cp manifest.json s3://retatrutide-frontend-372208783486/
    aws s3 sync js/ s3://retatrutide-frontend-372208783486/js/
```

### Add Deployment Notifications

Add Slack/Discord/Email notifications by adding steps after deployment.

## 📝 Workflow File Location

`.github/workflows/deploy.yml`

## 🎯 Quick Commands

**Check workflow status:**
```bash
gh workflow view deploy.yml
```

**Manually trigger deployment:**
```bash
gh workflow run deploy.yml
```

**View recent runs:**
```bash
gh run list --workflow=deploy.yml
```

## 📚 Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [AWS Actions](https://github.com/aws-actions)
- [CloudFront Invalidation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
