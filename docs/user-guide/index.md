# User Guide

Learn how to use Dejafoo effectively for caching API responses.

## Overview

Dejafoo is a high-performance HTTP proxy service that caches expensive API endpoints and shares responses between environments. It provides intelligent S3-based caching with configurable TTL and subdomain isolation.

## Basic Usage

### Simple Caching

```bash
# Cache an API response for 30 seconds
curl "https://myapp123.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"

# First request - cache miss
# Response: x-cache: MISS

# Second request - cache hit
curl "https://myapp123.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
# Response: x-cache: HIT
```

### Custom Subdomains

Use different subdomains to create isolated cache stores:

```bash
# These won't share cache entries
curl "https://app1.dejafoo.io?url=https://api.example.com/users&ttl=1h"
curl "https://app2.dejafoo.io?url=https://api.example.com/users&ttl=1h"
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

## TTL (Time-to-Live) Configuration

### TTL Formats

| Format | Description | Examples |
|--------|-------------|----------|
| `Xs` | Seconds | `30s`, `60s` |
| `Xm` | Minutes | `5m`, `30m` |
| `Xh` | Hours | `1h`, `24h` |
| `Xd` | Days | `1d`, `7d` |
| `Xw` | Weeks | `1w`, `2w` |

### TTL Examples

```bash
# Cache for 30 seconds
curl "https://myapp123.dejafoo.io?url=https://api.example.com/data&ttl=30s"

# Cache for 1 hour
curl "https://myapp123.dejafoo.io?url=https://api.example.com/data&ttl=1h"

# Cache for 7 days
curl "https://myapp123.dejafoo.io?url=https://api.example.com/data&ttl=7d"
```

## Response Headers

### Cache Status Headers

```http
HTTP/1.1 200 OK
x-cache: HIT
x-cache-key: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
x-cache-ttl: 3600
x-cache-expires: 2024-01-01T12:00:00Z
```

| Header | Description | Example |
|--------|-------------|---------|
| `x-cache` | Cache status | `HIT`, `MISS` |
| `x-cache-key` | Cache key used (SHA-256 hash) | `a1b2c3d4e5f6...` |
| `x-cache-ttl` | TTL in seconds | `3600` |
| `x-cache-expires` | Expiration timestamp | `2024-01-01T12:00:00Z` |

## Advanced Usage

### Custom Headers

```bash
# Pass custom headers to upstream API
curl "https://myapp123.dejafoo.io?url=https://api.example.com/protected&ttl=30m" \
  -H "Authorization: Bearer your-token"
```

### Query Parameters

```python
import requests

# Cache API with query parameters
response = requests.get(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users?page=1&limit=10&ttl=1h"
)
```

### POST Requests with Body

```python
import requests

# Cache POST request with JSON body
response = requests.post(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h",
    headers={"Content-Type": "application/json"},
    json={"name": "John Doe", "email": "john@example.com"}
)
```

## Cache Key Generation

Understanding how Dejafoo generates cache keys is crucial for effective caching.

### Key Components

Cache keys are generated using a SHA-256 hash of:

1. **Subdomain** - Provides isolation between different applications/users
2. **HTTP Method** - GET, POST, PUT, DELETE, etc.
3. **Target URL** - The upstream API endpoint
4. **Query Parameters** - URL query string parameters
5. **Request Payload** - POST/PUT body content
6. **TTL** - Time-to-live setting

### Why Headers Are Excluded

Headers are deliberately excluded from cache keys because:

- **Security**: Prevents authentication tokens from being stored in cache keys
- **Stability**: Avoids cache misses due to frequently changing proxy headers
- **Predictability**: Keeps cache keys stable and consistent

### Authentication Separation

Use different subdomains to separate cached data by user or API key:

```python
import requests

# User A's data (separate cache store)
response = requests.get(
    "https://user-a-123.dejafoo.io?url=https://api.example.com/data&ttl=1h",
    headers={"Authorization": "Bearer user-a-token"}
)

# User B's data (different cache store)
response = requests.get(
    "https://user-b-456.dejafoo.io?url=https://api.example.com/data&ttl=1h",
    headers={"Authorization": "Bearer user-b-token"}
)
```

### Cache Key Examples

```python
# These will have the SAME cache key (same subdomain, method, URL, payload)
response1 = requests.post(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h",
    headers={"Authorization": "Bearer token1"},
    json={"name": "John"}
)

response2 = requests.post(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h",
    headers={"Authorization": "Bearer token2"},  # Different auth, same cache key
    json={"name": "John"}
)

# These will have DIFFERENT cache keys (different subdomains)
response3 = requests.post(
    "https://app-a.dejafoo.io?url=https://api.example.com/users&ttl=1h",
    json={"name": "John"}
)

response4 = requests.post(
    "https://app-b.dejafoo.io?url=https://api.example.com/users&ttl=1h",
    json={"name": "John"}
)
```

## Caching Strategies

### Cache-Aside Pattern

```python
import requests

# 1. Check cache first
response = requests.get(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
)

# 2. If cache miss, fetch from upstream
# 3. Store in cache for future requests
```

### Write-Through Caching

```bash
# 1. Write to upstream API
curl -X POST "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h" \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'

