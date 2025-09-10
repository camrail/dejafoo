# Configuration

Learn how to configure Dejafoo for your specific use case.

## Environment Variables

The Lambda function uses these environment variables for configuration:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `S3_BUCKET_NAME` | S3 bucket for cache storage | - | Yes |
| `UPSTREAM_BASE_URL` | Default upstream service URL | - | No |
| `CACHE_TTL_SECONDS` | Default cache TTL in seconds | 3600 | No |
| `NODE_ENV` | Node environment | production | No |

## Terraform Configuration

### Phase 1 Variables

Edit `infra/phase1/terraform.tfvars`:

```hcl
# AWS Configuration
aws_region = "eu-west-3"        # Your preferred AWS region
environment = "prod"            # Environment name (dev, staging, prod)

# Domain Configuration
domain_name = "yourdomain.com"  # Your domain (optional)

# Lambda Configuration
lambda_timeout = 30             # Lambda timeout in seconds
lambda_memory_size = 256        # Lambda memory in MB

# Cache Configuration
default_ttl_seconds = 3600      # Default cache TTL
max_cache_size_mb = 1           # Max size before S3 fallback
```

### Phase 2 Variables

Phase 2 variables are auto-generated from Phase 1, but you can customize:

```hcl
# SSL Configuration
ssl_certificate_validation_timeout = "10m"

# DNS Configuration
dns_ttl = 300                   # DNS record TTL in seconds
```

## Cache Configuration

### TTL Settings

Configure default cache TTL in different ways:

```hcl
# In terraform.tfvars
default_ttl_seconds = 3600      # 1 hour default

# In Lambda environment
CACHE_TTL_SECONDS = 7200        # 2 hours default
```

### Cache Key Configuration

Cache keys are generated using:
- Subdomain (for isolation)
- URL (the upstream endpoint)
- HTTP method
- Query parameters
- Headers (if provided)

### S3 Configuration

```hcl
# S3 bucket configuration
s3_bucket_name = "dejafoo-cache-prod"
s3_encryption = true
s3_lifecycle_enabled = true
s3_lifecycle_days = 30
```

## Domain Configuration

### Custom Domain Setup

1. **Set Domain Name**:
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
- `api.yourdomain.com` - Main API endpoint
- `*.yourdomain.com` - Wildcard subdomain support
- Each subdomain gets isolated cache storage

## Security Configuration

### IAM Roles

The deployment creates minimal IAM roles:

```hcl
# Lambda execution role
lambda_execution_role = "dejafoo-lambda-role"

# S3 access policy
s3_policy = "dejafoo-s3-policy"

# API Gateway permissions
apigateway_policy = "dejafoo-apigateway-policy"
```

### SSL/TLS Configuration

```hcl
# SSL certificate configuration
ssl_certificate_provider = "acm"
ssl_certificate_validation = "dns"
ssl_certificate_validation_timeout = "10m"
```

### S3 Encryption

```hcl
# S3 server-side encryption
s3_encryption_algorithm = "AES256"
s3_encryption_key_management = "aws"
```

## Performance Configuration

### Lambda Configuration

```hcl
# Lambda performance settings
lambda_timeout = 30             # Maximum execution time
lambda_memory_size = 256        # Memory allocation
lambda_reserved_concurrency = 100  # Reserved concurrency
```

### API Gateway Configuration

```hcl
# API Gateway settings
apigateway_type = "REGIONAL"    # Regional endpoints
apigateway_throttle_burst = 5000
apigateway_throttle_rate = 2000
```

### S3 Performance

```hcl
# S3 performance settings
s3_transfer_acceleration = false
s3_intelligent_tiering = true
```

## Monitoring Configuration

### CloudWatch Logs

```hcl
# CloudWatch configuration
cloudwatch_log_retention = 14   # Days to retain logs
cloudwatch_log_level = "INFO"
```

### Metrics Configuration

```hcl
# Custom metrics
enable_custom_metrics = true
metrics_namespace = "Dejafoo"
```

## Regional Configuration

### Supported AWS Regions

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

## Environment-Specific Configuration

### Development Environment

```hcl
# Development settings
environment = "dev"
lambda_memory_size = 128
default_ttl_seconds = 300
s3_lifecycle_days = 7
```

### Staging Environment

```hcl
# Staging settings
environment = "staging"
lambda_memory_size = 256
default_ttl_seconds = 1800
s3_lifecycle_days = 14
```

### Production Environment

```hcl
# Production settings
environment = "prod"
lambda_memory_size = 512
default_ttl_seconds = 3600
s3_lifecycle_days = 30
```

## Custom Upstream Configuration

### Default Upstream Service

```hcl
# Set default upstream service
upstream_base_url = "https://api.example.com"
```

### Dynamic Upstream Selection

You can override the upstream service using headers:

```bash
# Use custom upstream service
curl -H "X-Upstream-URL: https://api.other.com" \
  "https://myapp123.dejafoo.io?url=/users&ttl=1h"
```

## Cache Behavior Configuration

### Cache Invalidation

```hcl
# Cache invalidation settings
cache_invalidation_enabled = true
cache_invalidation_ttl = 3600
```

### Large File Handling

```hcl
# Large file configuration
max_cache_size_mb = 1           # Max size before S3 fallback
s3_fallback_enabled = true
```

## Troubleshooting Configuration

### Debug Mode

```hcl
# Enable debug logging
debug_mode = true
log_level = "DEBUG"
```

### Health Check Configuration

```hcl
# Health check settings
health_check_enabled = true
health_check_path = "/health"
health_check_interval = 30
```

## Configuration Examples

### Basic Configuration

```hcl
# Basic production configuration
aws_region = "eu-west-3"
environment = "prod"
domain_name = "api.yourdomain.com"
lambda_memory_size = 256
default_ttl_seconds = 3600
```

### High-Performance Configuration

```hcl
# High-performance configuration
aws_region = "us-east-1"
environment = "prod"
domain_name = "api.yourdomain.com"
lambda_memory_size = 1024
lambda_timeout = 60
default_ttl_seconds = 7200
s3_transfer_acceleration = true
```

### Development Configuration

```hcl
# Development configuration
aws_region = "eu-west-3"
environment = "dev"
domain_name = "dev-api.yourdomain.com"
lambda_memory_size = 128
default_ttl_seconds = 300
debug_mode = true
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

### Health Check

```bash
# Check configuration health
curl "https://api.yourdomain.com/health"
```
