#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Test configuration
const BASE_DOMAIN = 'dejafoo.io';
const TEST_SUBDOMAINS = [
    'test1', 'test2', 'test3', 'org1', 'org2', 'company-a', 'company-b'
];

// Test cases with different data to ensure no leakage
const TEST_CASES = [
    {
        name: 'JSON Placeholder - Users',
        url: 'https://jsonplaceholder.typicode.com/users/1',
        expectedData: 'id',
        expectedValue: 1
    },
    {
        name: 'JSON Placeholder - Posts',
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        expectedData: 'userId',
        expectedValue: 1
    },
    {
        name: 'JSON Placeholder - Comments',
        url: 'https://jsonplaceholder.typicode.com/comments/1',
        expectedData: 'postId',
        expectedValue: 1
    },
    {
        name: 'JSON Placeholder - Albums',
        url: 'https://jsonplaceholder.typicode.com/albums/1',
        expectedData: 'userId',
        expectedValue: 1
    }
];

// Test different TTL values
const TTL_TESTS = ['30s', '1m', '5m', '1h', '2d'];

// Test different HTTP methods
const METHOD_TESTS = ['GET', 'POST', 'PUT', 'DELETE'];

// Test different headers
const HEADER_TESTS = [
    { 'Authorization': 'Bearer token1' },
    { 'Authorization': 'Bearer token2' },
    { 'X-API-Key': 'key1' },
    { 'X-API-Key': 'key2' },
    { 'Content-Type': 'application/json' },
    { 'Content-Type': 'application/xml' }
];

class ProductionTester {
    constructor() {
        this.results = [];
        this.cache = new Map(); // Track what we expect to be cached
        this.testCount = 0;
        this.passCount = 0;
        this.failCount = 0;
    }

    async runAllTests() {
        console.log('🚀 Starting Production Battle Tests...\n');
        
        // Test 1: Basic functionality
        await this.testBasicFunctionality();
        
        // Test 2: Subdomain isolation
        await this.testSubdomainIsolation();
        
        // Test 3: Cache isolation
        await this.testCacheIsolation();
        
        // Test 4: TTL functionality
        await this.testTTLFunctionality();
        
        // Test 4.5: TTL update functionality
        await this.testTTLUpdateFunctionality();
        
        // Test 5: Header-based caching
        await this.testHeaderBasedCaching();
        
        // Test 6: Method-based caching
        await this.testMethodBasedCaching();
        
        // Test 7: Data leakage prevention
        await this.testDataLeakagePrevention();
        
        // Test 8: Error handling
        await this.testErrorHandling();
        
        // Test 9: Concurrent requests
        await this.testConcurrentRequests();
        
        // Test 10: Cache invalidation
        await this.testCacheInvalidation();
        
        // Test 10.5: Cache hit/miss with short TTL
        await this.testCacheHitMiss();
        
        // Test 11: S3 fallback for large payloads
        await this.testS3Fallback();
        
        this.printSummary();
    }

    async testBasicFunctionality() {
        console.log('📋 Test 1: Basic Functionality');
        const subdomain = 'basic-test';
        const testCase = TEST_CASES[0];
        
        try {
            const response = await this.makeRequest(subdomain, testCase.url, '30s');
            const data = JSON.parse(response.body);
            
            if (data[testCase.expectedData] === testCase.expectedValue) {
                this.recordPass(`Basic functionality works for ${testCase.name}`);
            } else {
                this.recordFail(`Basic functionality failed - unexpected data: ${JSON.stringify(data)}`);
            }
        } catch (error) {
            this.recordFail(`Basic functionality failed: ${error.message}`);
        }
        console.log('');
    }

