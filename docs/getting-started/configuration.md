# Configuration

Learn how to configure Dejafoo for your specific use case.

## Environment Variables

The Lambda function uses these environment variables for configuration:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `S3_BUCKET_NAME` | S3 bucket for cache storage | `dejafoo-cache-prod` | No |
| `UPSTREAM_BASE_URL` | Default upstream service URL | `https://httpbin.org` | No |
| `CACHE_TTL_SECONDS` | Default cache TTL in seconds | `3600` | No |
| `NODE_ENV` | Node environment | `production` | No |

**Note**: These environment variables are set in the Terraform configuration and can be modified by editing the Lambda module.

## Terraform Configuration

### Phase 1 Variables

Edit `infra/phase1/terraform.tfvars`:

```hcl
# AWS Configuration
aws_region = "eu-west-3"        # Your preferred AWS region
environment = "prod"            # Environment name (dev, staging, prod)

# Domain Configuration  
domain_name = "yourdomain.com"  # Your domain (optional)
```

### Phase 2 Variables

Phase 2 variables are auto-generated from Phase 1. No additional configuration is needed.

### Hardcoded Values

The following values are **hardcoded** in the Terraform modules and cannot be configured:

- **Lambda timeout**: 30 seconds
- **Lambda memory**: 512 MB
- **Cache TTL**: 3600 seconds (1 hour)
- **CloudWatch log retention**: 14 days
- **S3 bucket encryption**: Not implemented
- **API Gateway throttling**: Not implemented

## Cache Configuration

### TTL Settings

The cache TTL is **hardcoded** to 3600 seconds (1 hour) in the Lambda environment variables. To change this, you would need to:

1. Edit `infra/phase1/modules/lambda/main.tf`
2. Change the `CACHE_TTL_SECONDS` value in the environment variables
3. Redeploy the infrastructure

```hcl
# In infra/phase1/modules/lambda/main.tf
environment {
  variables = {
    CACHE_TTL_SECONDS = "7200"  # Change from 3600 to 7200
  }
}
```

### Cache Key Generation

Cache keys are automatically generated using a SHA-256 hash of:
- **Subdomain** (for isolation)
- **HTTP Method** (GET, POST, PUT, DELETE, etc.)
- **Target URL** (the upstream endpoint)
- **Query Parameters** (URL query string)
- **Request Payload** (POST/PUT body content)
- **TTL** (time-to-live setting)

**Note**: Cache key generation is hardcoded and not configurable. Headers are deliberately excluded to prevent authentication tokens from being stored in cache keys and to avoid cache misses due to frequently changing proxy headers.

## Domain Configuration

### Custom Domain Setup

1. **Set Domain Name** in `infra/phase1/terraform.tfvars`:
   ```hcl
   domain_name = "yourdomain.com"
   ```

2. **Deploy Phase 1**:
   ```bash
   cd infra
   ./phase1.sh
   ```

3. **Update Nameservers**:
   - Use the nameservers from Phase 1 output
   - Update at your domain registrar
   - Wait for DNS propagation (5-60 minutes)

4. **Deploy Phase 2**:
   ```bash
   ./phase2.sh
   ```

### Subdomain Configuration

Dejafoo automatically handles subdomains:
- `*.yourdomain.com` - Wildcard subdomain support
- Each subdomain gets isolated cache storage
- No additional configuration needed

## Modifying Hardcoded Values

To change hardcoded values, you need to edit the Terraform modules directly:

### Lambda Configuration

Edit `infra/phase1/modules/lambda/main.tf`:

```hcl
resource "aws_lambda_function" "dejafoo_proxy" {
  # ... other settings ...
  
  timeout = 30        # Change this value
  memory_size = 512   # Change this value
  
  environment {
    variables = {
      CACHE_TTL_SECONDS = "3600"  # Change this value
      # ... other variables ...
    }
  }
}
```

### CloudWatch Log Retention

Edit `infra/phase1/modules/lambda/main.tf`:

```hcl
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.dejafoo_proxy.function_name}"
  retention_in_days = 14  # Change this value
}
```

## Configuration Validation

### Terraform Validation

```bash
# Validate Terraform configuration
cd infra/phase1
terraform validate

cd ../phase2
terraform validate
```

### Configuration Testing

```bash
# Test configuration
node tests/test-production.js
```
