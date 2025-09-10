# Environment Variables Reference

Complete reference for all environment variables used in Dejafoo.

## Lambda Function Environment Variables

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `S3_BUCKET_NAME` | S3 bucket for cache storage | `dejafoo-cache-prod` | Yes |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `UPSTREAM_BASE_URL` | Default upstream service URL | - | `https://api.example.com` |
| `CACHE_TTL_SECONDS` | Default cache TTL in seconds | `3600` | `7200` |
| `NODE_ENV` | Node environment | `production` | `development` |
| `LOG_LEVEL` | Logging level | `info` | `debug` |
| `MAX_CACHE_SIZE_MB` | Max size before S3 fallback | `1` | `5` |
| `ENABLE_DEBUG` | Enable debug logging | `false` | `true` |

## Terraform Environment Variables

### AWS Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `eu-west-3` |
| `AWS_PROFILE` | AWS profile | `default` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `...` |

### Terraform Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `TF_VAR_environment` | Environment name | `prod` |
| `TF_VAR_domain_name` | Domain name | `api.yourdomain.com` |
| `TF_VAR_aws_region` | AWS region | `eu-west-3` |

## Phase 1 Variables

### Core Configuration

```hcl
# infra/phase1/terraform.tfvars
aws_region = "eu-west-3"        # AWS region
environment = "prod"            # Environment name
domain_name = "yourdomain.com"  # Domain name (optional)
```

### Lambda Configuration

```hcl
# Lambda function settings
lambda_timeout = 30             # Timeout in seconds
lambda_memory_size = 256        # Memory in MB
lambda_runtime = "nodejs18.x"   # Runtime version
```

### S3 Configuration

```hcl
# S3 bucket settings
s3_bucket_name = "dejafoo-cache-prod"
s3_encryption = true
s3_lifecycle_enabled = true
s3_lifecycle_days = 30
```

### Cache Configuration

```hcl
# Cache settings
default_ttl_seconds = 3600      # Default TTL
max_cache_size_mb = 1           # Max size before S3 fallback
cache_compression = true        # Enable compression
```

## Phase 2 Variables

### SSL Configuration

```hcl
# SSL certificate settings
ssl_certificate_provider = "acm"
ssl_certificate_validation = "dns"
ssl_certificate_validation_timeout = "10m"
```

### DNS Configuration

```hcl
# DNS settings
dns_ttl = 300                   # DNS record TTL
dns_propagation_timeout = "10m" # DNS propagation timeout
```

### API Gateway Configuration

```hcl
# API Gateway settings
apigateway_type = "REGIONAL"    # Endpoint type
apigateway_throttle_burst = 5000
apigateway_throttle_rate = 2000
```

## Environment-Specific Variables

### Development Environment

```hcl
# Development settings
environment = "dev"
lambda_memory_size = 128
default_ttl_seconds = 300
s3_lifecycle_days = 7
log_level = "debug"
enable_debug = true
```

### Staging Environment

```hcl
# Staging settings
environment = "staging"
lambda_memory_size = 256
default_ttl_seconds = 1800
s3_lifecycle_days = 14
log_level = "info"
enable_debug = false
```

### Production Environment

```hcl
# Production settings
environment = "prod"
lambda_memory_size = 512
default_ttl_seconds = 3600
s3_lifecycle_days = 30
log_level = "warn"
enable_debug = false
```

## Custom Environment Variables

### Adding Custom Variables

1. **Update Terraform Variables**:
   ```hcl
   # infra/phase1/variables.tf
   variable "custom_setting" {
     description = "Custom setting"
     type        = string
     default     = "default_value"
   }
   ```

2. **Update Lambda Environment**:
   ```hcl
   # infra/phase1/modules/lambda/main.tf
   environment {
     variables = {
       CUSTOM_SETTING = var.custom_setting
     }
   }
   ```

3. **Update Lambda Code**:
   ```javascript
   // src/index.js
   const customSetting = process.env.CUSTOM_SETTING || 'default_value';
   ```

### Environment Variable Validation

```javascript
// src/index.js
function validateEnvironment() {
  const required = ['S3_BUCKET_NAME'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

## Security Considerations

### Sensitive Variables

Never store sensitive data in environment variables:

- **API Keys**: Use AWS Secrets Manager
- **Passwords**: Use AWS Secrets Manager
- **Tokens**: Use AWS Secrets Manager

### Environment Variable Encryption

```hcl
# Use AWS KMS for encryption
resource "aws_kms_key" "dejafoo_key" {
  description = "Dejafoo encryption key"
}

resource "aws_kms_alias" "dejafoo_alias" {
  name          = "alias/dejafoo"
  target_key_id = aws_kms_key.dejafoo_key.key_id
}
```

## Monitoring Environment Variables

### CloudWatch Integration

```hcl
# CloudWatch environment variables
environment {
  variables = {
    CLOUDWATCH_NAMESPACE = "Dejafoo"
    CLOUDWATCH_METRICS_ENABLED = "true"
    LOG_LEVEL = "info"
  }
}
```

### Custom Metrics

```javascript
// src/index.js
const cloudwatch = new AWS.CloudWatch();

function publishMetric(metricName, value, unit = 'Count') {
  if (process.env.CLOUDWATCH_METRICS_ENABLED === 'true') {
    cloudwatch.putMetricData({
      Namespace: process.env.CLOUDWATCH_NAMESPACE || 'Dejafoo',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit
      }]
    }).promise();
  }
}
```

## Troubleshooting Environment Variables

### Debug Environment Variables

```javascript
// src/index.js
function debugEnvironment() {
  if (process.env.ENABLE_DEBUG === 'true') {
    console.log('Environment variables:', {
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
      UPSTREAM_BASE_URL: process.env.UPSTREAM_BASE_URL,
      CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS,
      NODE_ENV: process.env.NODE_ENV
    });
  }
}
```

### Environment Variable Testing

```bash
# Test Lambda function with custom environment
aws lambda invoke --function-name dejafoo-proxy-prod \
  --payload '{"test": true}' \
  response.json

# Check Lambda environment variables
aws lambda get-function-configuration --function-name dejafoo-proxy-prod
```

### Common Issues

1. **Missing Required Variables**:
   - Check Terraform configuration
   - Verify Lambda function environment
   - Check CloudWatch logs

2. **Invalid Variable Values**:
   - Validate variable types
   - Check variable constraints
   - Test with valid values

3. **Environment Variable Not Updated**:
   - Redeploy Lambda function
   - Check Terraform state
   - Verify variable propagation

## Best Practices

### Variable Naming

- Use UPPER_CASE for environment variables
- Use descriptive names
- Follow consistent naming conventions

### Variable Documentation

- Document all variables
- Include examples
- Specify required vs optional

### Variable Validation

- Validate required variables
- Check variable types
- Provide default values where appropriate

### Security

- Never store secrets in environment variables
- Use AWS Secrets Manager for sensitive data
- Encrypt sensitive variables
- Rotate secrets regularly
