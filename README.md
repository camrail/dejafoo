# Dejafoo - JavaScript Proxy Service

A high-performance HTTP proxy service built with AWS Lambda, featuring intelligent caching and custom domain support.

## 🚀 Features

- **HTTP Proxy**: Forward requests to any upstream service
- **Intelligent Caching**: DynamoDB + S3 based caching with configurable TTL
- **Custom Domain Support**: API Gateway with Route53 integration
- **SSL/TLS**: Automatic SSL certificate management
- **High Performance**: Serverless architecture with sub-second response times
- **Easy Deployment**: One-command infrastructure and code deployment

## 🏗️ Architecture

```
Internet → Route53 → API Gateway → Lambda Function → Upstream Service
                    ↓
              DynamoDB (cache metadata)
                    ↓
              S3 (cache storage)
```

## 📁 Project Structure

```
dejafoo/
├── index.js              # Lambda function handler
├── package.json          # Node.js dependencies
├── deploy.sh             # Lambda deployment script
├── local-test.js         # Local development server
├── infra/                # Terraform infrastructure
│   ├── main.tf          # Main Terraform configuration
│   ├── terraform.tfvars # Environment variables
│   └── modules/         # Terraform modules
│       ├── apigateway/  # API Gateway configuration
│       ├── lambda/      # Lambda function setup
│       ├── dynamodb/    # DynamoDB table
│       ├── s3/          # S3 bucket for cache
│       └── route53/     # DNS and SSL certificates
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18
- Domain name (optional)

### 1. Configure Environment

Edit `infra/terraform.tfvars`:

```hcl
aws_region = "us-west-2"        # Your preferred AWS region
environment = "prod"            # Environment name
domain_name = "yourdomain.com"  # Your domain (optional)
```

### 2. Deploy Infrastructure

```bash
cd infra
terraform init
terraform plan
terraform apply
```

### 3. Deploy Lambda Code

```bash
cd ..
./deploy.sh
```

### 4. Test the Service

```bash
# Quick test suite
npm test

# Full battle test suite
npm run test:full

# Manual testing
curl "https://api.yourdomain.com?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"

# Test API Gateway directly
curl "https://your-api-id.execute-api.region.amazonaws.com/prod?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
```

## 🧪 Local Development

Run the local test server:

```bash
node local-test.js
```

Test with curl:

```bash
curl "http://localhost:3001/get?test=123"
curl "http://localhost:3001/json" -H "Accept: application/json"
```

## ⚙️ Configuration

### Environment Variables

- `DYNAMODB_TABLE_NAME`: DynamoDB table for cache metadata
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

Edit the cache logic in `index.js`:

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

- **Cache Hit Rate**: Monitor DynamoDB read/write operations
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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review CloudWatch logs
3. Open an issue on GitHub

---

**Built with ❤️ using AWS Lambda, API Gateway, DynamoDB, and S3**