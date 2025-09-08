# AGENTS.md

## Project Overview

Dejafoo is a high-performance HTTP proxy service built with AWS Lambda, featuring intelligent S3-based caching and custom domain support. The project uses a **two-phase deployment strategy** to handle SSL certificate validation and nameserver updates.

## Architecture

### Two-Phase Deployment Strategy

The infrastructure is split into two phases to handle the chicken-and-egg problem of SSL certificate validation:

**Phase 1 (Core Infrastructure):**
- Creates S3 bucket for caching
- Creates Lambda function with IAM roles
- Creates API Gateway (without custom domain)
- Creates Route53 hosted zone and outputs nameservers
- **No SSL certificates** - avoids validation issues

**Phase 2 (DNS & SSL):**
- Creates SSL certificates with DNS validation
- Creates DNS records for custom domain
- Configures API Gateway custom domain
- **Requires**: Nameservers updated at domain registrar

### Directory Structure

```
infra/
├── phase1.sh              # Phase 1 deployment script
├── phase2.sh              # Phase 2 deployment script
├── phase1/                # Phase 1 Terraform configuration
│   ├── core.tf           # Main Phase 1 configuration
│   ├── terraform.tfvars  # Phase 1 variables
│   └── modules/          # Phase 1 modules (no SSL)
│       ├── apigateway/   # API Gateway without custom domain
│       ├── lambda/       # Lambda function
│       ├── s3/           # S3 bucket for caching
│       └── route53/      # Route53 zone only (no SSL)
└── phase2/                # Phase 2 Terraform configuration
    ├── dns.tf            # Main Phase 2 configuration
    ├── dns.tfvars        # Phase 2 variables (auto-generated)
    └── modules/          # Phase 2 modules (with SSL)
        ├── apigateway/   # API Gateway with custom domain
        ├── lambda/       # Lambda function (same as Phase 1)
        ├── s3/           # S3 bucket (same as Phase 1)
        └── route53/      # Route53 with SSL certificates
```

## Deployment Commands

### Infrastructure Deployment (Rare)
```bash
# Phase 1: Core infrastructure
cd infra
./phase1.sh

# Update nameservers at domain registrar, then:
./phase2.sh
```

### Code Deployment (Frequent)
```bash
# Deploy Lambda function code
./deploy-code.sh
```

### Testing
```bash
# Run comprehensive test suite
node tests/test-production.js

# Individual test categories
npm run test:quick      # Quick functionality tests
npm run test:headers    # Header-based testing
npm run test:ttl        # TTL update functionality
npm run test:local      # Local development server
```

## Key Differences Between Phases

### Phase 1 Route53 Module
- Creates hosted zone
- Outputs nameservers
- **No SSL certificate resources**

### Phase 2 Route53 Module
- Creates SSL certificate with DNS validation
- Creates certificate validation records
- Creates DNS records for custom domain
- **Includes all SSL certificate resources**

## Code Style

- **JavaScript**: ES6+, async/await patterns
- **Terraform**: HCL2 syntax, consistent naming conventions
- **Testing**: Comprehensive test coverage with clear pass/fail indicators
- **Documentation**: Inline comments for complex logic

## Testing Instructions

- **Always run** `node tests/test-production.js` after code changes
- **Test coverage includes**: Subdomain isolation, cache behavior, TTL functionality, error handling
- **Cache hit/miss patterns**: First request = MISS, second = HIT, after TTL expiry = MISS
- **S3 fallback**: Large payloads (>1MB) use S3-backed caching

## Security Considerations

- **Regional API Gateway**: Uses regional endpoints (not edge) to avoid CloudFront caching conflicts
- **S3 encryption**: Server-side encryption for cache storage
- **IAM roles**: Minimal required permissions
- **SSL certificates**: DNS validation only (no email validation)

## Common Issues

### SSL Certificate Validation
- **Problem**: Certificate validation fails
- **Solution**: Ensure nameservers are updated before Phase 2
- **Check**: `nslookup -type=NS dejafoo.io`

### Cache Key Consistency
- **Expected**: Same request parameters = same cache key
- **TTL behavior**: Cache expires, but key remains consistent
- **Test**: Verify MISS → HIT → MISS pattern

### Large File Handling
- **S3 fallback**: Files >1MB automatically use S3
- **Cache headers**: Check `x-cache` header for HIT/MISS status
- **Size validation**: Slight size differences in test responses are normal

## Deployment Workflow

1. **Initial Setup**: Run Phase 1, update nameservers, run Phase 2
2. **Code Updates**: Use `./deploy-code.sh` for Lambda changes
3. **Infrastructure Changes**: Modify Terraform files, run appropriate phase
4. **Testing**: Always run test suite after changes
5. **Documentation**: Update README.md and AGENTS.md as needed

## File Organization

- **Root level**: Main application code (`index.js`)
- **`tests/test-production.js`**: Comprehensive test suite (all testing in one file)
- **`infra/`**: Terraform infrastructure (two-phase)
- **`deploy-code.sh`**: Lambda code deployment script

## AWS Resources

- **Lambda**: `dejafoo-proxy-prod` (Node.js 18.x)
- **API Gateway**: Regional endpoints with custom domain
- **S3**: Cache storage with lifecycle policies
- **Route53**: Hosted zone with DNS records
- **ACM**: SSL certificates with DNS validation
- **CloudWatch**: Logs and monitoring

## Environment Variables

- `S3_BUCKET_NAME`: S3 bucket for cache storage
- `UPSTREAM_BASE_URL`: Default upstream service URL
- `CACHE_TTL_SECONDS`: Cache time-to-live in seconds
- `NODE_ENV`: Set to "production"

## Troubleshooting

### Phase 1 Issues
- **IAM role conflicts**: Delete existing roles manually
- **CloudWatch log groups**: Delete existing log groups manually
- **S3 bucket conflicts**: Check for existing buckets with same name

### Phase 2 Issues
- **SSL certificate validation**: Ensure nameservers are updated
- **DNS propagation**: Wait 5-60 minutes for DNS changes
- **Certificate ARN**: Check certificate is in correct region (eu-west-3)

### Code Deployment Issues
- **Lambda function not found**: Run Phase 1 first
- **Permission denied**: Check AWS credentials and profile
- **Package size**: Ensure deployment package is under Lambda limits
