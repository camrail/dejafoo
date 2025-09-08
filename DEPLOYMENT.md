# Deployment Guide

This guide walks you through deploying Dejafoo using the two-phase infrastructure deployment strategy.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18
- Domain name (optional, but recommended)

## Deployment Overview

Dejafoo uses a **two-phase deployment strategy**:

1. **Phase 1**: Core infrastructure (Lambda, API Gateway, S3)
2. **Phase 2**: DNS and SSL configuration (after nameserver update)
3. **Code Deployment**: Regular Lambda function updates

## Step 1: Configure Environment

1. **Edit `infra/phase1/terraform.tfvars`:**
   ```hcl
   aws_region = "eu-west-3"       # Your preferred AWS region
   environment = "prod"            # Environment name (dev, staging, prod)
   domain_name = "dejafoo.io"      # Your domain (optional)
   ```

## Step 2: Deploy Infrastructure - Phase 1

1. **Deploy core infrastructure:**
   ```bash
   cd infra
   ./phase1.sh
   ```

   This creates:
   - Lambda function
   - API Gateway (Regional endpoints)
   - S3 bucket for caching
   - IAM roles and policies
   - Route53 hosted zone (if domain provided)

2. **Note the nameservers:**
   The script will output nameservers that you need to update at your domain registrar.

## Step 3: Configure Domain Nameservers

1. **Update nameservers at your domain registrar:**
   - Go to your domain registrar's control panel
   - Update nameservers to the values from Phase 1
   - Wait for DNS propagation (5-60 minutes)

2. **Verify nameserver update:**
   ```bash
   nslookup -type=NS dejafoo.io
   ```

## Step 4: Deploy Infrastructure - Phase 2

1. **Deploy DNS and SSL:**
   ```bash
   ./phase2.sh
   ```

   This creates:
   - DNS records (A, CNAME)
   - SSL certificate
   - API Gateway custom domain configuration

## Step 5: Deploy Lambda Code

1. **Install dependencies:**
   ```bash
   cd ..
   npm install
   ```

2. **Deploy the Lambda function:**
   ```bash
   ./deploy-code.sh
   ```

## Step 6: Test the Deployment

1. **Run comprehensive tests:**
   ```bash
   node test-production.js
   ```

2. **Test with custom domain:**
   ```bash
   curl "https://api.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
   ```

3. **Test local development:**
   ```bash
   node tests/local-test.js
   ```

## Ongoing Deployments

### Code Updates (Frequent)
```bash
# After making code changes
./deploy-code.sh
node test-production.js
```

### Infrastructure Updates (Rare)
```bash
# Only when changing AWS resources
cd infra
./phase1.sh    # If core infrastructure changes
./phase2.sh    # If DNS/SSL changes
```

## Environment Variables

The Lambda function uses these environment variables:

- `S3_BUCKET_NAME`: S3 bucket for cache storage  
- `UPSTREAM_BASE_URL`: Default upstream service URL
- `CACHE_TTL_SECONDS`: Cache time-to-live in seconds

## Monitoring

### CloudWatch Logs
```bash
# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/dejafoo"

# Get recent log events
aws logs get-log-events --log-group-name "/aws/lambda/dejafoo-proxy-prod" --log-stream-name "latest"
```

### Performance Metrics
- **Cache Hit Rate**: Monitor S3 read/write operations
- **Response Time**: Check CloudWatch Lambda metrics
- **Error Rate**: Monitor Lambda error count

## Troubleshooting

### Common Issues

1. **403 Forbidden on Custom Domain**
   - Check DNS propagation: `nslookup api.yourdomain.com`
   - Verify nameservers are updated
   - Wait for SSL certificate validation

2. **Lambda Timeout**
   - Check upstream service availability
   - Increase Lambda timeout in Terraform
   - Review CloudWatch logs

3. **Cache Not Working**
   - Verify S3 permissions
   - Check AWS region configuration
   - Review Lambda environment variables

### Debug Commands

```bash
# Test API Gateway directly
curl -v "https://your-api-id.execute-api.region.amazonaws.com/prod/get"

# Check Lambda logs
aws logs get-log-events --log-group-name "/aws/lambda/dejafoo-proxy-prod" --start-time $(date -d '1 hour ago' +%s)000

# Test local development
node local-test.js
```

## Cleanup

To remove all resources:

```bash
cd infra
terraform destroy
```

**Warning**: This will permanently delete all resources including data in S3.

## Regional Endpoints

This deployment uses **regional API Gateway endpoints** instead of edge-optimized endpoints. This means:

- **No CloudFront**: Requests go directly to your specified region (eu-west-3)
- **Simplified Caching**: Your custom S3-based caching works without CloudFront interference
- **Lower Latency**: For users in your region, requests are faster
- **Simpler Architecture**: Fewer moving parts, easier to debug

## Security Notes

- IAM roles have minimal required permissions
- SSL/TLS encryption is enabled by default
- S3 server-side encryption is enabled for cache storage
- No hardcoded secrets or credentials

## Cost Optimization

- Lambda charges only for actual execution time
- S3 charges only for storage used
- API Gateway charges per request

Estimated monthly cost for moderate usage: $5-20
