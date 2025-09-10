# Deployment Guide

This guide covers deploying Dejafoo infrastructure and code using the two-phase deployment strategy.

## Overview

Dejafoo uses a **two-phase deployment strategy** to handle SSL certificate validation and nameserver updates:

1. **Phase 1**: Core infrastructure (Lambda, API Gateway, S3)
2. **Phase 2**: DNS and SSL configuration (after nameserver update)
3. **Code Deployment**: Regular Lambda function updates

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18
- Domain name (optional, but recommended)

## Phase 1: Core Infrastructure

### What Phase 1 Creates

- Lambda function with IAM roles
- API Gateway (Regional endpoints)
- S3 bucket for caching
- Route53 hosted zone (if domain provided)
- **No SSL certificates** - avoids validation issues

### Deploy Phase 1

```bash
cd infra
./phase1.sh
```

### Phase 1 Outputs

After successful deployment, note these outputs:
- **Nameservers**: Update these at your domain registrar
- **API Gateway URL**: For testing before custom domain
- **S3 Bucket Name**: For cache storage

## Phase 2: DNS & SSL

### Prerequisites for Phase 2

1. **Update Nameservers**: Use the nameservers from Phase 1
2. **Wait for DNS Propagation**: 5-60 minutes
3. **Verify Nameserver Update**:
   ```bash
   nslookup -type=NS yourdomain.com
   ```

### What Phase 2 Creates

- SSL certificate with DNS validation
- DNS records (A, CNAME)
- API Gateway custom domain configuration
- Certificate validation records

### Deploy Phase 2

```bash
./phase2.sh
```

## Code Deployment

### Deploy Lambda Code

```bash
cd ..
./deploy-code.sh
```

This script:
- Packages `src/index.js` and dependencies
- Updates existing Lambda function code
- Preserves all infrastructure and environment variables

### Code Deployment Workflow

```bash
# 1. Make code changes
vim src/index.js

# 2. Deploy changes
./deploy-code.sh

# 3. Test changes
node tests/test-production.js
```

## Testing Deployment

### Comprehensive Test Suite

```bash
# Run full production test suite
node tests/test-production.js
```

### Manual Testing

```bash
# Test with custom domain
curl "https://api.yourdomain.com?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"

# Test API Gateway directly
curl "https://your-api-id.execute-api.region.amazonaws.com/prod?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
```

## Deployment Types

### Infrastructure Deployment (Rare)

**When to use**: Initial setup, infrastructure changes, scaling

```bash
cd infra
./phase1.sh    # If core infrastructure changes
./phase2.sh    # If DNS/SSL changes
```

### Code Deployment (Frequent)

**When to use**: Code changes, bug fixes, feature updates

```bash
./deploy-code.sh
```

### DNS Configuration (One-time)

**When to use**: After Phase 1 infrastructure deployment

- Update nameservers at domain registrar
- Wait for DNS propagation
- Proceed with Phase 2

## Environment Configuration

### Terraform Variables

Edit `infra/phase1/terraform.tfvars`:

```hcl
aws_region = "eu-west-3"        # Your preferred AWS region
environment = "prod"            # Environment name
domain_name = "yourdomain.com"  # Your domain (optional)
```

### Environment Variables

The Lambda function uses these environment variables:

- `S3_BUCKET_NAME`: S3 bucket for cache storage
- `UPSTREAM_BASE_URL`: Default upstream service URL
- `CACHE_TTL_SECONDS`: Cache time-to-live in seconds
- `NODE_ENV`: Set to "production"

## Monitoring Deployment

### CloudWatch Logs

```bash
# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/dejafoo"

# Get recent log events
aws logs get-log-events --log-group-name "/aws/lambda/dejafoo-proxy-prod" --log-stream-name "latest"
```

### Health Checks

```bash
# Check API Gateway health
curl "https://api.yourdomain.com/health"

# Check Lambda function
aws lambda invoke --function-name dejafoo-proxy-prod response.json
```

## Troubleshooting

### Phase 1 Issues

1. **IAM Role Conflicts**
   ```bash
   # Delete existing roles manually
   aws iam delete-role-policy --role-name dejafoo-lambda-role --policy-name dejafoo-lambda-policy
   aws iam delete-role --role-name dejafoo-lambda-role
   ```

2. **S3 Bucket Conflicts**
   - S3 bucket names must be globally unique
   - Change the bucket name in `terraform.tfvars`

3. **CloudWatch Log Groups**
   ```bash
   # Delete existing log groups
   aws logs delete-log-group --log-group-name "/aws/lambda/dejafoo-proxy-prod"
   ```

### Phase 2 Issues

1. **SSL Certificate Validation**
   - Ensure nameservers are updated before Phase 2
   - Wait for DNS propagation (5-60 minutes)
   - Check with: `nslookup -type=NS yourdomain.com`

2. **DNS Propagation**
   - Wait 5-60 minutes for DNS changes
   - Use `dig` or `nslookup` to verify

3. **Certificate ARN**
   - Check certificate is in correct region (eu-west-3)
   - Verify certificate status in AWS Console

### Code Deployment Issues

1. **Lambda Function Not Found**
   - Run Phase 1 first to create the function
   - Check function name in AWS Console

2. **Permission Denied**
   - Check AWS credentials and profile
   - Verify IAM permissions

3. **Package Size**
   - Ensure deployment package is under Lambda limits (50MB zipped)
   - Check `node_modules` size

## Cleanup

### Remove All Resources

```bash
cd infra/phase2
terraform destroy

cd ../phase1
terraform destroy
```

**Warning**: This will permanently delete all resources including data in S3.

### Partial Cleanup

```bash
# Remove only Phase 2 resources
cd infra/phase2
terraform destroy

# Remove only code (keep infrastructure)
# No specific command - just don't run deploy-code.sh
```

## Best Practices

### Deployment Workflow

1. **Test Locally**: Make changes and test locally
2. **Deploy Code**: Use `./deploy-code.sh` for code changes
3. **Test Production**: Run `node tests/test-production.js`
4. **Monitor**: Check CloudWatch logs and metrics

### Infrastructure Changes

1. **Plan Changes**: Use `terraform plan` before applying
2. **Backup State**: Keep Terraform state files safe
3. **Test in Dev**: Use different environment names for testing
4. **Document Changes**: Update documentation for infrastructure changes

### Security

- Use least-privilege IAM roles
- Enable CloudTrail for audit logging
- Regularly update dependencies
- Monitor for security vulnerabilities

## Regional Considerations

### Supported Regions

- **eu-west-3** (Paris) - Default
- **us-east-1** (N. Virginia)
- **us-west-2** (Oregon)
- **ap-southeast-1** (Singapore)

### Regional Endpoints

This deployment uses **regional API Gateway endpoints**:

- **No CloudFront**: Requests go directly to your specified region
- **Simplified Caching**: Your custom S3-based caching works without CloudFront interference
- **Lower Latency**: For users in your region, requests are faster
- **Simpler Architecture**: Fewer moving parts, easier to debug
