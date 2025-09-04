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
4. **AWS CLI** installed and configured with a profile (e.g., `dejafoo`)
5. **Terraform** installed (version 1.13+ recommended)

### Important Notes:
- **Terraform Version**: Use Terraform 1.13+ for compatibility with AWS provider v4.x
- **AWS Profile**: The deployment scripts use the `dejafoo` profile by default
- **GitHub PAT**: Must have `repo` permissions for private repository access

## Step 1: Initial Infrastructure Setup

### Option A: Using the Setup Script
```bash
# Clone your private repo
git clone https://github.com/camrail/dejafoo.git
cd dejafoo

# Run setup script with your parameters
./scripts/setup-infrastructure.sh dejafoo-prod prod eu-west-3 https://github.com/camrail/dejafoo.git
```

### Option B: Manual Terraform
```bash
# First create terraform.tfvars with required values
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

cd infra
terraform init
terraform plan
terraform apply
```

### Option C: Using Deploy Script (Recommended)
```bash
# Build and deploy in one command
./scripts/deploy.sh prod eu-west-3 dejafoo
```

## Step 2: Configure GitHub Authentication

**CRITICAL:** For private repositories, you must configure GitHub authentication in CodeBuild.

### Option A: Via Terraform (Recommended)
The infrastructure now automatically configures GitHub authentication using your PAT:

```bash
# Create terraform.tfvars file with your values
cat > infra/terraform.tfvars << EOF
environment = "prod"
aws_region = "eu-west-3"
aws_profile = "dejafoo"
github_token = "your_github_pat_here"
github_repo_url = "https://github.com/camrail/dejafoo.git"
domain_name = "dejafoo.io"
EOF

# Apply with variables from file
cd infra
terraform apply
```

**Note**: The `github_token` variable is required and has no default value for security reasons.

### Option B: Via AWS Console
1. Go to **AWS CodeBuild** → **Source providers**
2. Click **Connect to GitHub**
3. Select **Personal access token**
4. Enter your GitHub PAT
5. Click **Connect**

## Step 3: Configure Secrets in AWS Secrets Manager

After infrastructure is created, you'll get a Secrets Manager secret name. This is where ALL your credentials are stored - no local files needed!

### Via AWS Console:
1. Go to **AWS Secrets Manager**
2. Find your secret (name will be output from Terraform)
3. Click **Retrieve secret value** → **Edit**
4. Update the JSON with your real values:

```json
{
  "github_token": "your_github_personal_access_token_here",
  "aws_access_key_id": "your_aws_access_key_here",
  "aws_secret_access_key": "your_aws_secret_key_here",
  "domain_name": "dejafoo.io"
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
    "github_token": "your_github_personal_access_token_here",
    "aws_access_key_id": "your_aws_access_key_here",
    "aws_secret_access_key": "your_aws_secret_key_here",
    "domain_name": "dejafoo.io"
  }' \
  --profile dejafoo
```

## Step 4: Deploy

### Option A: Manual Build
```bash
# Get CodeBuild project name
PROJECT_NAME=$(cd infra && terraform output -raw codebuild_project_name)

# Start a build
aws codebuild start-build --project-name $PROJECT_NAME --profile dejafoo
```

### Option B: Using Deploy Script (Recommended)
```bash
# Build and deploy everything
./scripts/deploy.sh prod eu-west-3 dejafoo
```

### Option C: Automatic Builds
1. Go to **AWS CodeBuild** in the console
2. Find your project
3. Go to **Build history** → **Start build**
4. Or push to your GitHub repo to trigger automatic builds

## Step 5: Monitor Deployment

### View Build Logs:
```bash
# List recent builds
aws codebuild list-builds-for-project --project-name $PROJECT_NAME --profile dejafoo

# Get build details
BUILD_ID=$(aws codebuild list-builds-for-project --project-name $PROJECT_NAME --profile dejafoo --query 'ids[0]' --output text)
aws codebuild batch-get-builds --ids $BUILD_ID --profile dejafoo

# Check build status
aws codebuild batch-get-builds --ids $BUILD_ID --profile dejafoo --query 'builds[0].buildStatus'
```

### View CloudWatch Logs:
```bash
# Get log stream name from build details
LOG_STREAM=$(aws codebuild batch-get-builds --ids $BUILD_ID --profile dejafoo --query 'builds[0].logs.streamName' --output text)

# View recent logs
aws logs get-log-events \
  --log-group-name "/aws/codebuild/dejafoo-prod-build" \
  --log-stream-name $LOG_STREAM \
  --profile dejafoo \
  --limit 20
```

### Via AWS Console:
1. Go to **CloudWatch** → **Log groups**
2. Find `/aws/codebuild/dejafoo-prod-build`
3. View real-time build logs

## Step 6: Get Your Deployment URL

After successful deployment:

### If you configured a domain:
```bash
cd infra
terraform output cloudfront_domain_name
# Your service will be available at: https://dejafoo.io and https://*.dejafoo.io
```

### If no domain configured:
```bash
cd infra
terraform output lambda_function_url
# Your service will be available at the Lambda Function URL
```

### Domain Setup (if using custom domain):

**✅ Works with any domain registrar!** (GoDaddy, Namecheap, Cloudflare, etc.)

1. **Get Route53 nameservers** from your deployment:
   ```bash
   cd infra
   terraform output route53_name_servers
   ```

