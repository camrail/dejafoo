# 🧪 Production Testing Guide

This document describes how to battle-test the dejafoo production service to ensure data isolation, proper caching, and no data leakage between different subdomains.

## 🚀 Quick Start

### Run Quick Tests
```bash
npm test
# or
node test-quick.js
```

### Run Full Battle Tests
```bash
npm run test:full
# or
node test-production.js
```

### Run Local Tests
```bash
npm run test:local
# or
node local-test.js
```

## 📋 Test Categories

### 1. **Quick Tests** (`test-quick.js`)
- Basic functionality verification
- Subdomain isolation
- Different URL handling
- POST request testing

### 2. **Full Battle Tests** (`test-production.js`)
- **Subdomain Isolation**: Ensures different subdomains don't leak data
- **Cache Isolation**: Verifies separate cache namespaces per subdomain
- **TTL Functionality**: Tests different time-to-live values
- **Header-based Caching**: Ensures different headers create separate cache entries
- **Method-based Caching**: Tests GET, POST, PUT, DELETE methods
- **Data Leakage Prevention**: Tests with sensitive data to prevent cross-contamination
- **Error Handling**: Tests with invalid URLs and error responses
- **Concurrent Requests**: Tests handling of multiple simultaneous requests
- **Cache Invalidation**: Verifies cache consistency

## 🔍 What We're Testing For

### ✅ **Data Isolation**
- Different subdomains should never see each other's data
- Same URL with different subdomains should create separate cache entries
- Headers should create different cache keys

### ✅ **Cache Behavior**
- Cache hits should return identical data
- Cache misses should fetch fresh data
- TTL should work correctly
- Cache keys should include headers, method, and body

### ✅ **Security**
- No data leakage between subdomains
- Sensitive data should be properly isolated
- Headers should be passed through correctly

### ✅ **Performance**
- Concurrent requests should be handled properly
- Caching should improve response times
- Error handling should be graceful

## 🛠️ Test Configuration

### Environment Variables
The tests use the production domain `dejafoo.io` by default. You can modify this in the test files:

```javascript
const BASE_DOMAIN = 'dejafoo.io'; // Change this for different environments
```

### Test Data Sources
- **JSON Placeholder**: `https://jsonplaceholder.typicode.com/` (reliable test data)
- **HTTPBin**: `https://httpbin.org/` (HTTP testing service)

### TTL Formats Supported
- `30s` - 30 seconds
- `1m` - 1 minute  
- `5m` - 5 minutes
- `1h` - 1 hour
- `2d` - 2 days

## 📊 Understanding Test Results

### ✅ **Pass Indicators**
- Status code 200
- Correct data returned
- No data leakage between subdomains
- Proper cache behavior

### ❌ **Fail Indicators**
- Status code errors (4xx, 5xx)
- Data mismatch between subdomains
- Cache inconsistencies
- SSL/connection errors

### ⚠️ **Expected Issues**
- `httpbin.org` sometimes returns 503 (service unavailable)
- Some upstream services may be temporarily down
- DNS propagation delays for new subdomains

## 🔧 Customizing Tests

### Adding New Test Cases
Edit `test-production.js` and add to the `TEST_CASES` array:

```javascript
const TEST_CASES = [
    {
        name: 'Your Test Name',
        url: 'https://your-test-api.com/endpoint',
        expectedData: 'fieldName',
        expectedValue: 'expectedValue'
    }
];
```

### Testing Different Domains
Modify the `BASE_DOMAIN` constant:

```javascript
const BASE_DOMAIN = 'your-domain.com';
```

### Adding Custom Headers
Modify the `HEADER_TESTS` array:

```javascript
const HEADER_TESTS = [
    { 'X-Custom-Header': 'value1' },
    { 'Authorization': 'Bearer token123' }
];
```

## 🚨 Troubleshooting

### Common Issues

1. **SSL Handshake Errors**
   - Check if the domain is properly configured
   - Verify SSL certificate is valid

2. **503 Service Unavailable**
   - Usually from upstream services (httpbin.org, etc.)
   - Not a problem with our service

3. **DNS Resolution Issues**
   - Check if subdomains are resolving correctly
   - May need to wait for DNS propagation

4. **Cache Issues**
   - Check DynamoDB table permissions
   - Verify S3 bucket access

### Debug Mode
Add logging to see detailed request/response data:

```javascript
console.log('Request:', { subdomain, targetUrl, headers });
console.log('Response:', { statusCode, body: response.body.substring(0, 200) });
```

## 📈 Performance Monitoring

The tests also measure:
- Response times
- Cache hit/miss ratios
- Error rates
- Concurrent request handling

## 🔒 Security Testing

The battle tests specifically check for:
- Data leakage between subdomains
- Proper header isolation
- Cache key uniqueness
- Sensitive data handling

## 📝 Test Reports

After running tests, you'll get a summary like:
```
📊 PRODUCTION BATTLE TEST SUMMARY
================================
Total Tests: 25
✅ Passed: 23
❌ Failed: 2
Success Rate: 92.0%
================================
```

## 🎯 Best Practices

1. **Run tests regularly** - Especially after deployments
2. **Test with real data** - Use actual API endpoints you'll proxy
3. **Monitor cache behavior** - Ensure TTL and invalidation work correctly
4. **Test edge cases** - Invalid URLs, malformed requests, etc.
5. **Verify isolation** - Always check that subdomains don't leak data

## 🚀 Continuous Integration

You can integrate these tests into your CI/CD pipeline:

```bash
# In your CI script
npm run test:full
if [ $? -ne 0 ]; then
    echo "Tests failed!"
    exit 1
fi
```

This ensures your production service is always battle-tested and secure!