# 2. Cache is automatically updated
```

### Cache Invalidation

```bash
# Cache expires automatically based on TTL
# No manual invalidation needed
# Set appropriate TTL for your use case
```

## Best Practices

### TTL Selection

- **Static Data**: Use longer TTL (hours/days)
- **Dynamic Data**: Use shorter TTL (minutes)
- **User-Specific Data**: Use very short TTL (seconds)

```bash
# Static configuration data
curl "https://myapp123.dejafoo.io?url=https://api.example.com/config&ttl=24h"

# Dynamic user data
curl "https://myapp123.dejafoo.io?url=https://api.example.com/user/profile&ttl=5m"

# Real-time data
curl "https://myapp123.dejafoo.io?url=https://api.example.com/status&ttl=30s"
```

### Subdomain Organization

- **Environment-based**: `dev.dejafoo.io`, `staging.dejafoo.io`, `prod.dejafoo.io`
- **Application-based**: `app1.dejafoo.io`, `app2.dejafoo.io`
- **Feature-based**: `api.dejafoo.io`, `webhooks.dejafoo.io`

```bash
# Environment isolation
curl "https://dev.dejafoo.io?url=https://api.example.com/users&ttl=1h"
curl "https://prod.dejafoo.io?url=https://api.example.com/users&ttl=1h"

# Application isolation
curl "https://frontend.dejafoo.io?url=https://api.example.com/users&ttl=1h"
curl "https://backend.dejafoo.io?url=https://api.example.com/users&ttl=1h"
```

### Error Handling

```bash
# Handle upstream errors gracefully
curl "https://myapp123.dejafoo.io?url=https://api.example.com/nonexistent&ttl=30s"
# Returns 404 with error details

# Check response status
if curl -f "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"; then
  echo "Success"
else
  echo "Error occurred"
fi
```

## Monitoring and Debugging

### Cache Hit Rate

Monitor cache performance using response headers:

```bash
# Check cache status
curl -I "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
# Look for x-cache header
```

### Debugging Cache Issues

```bash
# Check cache key generation
curl -v "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
# Look for x-cache-key header

# Test cache isolation
curl "https://app1.dejafoo.io?url=https://api.example.com/users&ttl=1h"
curl "https://app2.dejafoo.io?url=https://api.example.com/users&ttl=1h"
# Should have different cache keys
```

### Performance Monitoring

```bash
# Measure response times
time curl "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"

# Test cache hit performance
time curl "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
# Second request should be faster
```

## Common Use Cases

### API Response Caching

```bash
# Cache expensive API calls
curl "https://myapp123.dejafoo.io?url=https://api.example.com/expensive-calculation&ttl=1h"

# Cache database queries
curl "https://myapp123.dejafoo.io?url=https://api.example.com/users?active=true&ttl=30m"
```

### Cross-Environment Data Sharing

```bash
# Share data between environments
curl "https://shared.dejafoo.io?url=https://api.example.com/config&ttl=24h"

# Use in different applications
curl "https://app1.dejafoo.io?url=https://api.example.com/config&ttl=24h"
curl "https://app2.dejafoo.io?url=https://api.example.com/config&ttl=24h"
```

### Rate Limit Bypass

```bash
# Cache responses to avoid rate limits
curl "https://myapp123.dejafoo.io?url=https://api.example.com/rate-limited&ttl=1h"

# Use cached response instead of hitting rate limit
curl "https://myapp123.dejafoo.io?url=https://api.example.com/rate-limited&ttl=1h"
```

## Integration Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function getCachedData(url, ttl = '1h') {
  const response = await axios.get('https://myapp123.dejafoo.io', {
    params: { url, ttl }
  });
  
  console.log('Cache status:', response.headers['x-cache']);
  return response.data;
}

// Usage
const data = await getCachedData('https://api.example.com/users', '30m');
```

### Python

```python
import requests

def get_cached_data(url, ttl='1h'):
    response = requests.get('https://myapp123.dejafoo.io', params={
        'url': url,
        'ttl': ttl
    })
    
    print(f"Cache status: {response.headers.get('x-cache')}")
    return response.json()

# Usage
data = get_cached_data('https://api.example.com/users', '30m')
```

### cURL Scripts

```bash
#!/bin/bash

# Cache API response
cache_api() {
    local url=$1
    local ttl=${2:-"1h"}
    
    curl "https://myapp123.dejafoo.io?url=$url&ttl=$ttl"
}

# Usage
cache_api "https://api.example.com/users" "30m"
```

## Troubleshooting

### Common Issues

1. **Cache Not Working**
   - Check TTL format
   - Verify URL encoding
   - Check response headers

2. **Subdomain Isolation Issues**
   - Ensure different subdomains are used
   - Check cache keys in response headers

3. **Performance Issues**
   - Check cache hit rate
   - Verify TTL settings
   - Monitor response times

### Debug Commands

```bash
# Check cache status
curl -I "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"

# Test cache isolation
curl "https://app1.dejafoo.io?url=https://api.example.com/users&ttl=1h"
curl "https://app2.dejafoo.io?url=https://api.example.com/users&ttl=1h"

# Verify TTL
curl -v "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
```