2. **Update nameservers at your domain registrar**:
   - Go to your domain registrar (where you bought the domain)
   - Find DNS/Nameserver settings
   - Replace existing nameservers with the Route53 ones
   - Save changes

3. **Wait for DNS propagation** (usually 15 minutes to 2 hours, max 48 hours)

4. **Your service will be available at**:
   - `https://dejafoo.io` (main domain)
   - `https://abc.dejafoo.io` (any subdomain)
   - `https://xyz.dejafoo.io` (any subdomain)

**Example nameservers you'll get:**
```
ns-123.awsdns-12.com
ns-456.awsdns-45.net
ns-789.awsdns-78.org
ns-012.awsdns-01.co.uk
```

**Benefits of this approach:**
- ✅ **Keep your domain where you bought it** - no need to transfer
- ✅ **Use Route53 for DNS management** - better performance and features
- ✅ **Automatic SSL certificates** - AWS handles certificate management
- ✅ **Wildcard subdomain support** - any subdomain automatically works
- ✅ **Global CDN** - CloudFront distribution for better performance

## What Gets Created

### AWS Resources:
- ✅ **CodeBuild Project** - Builds and deploys your code
- ✅ **Secrets Manager Secret** - Stores your credentials securely
- ✅ **Lambda Function** - Your proxy service
- ✅ **DynamoDB Table** - Cache metadata storage
- ✅ **S3 Bucket** - Large cache objects storage
- ✅ **Route53 Hosted Zone** - DNS management (if domain configured)
- ✅ **SSL Certificate** - HTTPS support with wildcard subdomains
- ✅ **CloudFront Distribution** - Global CDN and HTTPS termination
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

### Quick Diagnosis:
If you're experiencing issues, run the troubleshooting script first:
```bash
./scripts/troubleshoot-terraform.sh
```

This script will check:
- AWS CLI installation and credentials
- Terraform installation and version
- State lock issues
- Basic terraform functionality

### Common Issues and Solutions:

#### 1. **GitHub Authentication Failures**
**Error**: `authentication required for primary source and source version main`

**Solution**: Configure GitHub source credential
```bash
# Via Terraform (recommended)
terraform apply -var="github_token=your_github_pat" -var="aws_profile=dejafoo"

# Via AWS Console
# Go to CodeBuild → Source providers → Connect to GitHub
```

#### 2. **Terraform Hanging/No Progress**
**Error**: Terraform appears to hang during plan/apply

**Causes & Solutions**:
- **Outdated Terraform**: Upgrade to v1.13+
  ```bash
  # Check version
  terraform version
  
  # Download latest (if using Homebrew)
  brew uninstall terraform
  # Download from https://releases.hashicorp.com/terraform/
  ```
- **Invalid AWS credentials**: Check with `aws sts get-caller-identity --profile dejafoo`
- **State lock issues**: `rm -f infra/.terraform.tfstate.lock.info`

#### 3. **Secrets Manager Errors**
**Error**: `You can't perform this operation on the secret because it was marked for deletion`

**Solution**: Restore the secret
```bash
aws secretsmanager restore-secret --secret-id dejafoo-prod-secrets --profile dejafoo
```

#### 4. **Lambda Runtime Errors**
**Error**: `expected runtime to be one of [...] got provided.al2023`

**Solution**: Use compatible runtime
```terraform
# In infra/modules/lambda/main.tf
runtime = "provided.al2"  # Instead of provided.al2023
```

#### 5. **Terraform Provider Version Conflicts**
**Error**: `Inconsistent dependency lock file`

**Solution**: Upgrade providers
```bash
terraform init -upgrade
```

#### 6. **CodeBuild Permission Errors**
**Error**: `Service role does not allow AWS CodeBuild to create Amazon CloudWatch Logs log streams`

**Solution**: Update IAM policy with wildcard
```terraform
# In infra/modules/codebuild/main.tf
Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/codebuild/${var.project_name}-${var.environment}-build*"
```

#### 7. **Build Fails During Compilation**
**Error**: Build fails in BUILD phase

**Common Causes**:
- Missing dependencies in Cargo.toml
- Rust compilation errors
- Memory/timeout issues

**Solutions**:
- Check CloudWatch logs for specific error
- Verify Cargo.toml dependencies
- Increase CodeBuild timeout if needed

### Build Status Monitoring:
```bash
# Check current build status
aws codebuild batch-get-builds --ids $BUILD_ID --profile dejafoo --query 'builds[0].buildStatus'

# Monitor build phases
aws codebuild batch-get-builds --ids $BUILD_ID --profile dejafoo --query 'builds[0].phases[*].{Phase:phaseType,Status:phaseStatus,Duration:durationInSeconds}'
```

### Lambda Issues:
1. Check **Lambda logs** in CloudWatch
2. Verify **environment variables** are set
3. Test **DynamoDB and S3** permissions
4. Check **Lambda timeout** settings

### Debugging Commands:
```bash
# Check AWS credentials
aws sts get-caller-identity --profile dejafoo

# List CodeBuild projects
aws codebuild list-projects --profile dejafoo

# Check source credentials
aws codebuild list-source-credentials --profile dejafoo

# View recent builds
aws codebuild list-builds-for-project --project-name dejafoo-prod-build --profile dejafoo
```

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
