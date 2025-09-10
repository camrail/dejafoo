# API Endpoints

Complete reference for all Dejafoo API endpoints.

## Base URLs

- **Hosted Version**: `https://{your-random-string}.dejafoo.io`
- **Custom Domain**: `https://{your-random-string}.yourdomain.com`
- **API Gateway Direct**: `https://your-api-id.execute-api.region.amazonaws.com/prod`

## Main Proxy Endpoint

### GET /

The main proxy endpoint that caches upstream API responses.

**URL**: `https://{your-random-string}.dejafoo.io`

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `url` | string | Yes | The upstream API endpoint to cache | `https://api.example.com/users` |
| `ttl` | string | Yes | Time-to-live for the cache | `30s`, `1h`, `7d` |
| `method` | string | No | HTTP method (default: GET) | `POST`, `PUT`, `DELETE` |
| `headers` | string | No | JSON-encoded headers | `{"Authorization": "Bearer token"}` |

**Example Request**:

```bash
curl "https://{your-random-string}.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=30s"
```

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json
x-cache: HIT
x-cache-key: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
x-cache-ttl: 30
x-cache-expires: 2024-01-01T12:00:30Z

{
  "userId": 1,
  "id": 1,
  "title": "delectus aut autem",
  "completed": false
}
```

## Health Check Endpoint

### GET /health

Check the health status of the Dejafoo service.

**URL**: `https://myapp123.dejafoo.io/health`

**Example Request**:

```bash
curl "https://myapp123.dejafoo.io/health"
```

**Example Response**:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "version": "1.0.0",
  "uptime": 86400
}
```

## Subdomain Endpoints

### Wildcard Subdomain Support

Dejafoo supports wildcard subdomains for cache isolation:

- `https://app1.dejafoo.io` - Isolated cache store
- `https://app2.dejafoo.io` - Separate cache store
- `https://myapp.dejafoo.io` - Custom app cache store

**Example**:

```bash
# These won't share cache entries
curl "https://app1.dejafoo.io?url=https://api.example.com/users&ttl=1h"
curl "https://app2.dejafoo.io?url=https://api.example.com/users&ttl=1h"
```

## HTTP Methods

### GET Requests

Standard GET requests for retrieving data:

```bash
curl "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
```

### POST Requests

POST requests with request body:

```bash
curl -X POST "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

### PUT Requests

PUT requests for updating resources:

```bash
curl -X PUT "https://myapp123.dejafoo.io?url=https://api.example.com/users/1&ttl=1h" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Updated", "email": "john.updated@example.com"}'
```

### DELETE Requests

DELETE requests for removing resources:

```bash
curl -X DELETE "https://myapp123.dejafoo.io?url=https://api.example.com/users/1&ttl=1h"
```

## Request Headers

### Custom Headers

Pass custom headers to the upstream API:

```bash
curl "https://myapp123.dejafoo.io?url=https://api.example.com/protected&ttl=30m" \
  -H "Authorization: Bearer your-token" \
  -H "X-Custom-Header: value"
```

### Upstream URL Override

Override the default upstream service:

```bash
curl -H "X-Upstream-URL: https://api.other.com" \
  "https://myapp123.dejafoo.io?url=/users&ttl=1h"
```

## Response Headers

### Cache Headers

| Header | Description | Example |
|--------|-------------|---------|
| `x-cache` | Cache status | `HIT`, `MISS` |
| `x-cache-key` | Cache key used (SHA-256 hash) | `a1b2c3d4e5f6...` |
| `x-cache-ttl` | TTL in seconds | `3600` |
| `x-cache-expires` | Expiration timestamp | `2024-01-01T12:00:00Z` |
| `x-cache-storage` | Storage backend | `s3` (for large files) |

### Standard Headers

Standard HTTP headers are passed through from the upstream API:

- `Content-Type`
- `Content-Length`
- `Last-Modified`
- `ETag`
- `Cache-Control`

## Error Responses

### 400 Bad Request

Invalid request parameters:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid TTL format",
  "message": "TTL must be in format like '30s', '1h', '7d'",
  "code": "INVALID_TTL"
}
```

### 404 Not Found

Upstream service not found:

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "Upstream service not found",
  "message": "Could not reach https://api.example.com/nonexistent",
  "code": "UPSTREAM_NOT_FOUND"
}
```

### 500 Internal Server Error

Unexpected server error:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Internal server error",
  "message": "An unexpected error occurred",
  "code": "INTERNAL_ERROR"
}
```

### 502 Bad Gateway

Upstream service error:

```http
HTTP/1.1 502 Bad Gateway
Content-Type: application/json

{
  "error": "Bad gateway",
  "message": "Upstream service returned an error",
  "code": "BAD_GATEWAY"
}
```

## Rate Limiting

### Hosted Version

- **Rate Limit**: 1000 requests/hour per IP
- **Headers**: Rate limit information in response headers
- **Status Code**: 429 when limit exceeded

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995200

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

### Self-Hosted

- **No Built-in Limits**: No rate limiting by default
- **AWS Limits**: API Gateway throttling may apply
- **Custom Throttling**: Can be configured with API Gateway

## CORS Support

### CORS Headers

Dejafoo includes CORS headers for cross-origin requests:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Upstream-URL
```

### Preflight Requests

OPTIONS requests are handled automatically:

```bash
curl -X OPTIONS "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"
```

## WebSocket Support

WebSocket connections are not currently supported. Only HTTP/HTTPS requests are supported.

## API Versioning

Currently, there is no API versioning. All endpoints use the latest version.

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class DejafooClient {
  constructor(baseUrl = 'https://myapp123.dejafoo.io') {
    this.baseUrl = baseUrl;
  }

  async get(url, options = {}) {
    const params = {
      url,
      ttl: options.ttl || '1h',
      method: options.method || 'GET'
    };

    if (options.headers) {
      params.headers = JSON.stringify(options.headers);
    }

    const response = await axios.get(this.baseUrl, { params });
    return response.data;
  }
}

// Usage
const client = new DejafooClient();
const data = await client.get('https://api.example.com/users', { ttl: '30m' });
```

### Python

```python
import requests
import json

class DejafooClient:
    def __init__(self, base_url='https://myapp123.dejafoo.io'):
        self.base_url = base_url

    def get(self, url, ttl='1h', method='GET', headers=None):
        params = {
            'url': url,
            'ttl': ttl,
            'method': method
        }
        
        if headers:
            params['headers'] = json.dumps(headers)

        response = requests.get(self.base_url, params=params)
        return response.json()

# Usage
client = DejafooClient()
data = client.get('https://api.example.com/users', ttl='30m')
```

### cURL

```bash
# Basic usage
curl "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h"

# With custom headers
curl -H "Authorization: Bearer token" \
  "https://myapp123.dejafoo.io?url=https://api.example.com/protected&ttl=30m"

# POST request
curl -X POST "https://myapp123.dejafoo.io?url=https://api.example.com/users&ttl=1h" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe"}'
```
