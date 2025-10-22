# Quick Start: Deploy to AWS in 10 Minutes

This is the fastest way to get your Retatrutide Tracker running on AWS with your existing data.

## Prerequisites (2 minutes)

1. **AWS Account** - [Sign up](https://aws.amazon.com/) if you don't have one
2. **AWS CLI** - Install:
   ```bash
   # macOS
   brew install awscli

   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install

   # Windows
   # Download from: https://awscli.amazonaws.com/AWSCLIV2.msi
   ```

3. **Configure AWS CLI**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Region: us-east-1
   # Output format: json
   ```

## Method 1: AWS Amplify (RECOMMENDED - 10 minutes)

### Step 1: Install Amplify CLI
```bash
npm install -g @aws-amplify/cli
```

### Step 2: Initialize and Deploy
```bash
cd /home/user/reta

# Initialize Amplify (one-time setup)
amplify init
# Press Enter to accept defaults, or customize as needed

# Add hosting
amplify add hosting
# Choose: "Hosting with Amplify Console"
# Choose: "Manual deployment"

# Deploy!
amplify publish
```

### Step 3: Save Your URL
After deployment, Amplify will show your URL like:
```
✔ Your app is published!
https://main.d1a2b3c4d5e6f7.amplifyapp.com
```

**That's it!** Your app is live with HTTPS. Now migrate your data (see below).

---

## Method 2: CloudFormation (15 minutes - Full Infrastructure)

### Step 1: Deploy Infrastructure
```bash
cd /home/user/reta

# Make script executable
chmod +x deploy-cloudformation.sh

# Deploy everything
./deploy-cloudformation.sh
```

This creates:
- S3 bucket for hosting
- CloudFront CDN for HTTPS
- Proper caching rules
- Error handling for SPA routing

### Step 2: Note Your CloudFront URL
The script will output:
```
CloudFront (HTTPS): https://d1a2b3c4d5e6f7.cloudfront.net
```

**Done!** Your app is live.

---

## Method 3: Simple S3 Deployment (12 minutes)

### Step 1: Deploy to S3
```bash
cd /home/user/reta

# Make script executable
chmod +x deploy-s3.sh

# Set your bucket name
export S3_BUCKET=reta-YOUR_NAME

# Deploy
./deploy-s3.sh
```

### Step 2: Access Your Site
```
http://reta-YOUR_NAME.s3-website-us-east-1.amazonaws.com
```

**Note**: This uses HTTP. For HTTPS, set up CloudFront (Method 2).

---

## Migrate Your Data (5 minutes)

### Export from GitHub Pages

1. Open: https://alandooley.github.io/reta/
2. Tap **Settings** (bottom navigation)
3. Scroll to **Data Management**
4. Tap **Create Manual Backup**
5. Label it: `Migration-2025-10-22`
6. Tap **Export Data to File**
7. Save the JSON file

### Import to AWS

1. Open your new AWS URL
2. Tap **Settings**
3. Scroll to **Data Management**
4. Tap **Import Data from File**
5. Select your exported JSON
6. Review and confirm

### Verify

Check that everything imported:
- Tap **Log** - see all your injections
- Tap **Vials** - see your vial data
- Tap **Weight** - see your weight history
- Tap **Trends** - charts should render

---

## Install as PWA

### iPhone/iPad
1. Open your AWS URL in Safari
2. Tap the Share button
3. Tap **Add to Home Screen**
4. Tap **Add**

### Android
1. Open your AWS URL in Chrome
2. Tap the menu (⋮)
3. Tap **Add to Home Screen**
4. Tap **Add**

### Desktop
1. Open your AWS URL in Chrome/Edge
2. Click the install icon in the address bar (⊕)
3. Click **Install**

---

## Troubleshooting

### "Command not found: amplify"
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Verify installation
amplify --version
```

### "Command not found: aws"
```bash
# Verify AWS CLI is installed
aws --version

# If not installed, see Prerequisites section above
```

### "Access Denied" when deploying
```bash
# Verify AWS credentials
aws sts get-caller-identity

# If this fails, run:
aws configure
```

### Data import shows "Invalid format"
- Re-export from GitHub Pages
- Verify the JSON file isn't corrupted:
  ```bash
  cat your-export.json | jq
  ```
- Check that the file has `version`, `injections`, `vials`, `weights` fields

### PWA won't install
- Requires HTTPS (Methods 1 & 2 have this)
- Clear browser cache and try again
- Ensure Service Worker is registered (check browser console)

---

## Quick Reference

### Future Updates

**Amplify:**
```bash
amplify publish
```

**CloudFormation:**
```bash
./deploy-cloudformation.sh
```

**S3:**
```bash
export S3_BUCKET=your-bucket-name
./deploy-s3.sh
```

### Export/Import Data Anytime

1. Settings → Data Management
2. Create Manual Backup
3. Export Data to File
4. Save for safekeeping

### Check AWS Costs

```bash
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

Expected: **$5-12/month** for personal use

---

## What You Get

✅ **HTTPS deployment** (Methods 1 & 2)
✅ **Global CDN** (CloudFront in Methods 1 & 2)
✅ **Automatic backups** (every 5 minutes)
✅ **Offline support** (PWA with Service Worker)
✅ **All your data** (imported from GitHub Pages)
✅ **Push notifications** (after PWA install)
✅ **Professional hosting** (AWS infrastructure)

---

## Next Steps

1. **Set up custom domain** (optional)
   - Register domain via Route 53
   - Point to CloudFront distribution
   - Get free SSL via AWS Certificate Manager

2. **Enable cloud sync** (optional)
   - Add Google Drive integration
   - Set up Withings Health sync
   - Configure environment variables

3. **Share with others** (optional)
   - Send them your AWS URL
   - They can install the PWA
   - Each user's data stays private (local storage)

---

## Need Help?

- **Full guide**: See [AWS_DEPLOYMENT_GUIDE.md](AWS_DEPLOYMENT_GUIDE.md)
- **Issues**: https://github.com/alandooley/reta/issues
- **AWS Docs**: https://docs.aws.amazon.com/

---

**Ready?** Choose a method above and you'll be deployed in 10-15 minutes!
