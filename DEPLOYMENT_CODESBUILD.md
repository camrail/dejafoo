# 🚀 Private Repository Deployment Guide

## Overview
Deploy your private dejafoo repository using AWS CodeBuild with automated builds, secrets management, and infrastructure as code.

**🔐 AWS Secrets Manager Only:** No local credential files needed - everything is stored securely in AWS Secrets Manager.

## Architecture
```
Private GitHub Repo → CodeBuild → Secrets Manager → Terraform → AWS Resources
         ↓              ↓            ↓              ↓
    Push Code    Build & Deploy   Credentials   Lambda + DynamoDB + S3
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Private GitHub Repository** with your dejafoo code
3. **GitHub Personal Access Token** with repo access
4. **AWS CLI** installed and configured
5. **Terraform** installed

## Step 1: Initial Infrastructure Setup

### Option A: Using the Setup Script
```bash
# Clone your private repo
git clone https://github.com/yourusername/dejafoo.git
cd dejafoo

# Run setup script with your parameters
./scripts/setup-infrastructure.sh my-dejafoo prod us-west-2 https://github.com/myorg/dejafoo.git
```

### Option B: Manual Terraform
```bash
cd infra
terraform init
terraform plan -var="github_repo_url=https://github.com/yourusername/dejafoo.git"
terraform apply
```

## Step 2: Configure Secrets in AWS Secrets Manager

After infrastructure is created, you'll get a Secrets Manager secret name. This is where ALL your credentials are stored - no local files needed!

### Via AWS Console:
1. Go to **AWS Secrets Manager**
2. Find your secret (name will be output from Terraform)
3. Click **Retrieve secret value** → **Edit**
4. Update the JSON with your real values:

```json
{
  "github_token": "ghp_your_github_personal_access_token",
  "aws_access_key_id": "AKIA...",
  "aws_secret_access_key": "your_secret_key"
}
```

**Important for Private Repos:** Your GitHub token needs these permissions:
- `repo` (Full control of private repositories)
- `read:org` (if your repo is in an organization)

### Via AWS CLI:
```bash
# Get the secret name from Terraform output
SECRET_NAME=$(cd infra && terraform output -raw secrets_manager_secret_name)

# Update the secret
aws secretsmanager update-secret \
  --secret-id $SECRET_NAME \
  --secret-string '{
    "github_token": "ghp_your_github_personal_access_token",
    "aws_access_key_id": "AKIA...",
    "aws_secret_access_key": "your_secret_key"
  }'
```

## Step 3: Deploy

### Option A: Manual Build
```bash
# Get CodeBuild project name
PROJECT_NAME=$(cd infra && terraform output -raw codebuild_project_name)

# Start a build
aws codebuild start-build --project-name $PROJECT_NAME
```

### Option B: Automatic Builds (Recommended)
1. Go to **AWS CodeBuild** in the console
2. Find your project
3. Go to **Build history** → **Start build**
4. Or push to your GitHub repo to trigger automatic builds

## Step 4: Monitor Deployment

### View Build Logs:
```bash
# List recent builds
aws codebuild list-builds-for-project --project-name $PROJECT_NAME

# Get build details
BUILD_ID=$(aws codebuild list-builds-for-project --project-name $PROJECT_NAME --query 'ids[0]' --output text)
aws codebuild batch-get-builds --ids $BUILD_ID
```

### View CloudWatch Logs:
1. Go to **CloudWatch** → **Log groups**
2. Find `/aws/codebuild/dejafoo-dev-build`
3. View real-time build logs

## Step 5: Get Your Deployment URL

After successful deployment:
```bash
cd infra
terraform output lambda_function_url
```

## What Gets Created

### AWS Resources:
- ✅ **CodeBuild Project** - Builds and deploys your code
- ✅ **Secrets Manager Secret** - Stores your credentials securely
- ✅ **Lambda Function** - Your proxy service
- ✅ **DynamoDB Table** - Cache metadata storage
- ✅ **S3 Bucket** - Large cache objects storage
- ✅ **IAM Roles** - Proper permissions for all services
- ✅ **CloudWatch Logs** - Build and runtime logs

### Build Process:
1. **Clone** your GitHub repo
2. **Install** Rust and dependencies
3. **Build** Rust binary for Lambda
4. **Package** Lambda deployment zip
5. **Deploy** infrastructure with Terraform
6. **Output** deployment URLs and resource names

## Environment Variables

The build process uses these environment variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `PROJECT_NAME` | Terraform | Your project name |
| `ENVIRONMENT` | Terraform | Environment (dev/prod) |
| `AWS_DEFAULT_REGION` | Terraform | AWS region |
| `SECRETS_MANAGER_SECRET_NAME` | Terraform | Secret name for credentials |

## Security Features

✅ **AWS Secrets Manager Only** - No local files, no .env files, no credentials in code
✅ **IAM Roles** - Least privilege access
✅ **Encrypted Secrets** - KMS encryption at rest
✅ **Secure Build Environment** - Isolated CodeBuild containers
✅ **Zero Local Credentials** - Everything runs in AWS, everything stored in Secrets Manager

## Troubleshooting

### Build Fails:
1. Check **CloudWatch Logs** for detailed error messages
2. Verify **Secrets Manager** has correct credentials
3. Ensure **GitHub repo** is accessible
4. Check **IAM permissions** for CodeBuild role

### Terraform Errors:
1. Verify **AWS credentials** in Secrets Manager
2. Check **resource limits** in your AWS account
3. Ensure **region** is correct
4. Verify **GitHub repo URL** is accessible

### Lambda Issues:
1. Check **Lambda logs** in CloudWatch
2. Verify **environment variables** are set
3. Test **DynamoDB and S3** permissions
4. Check **Lambda timeout** settings

## Cost Optimization

- **CodeBuild**: Pay per build minute (~$0.005/minute)
- **Lambda**: Pay per request and compute time
- **DynamoDB**: Pay per request (on-demand pricing)
- **S3**: Pay for storage and requests
- **Secrets Manager**: $0.40/secret/month

## Next Steps

1. **Set up monitoring** with CloudWatch alarms
2. **Configure auto-scaling** for high traffic
3. **Set up CI/CD** with GitHub webhooks
4. **Add custom domains** with Route 53
5. **Implement blue/green deployments**

## Support

- Check **CloudWatch Logs** for detailed error messages
- Review **CodeBuild build logs** for build issues
- Verify **Secrets Manager** configuration
- Ensure **GitHub repo** is accessible and has correct permissions
