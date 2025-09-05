# Deployment Guide

This guide walks you through deploying Dejafoo to a new AWS environment.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18
- Domain name (optional, but recommended)

## Step 1: Configure Environment

1. **Copy the example configuration:**
   ```bash
   cp infra/terraform.tfvars.example infra/terraform.tfvars
   ```

2. **Edit `infra/terraform.tfvars`:**
   ```hcl
   aws_region = "us-west-2"        # Your preferred AWS region
   environment = "prod"            # Environment name (dev, staging, prod)
   domain_name = "yourdomain.com"  # Your domain (optional)
   ```

## Step 2: Deploy Infrastructure

1. **Initialize Terraform:**
   ```bash
   cd infra
   terraform init
   ```

2. **Review the plan:**
   ```bash
   terraform plan
   ```

3. **Apply the configuration:**
   ```bash
   terraform apply
   ```

   This will create:
   - Lambda function
   - API Gateway
   - DynamoDB table
   - S3 bucket
   - Route53 hosted zone (if domain provided)
   - SSL certificate (if domain provided)
   - IAM roles and policies

## Step 3: Deploy Lambda Code

1. **Install dependencies:**
   ```bash
   cd ..
   npm install
   ```

2. **Deploy the Lambda function:**
   ```bash
   ./deploy.sh
   ```

## Step 4: Configure Custom Domain (Optional)

If you provided a domain name:

1. **Get the nameservers:**
   ```bash
   cd infra
   terraform output nameservers
   ```

2. **Update your domain registrar:**
   - Go to your domain registrar's control panel
   - Update nameservers to the values from step 1
   - Wait for DNS propagation (5-60 minutes)

3. **Test the custom domain:**
   ```bash
   curl "https://api.yourdomain.com/get"
   ```

## Step 5: Test the Deployment

1. **Test API Gateway directly:**
   ```bash
   curl "https://your-api-id.execute-api.region.amazonaws.com/prod/get"
   ```

2. **Test with custom domain:**
   ```bash
   curl "https://api.yourdomain.com/get"
   ```

3. **Test local development:**
   ```bash
   node local-test.js
   ```

## Environment Variables

The Lambda function uses these environment variables:

- `DYNAMODB_TABLE_NAME`: DynamoDB table for cache metadata
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
- **Cache Hit Rate**: Monitor DynamoDB read/write operations
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
   - Verify DynamoDB and S3 permissions
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

**Warning**: This will permanently delete all resources including data in DynamoDB and S3.

## Security Notes

- IAM roles have minimal required permissions
- SSL/TLS encryption is enabled by default
- S3 server-side encryption is enabled for cache storage
- No hardcoded secrets or credentials

## Cost Optimization

- Lambda charges only for actual execution time
- DynamoDB on-demand billing scales with usage
- S3 charges only for storage used
- API Gateway charges per request

Estimated monthly cost for moderate usage: $5-20
