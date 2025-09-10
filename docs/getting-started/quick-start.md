# Quick Start

Get Dejafoo running in 5 minutes using the free hosted version or deploy your own instance.

## Option 1: Free Hosted Version (Recommended)

The fastest way to get started is using the free hosted version at `dejafoo.io`:

### Basic Usage

```python
import requests

# Cache a POST request for 30 seconds
response = requests.post(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=30s",
    headers={"Content-Type": "application/json"},
    json={"name": "John Doe", "email": "john@example.com"}
)

# Cache a GET request for 1 hour
response = requests.get(
    "https://myapp123.dejafoo.io?url=https://api.example.com/data&ttl=1h"
)

# Use different subdomain for isolation
response = requests.post(
    "https://another456.dejafoo.io?url=https://api.example.com/orders&ttl=7d",
    headers={"Content-Type": "application/json"},
    json={"product_id": 123, "quantity": 2}
)
```

### Parameters

- `url`: The upstream API endpoint to cache
- `ttl`: Time-to-live (`7s`, `7m`, `7d` for seconds, minutes, days)

### Response Headers

```http
HTTP/1.1 200 OK
x-cache: HIT
x-cache-key: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
x-cache-ttl: 604800
```

## Option 2: Self-Hosted Deployment

### Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18
- Domain name (optional)

### 1. Clone and Configure

```bash
git clone https://github.com/camrail/dejafoo.git
cd dejafoo

# Configure your domain
cp infra/phase1/terraform.tfvars.example infra/phase1/terraform.tfvars
# Edit infra/phase1/terraform.tfvars with your settings
```

### 2. Deploy Infrastructure

```bash
cd infra
./phase1.sh  # Deploy core infrastructure
# Update nameservers at your domain registrar
./phase2.sh  # Deploy DNS & SSL
```

### 3. Deploy Code

```bash
cd ..
./deploy-code.sh  # Deploy Lambda function
```

### 4. Test

```bash
node tests/test-production.js
```

## Usage Examples

### Basic Caching

```bash
# First request - cache miss
curl "https://myapp123.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
# Response: x-cache: MISS

# Second request - cache hit
curl "https://myapp123.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
# Response: x-cache: HIT
```

### Subdomain Isolation

```bash
# Different subdomains = separate cache stores
curl "https://myapp123.dejafoo.io?url=https://api.example.com/data&ttl=1h"
curl "https://otherapp456.dejafoo.io?url=https://api.example.com/data&ttl=1h"
# These won't share cache entries
```

### Different HTTP Methods

```python
import requests

# GET request
response = requests.get(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
)

# POST request (different cache entry)
response = requests.post(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h",
    headers={"Content-Type": "application/json"},
    json={"name": "John"}
)
```

## Next Steps

- Learn about [advanced configuration](configuration.md)
- Explore [caching strategies](user-guide/caching.md)
- Set up [monitoring](user-guide/monitoring.md)
- Read the [API reference](api-reference/index.md)
