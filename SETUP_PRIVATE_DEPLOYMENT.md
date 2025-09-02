# 🔐 Private Deployment Setup Guide

## Overview
Keep the core dejafoo project open source while using local environment files for your AWS credentials.

## Simple Architecture
```
dejafoo (Public Open Source)
├── src/                    # Core proxy code
├── infra/                  # Generic Terraform
├── scripts/               # Auto-loads .env files
├── config/                # Generic configs
├── .env.example           # Example environment file
└── .gitignore             # Ignores .env files

Your Local Setup
├── .env                   # Your AWS credentials (gitignored)
└── (clone of dejafoo)     # Just clone and add your .env
```

## Step 1: Clone the Open Source Repo

```bash
# Clone the open source dejafoo repo
git clone https://github.com/yourusername/dejafoo.git
cd dejafoo
```

## Step 2: Create Your Local Environment File

```bash
# Copy the example file
cp env.example .env

# Edit with your values
nano .env
```

### Your `.env` file should contain:
```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here
AWS_DEFAULT_REGION=us-east-1

# Your specific configuration
DEJAFOO_ENVIRONMENT=prod
DEJAFOO_PROJECT_NAME=your-company-dejafoo
```

```bash
# Deploy with your credentials (automatically loaded from .env)
./scripts/deploy.sh
```

```bash
# Pull latest changes from open source
git pull origin main

# Deploy with your credentials (still in .env)
./scripts/deploy.sh
```

## Benefits of This Approach

✅ **Super Simple**: Just clone, add `.env`, deploy
✅ **Always Up to Date**: `git pull` gets latest features
✅ **Secure**: Your credentials never leave your machine
✅ **No Complex Setup**: No submodules or separate repos needed
✅ **Works for Teams**: Each developer has their own `.env`

## Security Best Practices

1. **Never commit credentials** to the open source repo
2. **Use environment variables** for all sensitive data
3. **Use AWS IAM roles** when possible instead of access keys
4. **Rotate credentials** regularly
5. **Use separate AWS accounts** for different environments

## Example Workflow

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/dejafoo.git
cd dejafoo

# 2. Add your credentials
cp env.example .env
nano .env  # Add your AWS credentials

# 3. Deploy
./scripts/deploy.sh

# 4. Later: Update and redeploy
git pull origin main
./scripts/deploy.sh
```