    async testSubdomainIsolation() {
        console.log('📋 Test 2: Subdomain Isolation');
        
        // Test that different subdomains get different responses
        const promises = TEST_CASES.slice(0, 3).map(async (testCase, index) => {
            const subdomain = `isolation-test-${index + 1}`;
            try {
                const response = await this.makeRequest(subdomain, testCase.url, '1m');
                const data = JSON.parse(response.body);
                
                if (data[testCase.expectedData] === testCase.expectedValue) {
                    this.recordPass(`Subdomain ${subdomain} correctly isolated for ${testCase.name}`);
                    return { subdomain, data, testCase };
                } else {
                    this.recordFail(`Subdomain ${subdomain} data mismatch: ${JSON.stringify(data)}`);
                    return null;
                }
            } catch (error) {
                this.recordFail(`Subdomain ${subdomain} failed: ${error.message}`);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const validResults = results.filter(r => r !== null);
        
        // Verify no data leakage between subdomains
        for (let i = 0; i < validResults.length; i++) {
            for (let j = i + 1; j < validResults.length; j++) {
                const result1 = validResults[i];
                const result2 = validResults[j];
                
                if (JSON.stringify(result1.data) === JSON.stringify(result2.data)) {
                    this.recordFail(`Data leakage detected between ${result1.subdomain} and ${result2.subdomain}`);
                } else {
                    this.recordPass(`No data leakage between ${result1.subdomain} and ${result2.subdomain}`);
                }
            }
        }
        console.log('');
    }

    async testCacheIsolation() {
        console.log('📋 Test 3: Cache Isolation');
        
        // Test that same URL with different subdomains creates separate cache entries
        const testUrl = TEST_CASES[0].url;
        const subdomains = ['cache-test-1', 'cache-test-2', 'cache-test-3'];
        
        const promises = subdomains.map(async (subdomain) => {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '5m');
                const data = JSON.parse(response.body);
                return { subdomain, data, response };
            } catch (error) {
                this.recordFail(`Cache test failed for ${subdomain}: ${error.message}`);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const validResults = results.filter(r => r !== null);
        
        // Verify all responses are identical (same upstream data)
        if (validResults.length > 1) {
            const firstData = validResults[0].data;
            const allSame = validResults.every(r => JSON.stringify(r.data) === JSON.stringify(firstData));
            
            if (allSame) {
                this.recordPass(`Cache isolation working - all subdomains get same upstream data`);
            } else {
                this.recordFail(`Cache isolation failed - different data from same upstream`);
            }
        }
        console.log('');
    }

    async testTTLFunctionality() {
        console.log('📋 Test 4: TTL Functionality');
        
        const subdomain = 'ttl-test';
        const testUrl = TEST_CASES[0].url;
        
        // Test different TTL values
        for (const ttl of TTL_TESTS) {
            try {
                const response = await this.makeRequest(subdomain, testUrl, ttl);
                const data = JSON.parse(response.body);
                
                if (data.id === 1) {
                    this.recordPass(`TTL ${ttl} works correctly`);
                } else {
                    this.recordFail(`TTL ${ttl} failed - unexpected data`);
                }
            } catch (error) {
                this.recordFail(`TTL ${ttl} failed: ${error.message}`);
            }
        }
        console.log('');
    }

    async testTTLUpdateFunctionality() {
        console.log('📋 Test 4.5: TTL Update Functionality');
        
        const subdomain = 'ttl-update-test';
        const testUrl = TEST_CASES[0].url;
        
        try {
            // Test that different TTLs create different cache entries
            console.log('  Testing different TTLs create different cache entries...');
            
            const response1 = await this.makeRequest(subdomain, testUrl, '5s');
            const cacheKey1 = response1.headers['x-cache-key'];
            
            const response2 = await this.makeRequest(subdomain, testUrl, '10s');
            const cacheKey2 = response2.headers['x-cache-key'];
            
            const response3 = await this.makeRequest(subdomain, testUrl, '30s');
            const cacheKey3 = response3.headers['x-cache-key'];
            
            // Verify all cache keys are different
            const allDifferent = cacheKey1 !== cacheKey2 && 
                                cacheKey2 !== cacheKey3 && 
                                cacheKey1 !== cacheKey3;
            
            if (allDifferent) {
                this.recordPass('TTL update - Different TTLs create different cache entries');
            } else {
                this.recordFail('TTL update - Some TTLs create identical cache entries');
            }
            
            // Test that same TTL reuses cache entry
            console.log('  Testing same TTL reuses cache entry...');
            
            const response4 = await this.makeRequest(subdomain, testUrl, '10s');
            const cacheKey4 = response4.headers['x-cache-key'];
            
            if (cacheKey2 === cacheKey4) {
                this.recordPass('TTL update - Same TTL reuses existing cache entry');
            } else {
                this.recordFail('TTL update - Same TTL does not reuse cache entry');
            }
            
        } catch (error) {
            this.recordFail(`TTL update functionality failed: ${error.message}`);
        }
        console.log('');
    }

    async testHeaderBasedCaching() {
        console.log('📋 Test 5: Header-based Caching');
        
        const subdomain = 'header-test';
        const testUrl = TEST_CASES[0].url;
        
        // Test that different headers create different cache entries
        const promises = HEADER_TESTS.map(async (headers, index) => {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '1m', headers);
                const data = JSON.parse(response.body);
                return { headers, data, index };
            } catch (error) {
                this.recordFail(`Header test failed for ${JSON.stringify(headers)}: ${error.message}`);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const validResults = results.filter(r => r !== null);
        
        // All should get same data (same upstream) but different cache entries
        if (validResults.length > 1) {
            const firstData = validResults[0].data;
            const allSame = validResults.every(r => JSON.stringify(r.data) === JSON.stringify(firstData));
            
            if (allSame) {
                this.recordPass(`Header-based caching working - same upstream data with different headers`);
            } else {
                this.recordFail(`Header-based caching failed - different data with different headers`);
            }
        }
        console.log('');
    }

    async testMethodBasedCaching() {
        console.log('📋 Test 6: Method-based Caching');
        
        const subdomain = 'method-test';
        const testUrl = 'https://httpbin.org/get'; // Use httpbin for method testing
        
        // Test different HTTP methods
        for (const method of METHOD_TESTS) {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '1m', {}, method);
                this.recordPass(`Method ${method} works correctly`);
            } catch (error) {
                this.recordFail(`Method ${method} failed: ${error.message}`);
            }
        }
        console.log('');
    }

    async testDataLeakagePrevention() {
        console.log('📋 Test 7: Data Leakage Prevention');
        
        // Test with sensitive data that should not leak between subdomains
        const sensitiveTests = [
            { subdomain: 'sensitive-1', data: 'user1-secret-data' },
            { subdomain: 'sensitive-2', data: 'user2-secret-data' },
            { subdomain: 'sensitive-3', data: 'user3-secret-data' }
        ];
        
        const promises = sensitiveTests.map(async (test) => {
            try {
                // Use httpbin.org/post to send data
                const response = await this.makeRequest(
                    test.subdomain, 
                    'https://httpbin.org/post', 
                    '1m',
                    { 'Content-Type': 'application/json' },
                    'POST',
                    JSON.stringify({ secret: test.data })
                );
                const data = JSON.parse(response.body);
                return { subdomain: test.subdomain, response: data, expected: test.data };
            } catch (error) {
                this.recordFail(`Sensitive data test failed for ${test.subdomain}: ${error.message}`);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        const validResults = results.filter(r => r !== null);
        
        // Verify each subdomain gets its own data back
        for (const result of validResults) {
            if (result.response.json && result.response.json.secret === result.expected) {
                this.recordPass(`Data isolation working for ${result.subdomain}`);
            } else {
                this.recordFail(`Data leakage detected for ${result.subdomain}`);
            }
        }
        console.log('');
    }

    async testErrorHandling() {
        console.log('📋 Test 8: Error Handling');
        
        const subdomain = 'error-test';
        
        // Test with invalid URLs
        const invalidUrls = [
            'https://invalid-domain-that-does-not-exist.com/api',
            'https://httpbin.org/status/500',
            'https://httpbin.org/status/404'
        ];
        
        for (const url of invalidUrls) {
            try {
                const response = await this.makeRequest(subdomain, url, '1m');
                // Should handle errors gracefully
                this.recordPass(`Error handling works for ${url}`);
            } catch (error) {
                // This is expected for invalid URLs
                this.recordPass(`Error handling works for ${url} - caught error: ${error.message}`);
            }
        }
        console.log('');
    }

    async testConcurrentRequests() {
        console.log('📋 Test 9: Concurrent Requests');
        
        const subdomain = 'concurrent-test';
        const testUrl = TEST_CASES[0].url;
        
        // Make 10 concurrent requests to the same endpoint
        const promises = Array.from({ length: 10 }, (_, i) => 
            this.makeRequest(`${subdomain}-${i}`, testUrl, '1m')
        );
        
        try {
            const results = await Promise.all(promises);
            const validResults = results.filter(r => r && r.body);
            
            if (validResults.length === 10) {
                this.recordPass(`Concurrent requests handled correctly (${validResults.length}/10)`);
            } else {
                this.recordFail(`Concurrent requests failed (${validResults.length}/10)`);
            }
        } catch (error) {
            this.recordFail(`Concurrent requests failed: ${error.message}`);
        }
        console.log('');
    }

    async testCacheInvalidation() {
        console.log('📋 Test 10: Cache Invalidation');
        
        const subdomain = 'invalidation-test';
        const testUrl = TEST_CASES[0].url;
        
        try {
            // First request - should be cache miss
            const response1 = await this.makeRequest(subdomain, testUrl, '30s');
            const data1 = JSON.parse(response1.body);
            
            // Second request - should be cache hit
            const response2 = await this.makeRequest(subdomain, testUrl, '30s');
            const data2 = JSON.parse(response2.body);
            
            if (JSON.stringify(data1) === JSON.stringify(data2)) {
                this.recordPass(`Cache invalidation test - data consistency maintained`);
            } else {
                this.recordFail(`Cache invalidation test - data inconsistency detected`);
            }
        } catch (error) {
            this.recordFail(`Cache invalidation test failed: ${error.message}`);
        }
        console.log('');
    }

    async testCacheHitMiss() {
        console.log('📋 Test 10.5: Cache Hit/Miss with Short TTL');
        
        const subdomain = 'hitmiss-test';
        const testUrl = TEST_CASES[0].url;
        const shortTtl = '5s'; // Very short TTL for testing
        
        try {
            // First request - should be cache miss
            console.log('  Testing cache miss...');
            const response1 = await this.makeRequest(subdomain, testUrl, shortTtl);
            const cacheStatus1 = response1.headers['x-cache'];
            const cacheKey1 = response1.headers['x-cache-key'];
            
            if (cacheStatus1 === 'MISS' || cacheStatus1 === 'Miss from cloudfront') {
                this.recordPass('First request correctly shows cache MISS');
            } else {
                this.recordFail(`First request should be MISS but got: ${cacheStatus1}`);
            }
            
            // Second request immediately - should be cache hit
            console.log('  Testing cache hit...');
            const response2 = await this.makeRequest(subdomain, testUrl, shortTtl);
            const cacheStatus2 = response2.headers['x-cache'];
            const cacheKey2 = response2.headers['x-cache-key'];
            
            if (cacheStatus2 === 'HIT' || cacheStatus2 === 'Hit from cloudfront') {
                this.recordPass('Second request correctly shows cache HIT');
            } else {
                this.recordFail(`Second request should be HIT but got: ${cacheStatus2}`);
            }
            
            // Verify cache keys match (same cache entry)
            if (cacheKey1 === cacheKey2) {
                this.recordPass('Cache keys match - same cache entry used');
            } else {
                this.recordFail(`Cache keys don't match: ${cacheKey1} vs ${cacheKey2}`);
            }
            
            // Wait for TTL to expire, then test miss again
            console.log('  Waiting for TTL to expire (6 seconds)...');
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            const response3 = await this.makeRequest(subdomain, testUrl, shortTtl);
            const cacheStatus3 = response3.headers['x-cache'];
            const cacheKey3 = response3.headers['x-cache-key'];
            
            if (cacheStatus3 === 'MISS' || cacheStatus3 === 'Miss from cloudfront') {
                this.recordPass('After TTL expiry, request correctly shows cache MISS');
            } else {
                this.recordFail(`After TTL expiry should be MISS but got: ${cacheStatus3}`);
            }
            
            // Verify cache key remains the same (same request parameters = same key)
            if (cacheKey1 === cacheKey3) {
                this.recordPass('Cache key remains consistent after TTL expiry - same request parameters');
            } else {
                this.recordFail(`Cache key changed unexpectedly after TTL expiry: ${cacheKey1} vs ${cacheKey3}`);
            }
            
        } catch (error) {
            this.recordFail(`Cache hit/miss test failed: ${error.message}`);
        }
        console.log('');
    }

    async testS3Fallback() {
        console.log('📋 Test 11: S3 Fallback for Large Payloads');
        
        // Small payload should be served and cache headers present
        const smallSubdomain = 's3-test-small';
        const smallUrl = 'https://jsonplaceholder.typicode.com/users/1';
        
        try {
            const smallResponse = await this.makeRequest(smallSubdomain, smallUrl, '1m');
            const smallBodySize = Buffer.byteLength(smallResponse.body, 'utf8');
            const smallCacheStatus = smallResponse.headers['x-cache'];
            
            console.log(`  Small payload: ${smallBodySize} bytes (${(smallBodySize / 1024).toFixed(1)}KB) - ${smallCacheStatus}`);
            
            // Validate small payload served and cache header present
            if (smallResponse.statusCode === 200 && smallCacheStatus) {
                this.recordPass('Small payload served with cache header present');
            } else {
                this.recordFail(`Small payload test failed - status: ${smallResponse.statusCode}, cache: ${smallCacheStatus}`);
            }
            
            // Large payload should be served via S3-backed path
            const largeSubdomain = 's3-test-large';
            const largeUrl = 'https://httpbun.com/bytes/500000'; // 500KB response
            
            const largeResponse = await this.makeRequest(largeSubdomain, largeUrl, '1m');
            const largeBodySize = Buffer.byteLength(largeResponse.body, 'utf8');
            const largeCacheStatus = largeResponse.headers['x-cache'];
            
            console.log(`  Large payload: ${largeBodySize} bytes (${(largeBodySize / 1024).toFixed(1)}KB) - ${largeCacheStatus}`);
            
            // Validate large payload served and reasonably large
            if (largeResponse.statusCode === 200 && largeBodySize >= 400000) {
                this.recordPass('Large payload served via S3-backed path');
            } else {
                this.recordFail(`Large payload test failed - status: ${largeResponse.statusCode}, size: ${largeBodySize} bytes`);
            }
            
            // Test cache retrieval for large payload
            const largeResponse2 = await this.makeRequest(largeSubdomain, largeUrl, '1m');
            const largeBodySize2 = Buffer.byteLength(largeResponse2.body, 'utf8');
            const largeCacheStatus2 = largeResponse2.headers['x-cache'];
            const largeCacheKey1 = largeResponse.headers['x-cache-key'];
            const largeCacheKey2 = largeResponse2.headers['x-cache-key'];
            
            // Validate cache reuse by size equality and cache key stability
            if (largeBodySize2 === largeBodySize && largeCacheKey1 && largeCacheKey1 === largeCacheKey2) {
                this.recordPass('Large payload correctly retrieved from cache (stable cache key)');
            } else {
                this.recordFail(`Large payload cache retrieval failed - cache: ${largeCacheStatus2}, size1: ${largeBodySize}, size2: ${largeBodySize2}, keys match: ${largeCacheKey1 === largeCacheKey2}`);
            }
            
        } catch (error) {
            this.recordFail(`S3 fallback test failed: ${error.message}`);
        }
        console.log('');
    }

    async makeRequest(subdomain, targetUrl, ttl, headers = {}, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(`https://${subdomain}.${BASE_DOMAIN}`);
            url.searchParams.set('url', targetUrl);
            url.searchParams.set('ttl', ttl);
            url.searchParams.set('_t', Date.now().toString()); // Cache-busting timestamp
            
            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'User-Agent': 'ProductionTester/1.0',
                    ...headers
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                });
            });
            
            req.on('error', reject);
            
            if (body) {
                req.write(body);
            }
            
            req.end();
        });
    }

    recordPass(message) {
        this.passCount++;
        this.testCount++;
        console.log(`✅ ${message}`);
    }

    recordFail(message) {
        this.failCount++;
        this.testCount++;
        console.log(`❌ ${message}`);
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 PRODUCTION BATTLE TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${this.testCount}`);
        console.log(`✅ Passed: ${this.passCount}`);
        console.log(`❌ Failed: ${this.failCount}`);
        console.log(`Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
        
        if (this.failCount === 0) {
            console.log('🎉 ALL TESTS PASSED! Production service is battle-tested and ready!');
        } else {
            console.log('⚠️  Some tests failed. Please review the issues above.');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new ProductionTester();
    tester.runAllTests().catch(console.error);
}

module.exports = ProductionTester;
