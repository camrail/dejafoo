# API Reference

Complete API documentation for Dejafoo's HTTP proxy service.

## Base URL

- **Hosted Version**: `https://{your-random-string}.dejafoo.io`
- **Custom Domain**: `https://{your-random-string}.yourdomain.com`
- **API Gateway Direct**: `https://your-api-id.execute-api.region.amazonaws.com/prod`

## Authentication

Dejafoo currently does not require authentication. All requests are public.

## Rate Limits

- **Hosted Version**: 1000 requests/hour per IP
- **Self-Hosted**: No limits (AWS API Gateway limits apply)

## Request Format

All requests are made via HTTP GET to the Dejafoo endpoint with query parameters.

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `url` | string | The upstream API endpoint to cache | `https://api.example.com/users` |
| `ttl` | string | Time-to-live for the cache | `30s`, `1h`, `7d` |

### Optional Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `method` | string | HTTP method (default: GET) | `POST`, `PUT`, `DELETE` |
| `headers` | string | JSON-encoded headers | `{"Authorization": "Bearer token"}` |

## Response Format

### Success Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
x-cache: HIT
x-cache-key: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
x-cache-ttl: 3600
x-cache-expires: 2024-01-01T12:00:00Z

{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Response Headers

| Header | Description | Example |
|--------|-------------|---------|
| `x-cache` | Cache status | `HIT`, `MISS` |
| `x-cache-key` | Cache key used (SHA-256 hash) | `a1b2c3d4e5f6...` |
| `x-cache-ttl` | TTL in seconds | `3600` |
| `x-cache-expires` | Expiration timestamp | `2024-01-01T12:00:00Z` |

## Error Responses

### 400 Bad Request

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid TTL format",
  "message": "TTL must be in format like '30s', '1h', '7d'"
}
```

### 404 Not Found

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "Upstream service not found",
  "message": "Could not reach https://api.example.com/users"
}
```

### 500 Internal Server Error

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Examples

### Basic GET Request

```python
import requests

response = requests.get(
    "https://myapp123.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
)
```

### POST Request with Headers

```python
import requests

response = requests.post(
    "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h&method=POST",
    headers={"Content-Type": "application/json"},
    json={"name": "John Doe", "email": "john@example.com"}
)
```

### Custom Subdomain

```python
import requests

response = requests.get(
    "https://myapp123.dejafoo.io?url=https://api.example.com/data&ttl=7d"
)
```

### With Custom Headers

```python
import requests

response = requests.get(
    "https://myapp123.dejafoo.io?url=https://api.example.com/protected&ttl=30m",
    headers={"Authorization": "Bearer token"}
)
```

## TTL Format

The `ttl` parameter accepts various time formats:

| Format | Description | Examples |
|--------|-------------|----------|
| `Xs` | Seconds | `30s`, `60s` |
| `Xm` | Minutes | `5m`, `30m` |
| `Xh` | Hours | `1h`, `24h` |
| `Xd` | Days | `1d`, `7d` |
| `Xw` | Weeks | `1w`, `2w` |

## Cache Behavior

### Cache Key Generation

Cache keys are generated using a SHA-256 hash of the following data:
- Subdomain (for isolation)
- HTTP method
- Target URL
- Query parameters
- Request payload (if any)
- TTL value

The key is generated as: `SHA256(subdomain:method:url:queryParams:payload:ttl)`

This ensures:
- **Unique keys** for different requests
- **Consistent keys** for identical requests
- **Collision-resistant** hashing
- **Privacy** - keys don't expose sensitive data

### Cache Isolation

Different subdomains create separate cache stores:

```bash
# These won't share cache entries
curl "https://app1.dejafoo.io?url=https://api.example.com/users&ttl=1h"
curl "https://app2.dejafoo.io?url=https://api.example.com/users&ttl=1h"
```

### Cache Expiration

- Cached responses expire after the specified TTL
- Expired entries are automatically removed
- New requests to expired entries will fetch fresh data

## Large File Handling

For responses larger than 1MB:
- Data is automatically stored in S3
- Response includes `x-cache-storage: s3` header
- S3 storage is transparent to the client

## Monitoring

### Health Check

```bash
curl "https://myapp123.dejafoo.io/health"
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0"
}
```

### Metrics

Monitor your usage through:
- Response headers (`x-cache` status)
- CloudWatch logs (for self-hosted)
- API Gateway metrics

## SDKs and Libraries

### JavaScript/Node.js

```javascript
const dejafoo = require('dejafoo-client');

const client = new dejafoo.Client('https://myapp123.dejafoo.io');

// Cache an API response
const response = await client.get('https://api.example.com/users', {
  ttl: '1h',
  subdomain: 'myapp'
});
```

### Python

```python
import requests

def cache_request(url, ttl='30s', subdomain='api'):
    response = requests.get(f'https://{subdomain}.dejafoo.io', params={
        'url': url,
        'ttl': ttl
    })
    return response.json()
```

### cURL

```bash
# Simple caching
curl "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"

# With custom headers
curl -H "Authorization: Bearer token" \
  "https://myapp123.dejafoo.io?url=https://api.example.com/protected&ttl=30m"
```

## Rate Limiting

### Hosted Version

- 1000 requests/hour per IP address
- Rate limit headers included in responses
- 429 status code when limit exceeded

### Self-Hosted

- No built-in rate limiting
- AWS API Gateway limits apply
- Can be configured with API Gateway throttling

## Security Considerations

- All requests are logged
- HTTPS is enforced
- No authentication required (public service)
- Subdomain isolation prevents data leakage
- S3 encryption for cached data
