# Getting Started

Welcome to Dejafoo! This section will help you get up and running quickly.

## What is Dejafoo?

Dejafoo is a high-performance HTTP proxy service built with AWS Lambda to cache expensive API endpoints and share between environments. It provides intelligent S3-based caching with configurable TTL and subdomain isolation.

## Key Features

- **HTTP Proxy**: Forward requests to any upstream service, with repeat requests served from cache
- **Intelligent Caching**: S3-based caching with configurable TTL and any-random-string to separate your stores
- **Custom Domain Support**: API Gateway with Route53 integration
- **SSL/TLS**: Automatic SSL certificate management
- **Regional Endpoints**: Direct regional API Gateway
- **High Performance**: Serverless architecture with sub-second response times
- **Easy Deployment**: One-command infrastructure and code deployment

## Quick Start

The fastest way to get started is to use the free hosted version at `dejafoo.io`:

```bash
# Cache an API response for 30 seconds
curl "https://myapp123.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"

# Use custom subdomain for isolation
curl "https://myapp.dejafoo.io?url=https://api.example.com/data&ttl=1h"
```

## Self-Hosted Deployment

If you want to deploy your own instance:

1. **[Quick Start](quick-start.md)** - 5-minute setup guide
2. **[Installation](installation.md)** - Detailed installation steps
3. **[Configuration](configuration.md)** - Configure caching and domains

## Next Steps

- Learn about [usage patterns](user-guide/usage.md)
- Explore the [API reference](api-reference/index.md)
- Set up [monitoring](user-guide/monitoring.md)
