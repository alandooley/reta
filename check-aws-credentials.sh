#!/bin/bash

echo "🔍 Checking AWS Credentials..."
echo ""

# Check if AWS config exists
if [ -f ~/.aws/credentials ]; then
    echo "✅ AWS credentials file exists"
    echo ""
    echo "📋 Profiles found:"
    grep '^\[' ~/.aws/credentials
    echo ""
    
    # Check for reta-admin profile
    if grep -q '\[reta-admin\]' ~/.aws/credentials; then
        echo "✅ reta-admin profile found"
        echo ""
        echo "🔑 Credentials (masked):"
        grep -A2 '\[reta-admin\]' ~/.aws/credentials | sed 's/aws_access_key_id = \(.\{8\}\).*/aws_access_key_id = \1.../' | sed 's/aws_secret_access_key = \(.\{8\}\).*/aws_secret_access_key = \1.../'
    else
        echo "❌ reta-admin profile NOT found"
        echo ""
        echo "Available profiles:"
        grep '^\[' ~/.aws/credentials
    fi
else
    echo "❌ No AWS credentials file found at ~/.aws/credentials"
    echo ""
    echo "You need to configure AWS credentials first."
fi

echo ""
echo "📝 Next steps:"
echo "If credentials exist: Use them for GitHub Secrets"
echo "If credentials missing: Follow the IAM user creation guide below"
