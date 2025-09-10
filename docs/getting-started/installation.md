# Installation

This guide walks you through installing and configuring Dejafoo for self-hosted deployment.

## Prerequisites

### Required Software

- **AWS CLI**: Configured with appropriate permissions
- **Terraform**: Version 1.0 or higher
- **Node.js**: Version 18 or higher
- **Git**: For cloning the repository

### AWS Permissions

Your AWS credentials need permissions for:

- Lambda (create, update, invoke)
- API Gateway (create, update, deploy)
- S3 (create bucket, read/write objects)
- Route53 (create hosted zone, manage DNS records)
- ACM (create and manage SSL certificates)
- IAM (create roles and policies)
- CloudWatch (create log groups)

### Domain Name (Optional)

While not required, having a custom domain provides:
- Professional appearance
- SSL certificate management
- Better branding

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/camrail/dejafoo.git
cd dejafoo
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for documentation (optional)
cd docs
pip install -r requirements.txt
```

### 3. Configure Environment

Create your configuration file:

```bash
cp infra/phase1/terraform.tfvars.example infra/phase1/terraform.tfvars
```

Edit `infra/phase1/terraform.tfvars`:

```hcl
aws_region = "eu-west-3"        # Your preferred AWS region
environment = "prod"            # Environment name
domain_name = "yourdomain.com"  # Your domain (optional)
```

### 4. Deploy Infrastructure

Deploy in two phases to handle SSL certificate validation:

```bash
cd infra

# Phase 1: Core infrastructure
./phase1.sh

# Note the nameservers output - update these at your domain registrar
# Wait for DNS propagation (5-60 minutes)

# Phase 2: DNS and SSL
./phase2.sh
```

### 5. Deploy Application Code

```bash
cd ..
./deploy-code.sh
```

### 6. Verify Installation

```bash
# Run comprehensive test suite
node tests/test-production.js

# Test with your domain
curl "https://api.yourdomain.com?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
```

## Configuration Options

### Environment Variables

The Lambda function uses these environment variables:

- `S3_BUCKET_NAME`: S3 bucket for cache storage
- `UPSTREAM_BASE_URL`: Default upstream service URL
- `CACHE_TTL_SECONDS`: Default cache TTL in seconds
- `NODE_ENV`: Set to "production"

### Terraform Variables

Key configuration options in `terraform.tfvars`:

```hcl
# AWS Configuration
aws_region = "eu-west-3"        # AWS region
environment = "prod"            # Environment name

# Domain Configuration
domain_name = "yourdomain.com"  # Custom domain (optional)

# Lambda Configuration
lambda_timeout = 30             # Lambda timeout in seconds
lambda_memory_size = 256        # Lambda memory in MB

# Cache Configuration
default_ttl_seconds = 3600      # Default cache TTL
max_cache_size_mb = 1           # Max size before S3 fallback
```

## Regional Configuration

### Supported AWS Regions

Dejafoo works in any AWS region, but we recommend:

- **eu-west-3** (Paris) - Default
- **us-east-1** (N. Virginia)
- **us-west-2** (Oregon)
- **ap-southeast-1** (Singapore)

### Regional Endpoints

This deployment uses **regional API Gateway endpoints** instead of edge-optimized:

- **No CloudFront**: Requests go directly to your specified region
- **Simplified Caching**: Your custom S3-based caching works without CloudFront interference
- **Lower Latency**: For users in your region, requests are faster
- **Simpler Architecture**: Fewer moving parts, easier to debug

## Troubleshooting Installation

### Common Issues

1. **Terraform State Conflicts**
   ```bash
   # If you get state conflicts, clean up and retry
   cd infra/phase1
   terraform destroy
   cd ../phase2
   terraform destroy
   ```

2. **IAM Role Conflicts**
   ```bash
   # Delete existing roles manually
   aws iam delete-role-policy --role-name dejafoo-lambda-role --policy-name dejafoo-lambda-policy
   aws iam delete-role --role-name dejafoo-lambda-role
   ```

3. **S3 Bucket Name Conflicts**
   - S3 bucket names must be globally unique
   - Change the bucket name in `terraform.tfvars`

4. **SSL Certificate Validation**
   - Ensure nameservers are updated before Phase 2
   - Wait for DNS propagation (5-60 minutes)
   - Check with: `nslookup -type=NS yourdomain.com`

### Verification Commands

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Terraform installation
terraform version

# Check Node.js version
node --version

# Test API Gateway directly
curl -v "https://your-api-id.execute-api.region.amazonaws.com/prod?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
```

## Next Steps

- Learn about [configuration options](configuration.md)
- Explore [usage patterns](user-guide/usage.md)
- Set up [monitoring](user-guide/monitoring.md)
