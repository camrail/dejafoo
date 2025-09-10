# Dejafoo - Effortless Cross Environment API Cache

A high-performance API proxy service built with AWS Lambda to cache expensive API endpoints and share between environments

📚 **[View Full Documentation](https://camrail.github.io/dejafoo/)** | 🚀 **[Quick Start](https://camrail.github.io/dejafoo/getting-started/quick-start/)**

## Why Dejafoo Exists

### The Problem: Expensive API Credits Burn Too Fast

When building features that depend on expensive APIs (like Apollo, Coresignal, or other services with limited monthly requests), you quickly burn through your credits during development. Running the same API calls in development, staging, and production means **paying 3x for the same data**.

### The Solution: Share API Data Across Environments

Dejafoo lets you cache expensive API responses and share them between environments using simple subdomain-based isolation. One API call in development can serve data to production, staging, and other environments without additional API costs.

### Real-World Use Cases

- **Cost Optimization**: Share expensive API data between dev/staging/prod environments
- **Rate Limit Management**: Avoid hitting API rate limits during development and testing
- **Performance**: Get instant responses for repeated API calls
- **Reliability**: Continue development when upstream APIs are down or slow
- **Team Collaboration**: Share expensive API data between team members
- **CI/CD Optimization**: Cache API responses in build pipelines
- **Testing Consistency**: Use the same data across different test runs
- **Cross-Environment Sync**: Keep data consistent across all your environments

### Example: Apollo API Integration

```bash
# Development: Fetch company data (uses 1 API credit)
curl "https://dev123.dejafoo.io?url=https://api.apollo.io/v1/companies&ttl=24h"

# Staging: Same data, no additional API cost
curl "https://staging456.dejafoo.io?url=https://api.apollo.io/v1/companies&ttl=24h"

# Production: Same data, no additional API cost
curl "https://prod789.dejafoo.io?url=https://api.apollo.io/v1/companies&ttl=24h"
```

**Result**: 1 API call, 3 environments served. Save 66% on API costs!

## Features

- **HTTP Proxy**: Forward requests to any upstream service, with repeat requests served from cache
- **Intelligent Caching**: S3-based caching with configurable TTL and any-random-string to seperate your stores
- **Custom Domain Support**: API Gateway with Route53 integration
- **SSL/TLS**: Automatic SSL certificate management
- **Regional Endpoints**: Direct regional API Gateway
- **High Performance**: Serverless architecture with sub-second response times
- **Easy Deployment**: One-command infrastructure and code deployment, or use the free dejafoo.io hosted version

## Usage

- Direct any API request (get, post, patch etc) to `{{ any-random-string }}.dejafoo.io?url={{ api-to-cache.com/endpoint }}&ttl={{ 7d }}`
- Response is cached up until the supplied ttl (`7s`, `7m`, `7d` for 7 seconds, 7 minutes and 7 days respectively)
- Cache is segregated by any-random-string + url + method

## Architecture

```
Internet → Route53 → API Gateway (Regional) → Lambda Function → Upstream Service
                    ↓
              S3 (cache storage)
```

## Project Structure

```
dejafoo/
├── src/                  # Source code
│   └── index.js         # Lambda function handler
├── package.json          # Node.js dependencies
├── deploy-code.sh        # Lambda code deployment script
├── tests/                # Test files
│   └── test-production.js # Comprehensive production test suite
├── infra/                # Terraform infrastructure
│   ├── phase1.sh        # Phase 1 deployment script
│   ├── phase2.sh        # Phase 2 deployment script
│   ├── phase1/          # Phase 1 Terraform configuration
│   │   ├── core.tf      # Phase 1 main configuration
│   │   ├── terraform.tfvars # Phase 1 variables
│   │   └── modules/     # Phase 1 modules (no SSL)
│   │       ├── apigateway/  # API Gateway without custom domain
│   │       ├── lambda/      # Lambda function setup
│   │       ├── s3/          # S3 bucket for cache
│   │       └── route53/     # Route53 zone only (no SSL)
│   └── phase2/          # Phase 2 Terraform configuration
│       ├── dns.tf       # Phase 2 main configuration
│       ├── dns.tfvars   # Phase 2 variables (auto-generated)
│       └── modules/     # Phase 2 modules (with SSL)
│           ├── apigateway/  # API Gateway with custom domain
│           ├── lambda/      # Lambda function setup
│           ├── s3/          # S3 bucket for cache
│           └── route53/     # Route53 with SSL certificates
└── README.md
```

## Quick Start

### Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18
- Domain name (optional)

### 1. Configure Environment

Edit `infra/phase1/terraform.tfvars`:

```hcl
aws_region = "eu-west-3"        # Your preferred AWS region
environment = "prod"            # Environment name
domain_name = "dejafoo.io"      # Your domain (optional)
```

### 2. Deploy Infrastructure (Two-Phase)

**Phase 1 - Core Infrastructure:**
```bash
cd infra
./phase1.sh
```

**Phase 2 - DNS & SSL (after updating nameservers):**
```bash
./phase2.sh
```

### 3. Deploy Lambda Code

```bash
# Deploy/update the Lambda function code
./deploy-code.sh
```

### 4. Test the Service

```bash
# Run comprehensive production test suite
node tests/test-production.js

# Manual testing
curl "https://api.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"

# Test API Gateway directly
curl "https://your-api-id.execute-api.region.amazonaws.com/prod?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
```

## 🧪 Testing

### Production Test Suite

The comprehensive test suite validates all aspects of the proxy service:

```bash
# Run the full production test suite
node tests/test-production.js
```

**Test Coverage:**
- **Basic Functionality**: HTTP proxy and response handling
- **Subdomain Isolation**: Ensures different subdomains don't leak data
- **Cache Behavior**: Hit/miss patterns with TTL validation
- **Header-based Caching**: Different headers create separate cache entries
- **Method Support**: GET, POST, PUT, DELETE methods
- **Data Leakage Prevention**: Sensitive data isolation between subdomains
- **Error Handling**: Graceful handling of invalid URLs and errors
- **Concurrent Requests**: Multiple simultaneous request handling
- **TTL Functionality**: Cache expiration and refresh behavior
- **S3 Integration**: Large payload handling and cache storage



### Local Development

The comprehensive test suite includes local development testing:

```bash
# Run the full test suite (includes local testing)
node tests/test-production.js
```

## 🚀 Deployment Guide

### Deployment Types

This project uses a **three-tier deployment strategy**:

#### 1. **Infrastructure Deployment** (Terraform)
- **Purpose**: Creates AWS resources (Lambda, API Gateway, S3, Route53, SSL certificates)
- **Scripts**: `infra/phase1.sh` and `infra/phase2.sh`
- **When to use**: Initial setup, infrastructure changes, scaling
- **Frequency**: Rare (only when changing AWS resources)

#### 2. **Code Deployment** (Lambda Function)
- **Purpose**: Updates the Lambda function code with new application logic
- **Script**: `./deploy.sh`
- **When to use**: Code changes, bug fixes, feature updates
- **Frequency**: Regular (every code change)

#### 3. **DNS Configuration** (Manual)
- **Purpose**: Updates domain nameservers to point to AWS
- **Process**: Manual update at domain registrar
- **When to use**: After Phase 1 infrastructure deployment
- **Frequency**: One-time per domain

### Deployment Workflow

```bash
# 1. Initial Infrastructure Setup (one-time)
cd infra
./phase1.sh                    # Deploy core infrastructure
# Update nameservers at domain registrar
./phase2.sh                    # Deploy DNS & SSL

# 2. Regular Code Updates (frequent)
cd ..
./deploy-code.sh               # Deploy updated Lambda code

# 3. Test Changes
node tests/test-production.js   # Validate deployment
```

### Infrastructure Deployment Details

**Phase 1 (`./phase1.sh`):**
- Creates Lambda function, API Gateway, S3 bucket
- Sets up IAM roles and policies
- Outputs nameservers for domain configuration

**Phase 2 (`./phase2.sh`):**
- Creates Route53 hosted zone and DNS records
- Provisions SSL certificates
- Configures API Gateway custom domain
- **Requires**: Nameservers updated at domain registrar

### Code Deployment Details

**`./deploy-code.sh`:**
- Packages `src/index.js`, `package.json`, and `node_modules`
- Updates existing Lambda function code
- Preserves all infrastructure and environment variables
- **Requires**: Infrastructure already deployed

## ⚙️ Configuration

### Environment Variables

- `S3_BUCKET_NAME`: S3 bucket for cache storage
- `UPSTREAM_BASE_URL`: Default upstream service URL
- `CACHE_TTL_SECONDS`: Cache time-to-live in seconds

### Upstream Service

The proxy forwards requests to the upstream service specified in `UPSTREAM_BASE_URL`. You can override this by setting the `X-Upstream-URL` header:

```bash
curl -H "X-Upstream-URL: https://api.example.com" "https://api.yourdomain.com/data"
```

## 🔧 Customization

### Adding New Upstream Services

1. Update the `UPSTREAM_BASE_URL` environment variable
2. Redeploy with `./deploy.sh`

### Modifying Cache Behavior

Edit the cache logic in `src/index.js`:

```javascript
// Cache TTL configuration
const CACHE_TTL_SECONDS = process.env.CACHE_TTL_SECONDS || 3600;

// Cache key generation
const cacheKey = generateCacheKey(method, path, queryString, headers);
```

### Custom Domain Setup

1. Update `domain_name` in `terraform.tfvars`
2. Run `terraform apply`
3. Update your domain's nameservers to the provided values
4. Wait for DNS propagation (5-60 minutes)

## 📊 Monitoring

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

## 🛠️ Troubleshooting

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

## 🔒 Security

- IAM roles with minimal required permissions
- SSL/TLS encryption in transit
- S3 server-side encryption for cache storage
- No hardcoded secrets or credentials

## 📈 Performance

- **Cold Start**: ~200-500ms
- **Warm Request**: ~50-100ms
- **Cache Hit**: ~20-50ms
- **Throughput**: 1000+ requests/second

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `node local-test.js`
5. Submit a pull request

## 📚 Documentation

- **[Complete Documentation](https://camrail.github.io/dejafoo/)** - Full documentation with guides, API reference, and examples
- **[Quick Start Guide](https://camrail.github.io/dejafoo/getting-started/quick-start/)** - Get up and running in 5 minutes
- **[API Reference](https://camrail.github.io/dejafoo/api-reference/)** - Complete API documentation
- **[Deployment Guide](https://camrail.github.io/dejafoo/deployment/)** - Infrastructure and code deployment
- **[User Guide](https://camrail.github.io/dejafoo/user-guide/)** - Usage patterns and best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤖 For AI Agents

This project includes an [AGENTS.md](AGENTS.md) file with detailed architecture information, deployment workflows, and troubleshooting guides specifically designed for AI coding agents.

## 🆘 Support

For issues and questions:

1. **[Check the documentation](https://camrail.github.io/dejafoo/)** - Comprehensive guides and troubleshooting
2. Review CloudWatch logs
3. Open an issue on [GitHub](https://github.com/camrail/dejafoo/issues)

---

**Built with ❤️ using AWS Lambda, API Gateway, and S3**