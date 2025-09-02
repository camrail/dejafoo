# Dejafoo

A high-performance HTTP proxy with intelligent caching, built with Rust for AWS Lambda and designed to accelerate API responses through smart caching strategies.

## Features

- 🚀 **High Performance**: Built with Rust for maximum speed and memory safety
- 🧠 **Intelligent Caching**: Smart cache key generation and TTL management
- ☁️ **AWS Native**: DynamoDB + S3 storage with Lambda deployment
- 🔒 **Security First**: Request validation, rate limiting, and CORS support
- 📊 **Observability**: Comprehensive logging and metrics
- 🛠️ **Developer Friendly**: Local development tools and comprehensive testing

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client        │    │   Dejafoo       │    │   Upstream      │
│   Request       │───▶│   Proxy         │───▶│   API           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Cache Store   │
                       │   (DynamoDB+S3) │
                       └─────────────────┘
```

## Quick Start

### Prerequisites

- AWS CLI configured
- Rust 1.70+

### Installation

```bash
git clone https://github.com/yourusername/dejafoo.git
cd dejafoo
cargo build --release
```

### Configuration

1. Copy the environment template:
```bash
cp config/env.sample .env
```

2. Update the configuration:
```bash
# Required: Set your upstream API URL
UPSTREAM_BASE_URL=https://api.example.com

# Optional: Configure AWS resources
DYNAMODB_TABLE_NAME=dejafoo-cache
S3_BUCKET_NAME=dejafoo-cache-storage
```

### Local Development

Start the proxy locally:

```bash
cargo run --bin dejafoo-proxy
```

Or use the helper script:
```bash
./scripts/local_proxy.sh -u https://api.example.com
```

### Testing

Run the test suite:

```bash
cargo test
```

Run load tests:
```bash
python3 scripts/load_test.py --url http://localhost:8080 --concurrent 10 --total 100
```

## Configuration

### Cache Policies

Configure caching behavior in `config/policies.yaml`:

```yaml
# Default cache settings
default_ttl: 3600  # 1 hour
max_body_size: 10485760  # 10MB

# Per-endpoint policies
endpoint_policies:
  "GET /api/users":
    ttl: 300  # 5 minutes
    cacheable: true
    headers_to_vary:
      - authorization
```

### Security

Configure security settings in `config/allowlist.yaml`:

```yaml
# Allowed upstream hosts
allowed_hosts:
  - api.example.com
  - api.staging.example.com

# Blocked paths
blocked_paths:
  - /admin/*
  - /internal/*

# Rate limiting
rate_limiting:
  enabled: true
  requests_per_minute: 1000
```

## Deployment

### AWS Lambda

Deploy to AWS Lambda using the provided infrastructure:

```bash
# Deploy infrastructure
cd infra
terraform init
terraform plan
terraform apply

# Deploy application
cargo lambda build --release
cargo lambda deploy
```

### Docker

Build and run with Docker:

```bash
docker build -t dejafoo .
docker run -p 8080:8080 -e UPSTREAM_BASE_URL=https://api.example.com dejafoo
```

## API Reference

### Cache Key Generation

Cache keys are generated based on:
- HTTP method
- Normalized path (query parameters excluded)
- Relevant headers (authorization, content-type, etc.)
- Request body hash

### Cache Policies

- **TTL**: Time-to-live for cached responses
- **Headers to Vary**: Headers that affect cache key generation
- **Body Size Limits**: Maximum response size for caching
- **Cacheable Methods**: Which HTTP methods can be cached

### Security Features

- **Request Validation**: Validates upstream URLs and headers
- **Rate Limiting**: Configurable request rate limits
- **CORS Support**: Cross-origin resource sharing configuration
- **Security Headers**: Automatic security header injection

## Monitoring

### Metrics

The proxy exposes Prometheus-compatible metrics:

- `dejafoo_requests_total`: Total number of requests
- `dejafoo_cache_hits_total`: Number of cache hits
- `dejafoo_cache_misses_total`: Number of cache misses
- `dejafoo_response_time_seconds`: Response time histogram

### Logging

Structured logging with configurable levels:

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "message": "Cache operation",
  "operation": "GET",
  "cache_key": "abc123",
  "success": true,
  "duration_ms": 50
}
```

### Health Checks

Health check endpoints:
- `GET /health`: Basic health check
- `GET /health/detailed`: Detailed health information

## Performance

### Benchmarks

Typical performance characteristics:

- **Latency**: < 10ms for cache hits, < 100ms for cache misses
- **Throughput**: 1000+ requests/second
- **Cache Hit Rate**: 70-90% for typical API workloads
- **Memory Usage**: < 128MB for Lambda deployment

### Optimization Tips

1. **Cache Key Design**: Minimize cache key variations
2. **TTL Tuning**: Balance freshness vs. performance
3. **Body Size Limits**: Set appropriate limits for your use case
4. **Header Filtering**: Exclude unnecessary headers from cache keys

## Development

### Project Structure

```
dejafoo/
├── infra/                 # Infrastructure as Code
│   ├── main.tf
│   └── modules/
├── src/                   # Source code
│   ├── handler.rs|py|ts   # Lambda entrypoint
│   ├── cache/             # Cache implementation
│   ├── proxy/             # Proxy logic
│   └── utils/             # Utilities
├── tests/                 # Test suite
├── scripts/               # Development scripts
├── config/                # Configuration files
└── docs/                  # Documentation
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Style

- **Rust**: Use `cargo fmt` and `cargo clippy`

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://dejafoo.readthedocs.io)
- 🐛 [Issue Tracker](https://github.com/yourusername/dejafoo/issues)
- 💬 [Discussions](https://github.com/yourusername/dejafoo/discussions)
- 📧 [Email Support](mailto:support@example.com)

## Changelog

### v0.1.0 (2024-01-01)
- Initial release
- Basic proxy functionality
- DynamoDB + S3 caching
- AWS Lambda deployment
- Comprehensive test suite
