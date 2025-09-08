#!/usr/bin/env node

const https = require('https');
const { URL } = require('url');

// Test script specifically for TTL update functionality
const BASE_DOMAIN = 'dejafoo.io';

class TTLUpdateTester {
    constructor() {
        this.results = [];
        this.testCount = 0;
        this.passCount = 0;
        this.failCount = 0;
    }

    async runTTLUpdateTests() {
        console.log('🧪 Testing TTL Update Functionality...\n');
        
        // Test 1: Different TTLs create different cache entries
        await this.testDifferentTTLsCreateDifferentCacheEntries();
        
        // Test 2: Same TTL reuses existing cache entry
        await this.testSameTTLReusesCacheEntry();
        
        // Test 3: TTL update with different subdomains
        await this.testTTLUpdateWithDifferentSubdomains();
        
        // Test 4: TTL update with different headers
        await this.testTTLUpdateWithDifferentHeaders();
        
        // Test 5: TTL update with different HTTP methods
        await this.testTTLUpdateWithDifferentMethods();
        
        // Test 6: TTL update with different payloads
        await this.testTTLUpdateWithDifferentPayloads();
        
        // Test 7: Cache key verification
        await this.testCacheKeyVerification();
        
        this.printSummary();
    }

    async testDifferentTTLsCreateDifferentCacheEntries() {
        console.log('📋 Test 1: Different TTLs Create Different Cache Entries');
        
        const subdomain = 'ttl-different-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/todos/1';
        
        try {
            // First request with 5s TTL
            console.log('  Making request with 5s TTL...');
            const response1 = await this.makeRequest(subdomain, testUrl, '5s');
            
            if (response1.statusCode !== 200) {
                this.recordFail(`Different TTLs test - First request failed with status ${response1.statusCode}`);
                return;
            }
            
            const cacheKey1 = response1.headers['x-cache-key'];
            console.log(`    Cache key 1 (5s): ${cacheKey1}`);
            
            // Second request with 10s TTL - should create different cache entry
            console.log('  Making request with 10s TTL (expected different cache key)...');
            const response2 = await this.makeRequest(subdomain, testUrl, '10s');
            
            if (response2.statusCode !== 200) {
                this.recordFail(`Different TTLs test - Second request failed with status ${response2.statusCode}`);
                return;
            }
            
            const cacheKey2 = response2.headers['x-cache-key'];
            console.log(`    Cache key 2 (10s): ${cacheKey2}`);
            
            // Third request with 30s TTL - should create another different cache entry
            console.log('  Making request with 30s TTL (expected different cache key)...');
            const response3 = await this.makeRequest(subdomain, testUrl, '30s');
            
            if (response3.statusCode !== 200) {
                this.recordFail(`Different TTLs test - Third request failed with status ${response3.statusCode}`);
                return;
            }
            
            const cacheKey3 = response3.headers['x-cache-key'];
            console.log(`    Cache key 3 (30s): ${cacheKey3}`);
            
            // Verify all cache keys are different
            const allDifferent = cacheKey1 !== cacheKey2 && 
                                cacheKey2 !== cacheKey3 && 
                                cacheKey1 !== cacheKey3;
            
            if (allDifferent) {
                this.recordPass('Different TTLs - All cache keys are different (separate cache entries created)');
            } else {
                this.recordFail('Different TTLs - Some cache keys are identical (TTL not included in cache key)');
                console.log(`    Cache key 1: ${cacheKey1}`);
                console.log(`    Cache key 2: ${cacheKey2}`);
                console.log(`    Cache key 3: ${cacheKey3}`);
            }
            
        } catch (error) {
            this.recordFail(`Different TTLs test failed: ${error.message}`);
        }
        console.log('');
    }

    async testSameTTLReusesCacheEntry() {
        console.log('📋 Test 2: Same TTL Reuses Cache Entry');
        
        const subdomain = 'ttl-same-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/posts/1';
        const ttl = '1m';
        
        try {
            // First request with 1m TTL
            console.log('  Making first request with 1m TTL...');
            const response1 = await this.makeRequest(subdomain, testUrl, ttl);
            
            if (response1.statusCode !== 200) {
                this.recordFail(`Same TTL test - First request failed with status ${response1.statusCode}`);
                return;
            }
            
            const cacheKey1 = response1.headers['x-cache-key'];
            console.log(`    Cache key 1: ${cacheKey1}`);
            
            // Second request with same 1m TTL - should reuse cache entry
            console.log('  Making second request with same 1m TTL (expected same cache key)...');
            const response2 = await this.makeRequest(subdomain, testUrl, ttl);
            
            if (response2.statusCode !== 200) {
                this.recordFail(`Same TTL test - Second request failed with status ${response2.statusCode}`);
                return;
            }
            
            const cacheKey2 = response2.headers['x-cache-key'];
            console.log(`    Cache key 2: ${cacheKey2}`);
            
            // Third request with same 1m TTL - should still reuse cache entry
            console.log('  Making third request with same 1m TTL (expected same cache key)...');
            const response3 = await this.makeRequest(subdomain, testUrl, ttl);
            
            if (response3.statusCode !== 200) {
                this.recordFail(`Same TTL test - Third request failed with status ${response3.statusCode}`);
                return;
            }
            
            const cacheKey3 = response3.headers['x-cache-key'];
            console.log(`    Cache key 3: ${cacheKey3}`);
            
            // Verify all cache keys are identical
            const allSame = cacheKey1 === cacheKey2 && cacheKey2 === cacheKey3;
            
            if (allSame) {
                this.recordPass('Same TTL - All cache keys are identical (cache entry reused)');
            } else {
                this.recordFail('Same TTL - Cache keys are different (cache not being reused)');
                console.log(`    Cache key 1: ${cacheKey1}`);
                console.log(`    Cache key 2: ${cacheKey2}`);
                console.log(`    Cache key 3: ${cacheKey3}`);
            }
            
        } catch (error) {
            this.recordFail(`Same TTL test failed: ${error.message}`);
        }
        console.log('');
    }

    async testTTLUpdateWithDifferentSubdomains() {
        console.log('📋 Test 3: TTL Update with Different Subdomains');
        
        const testUrl = 'https://jsonplaceholder.typicode.com/comments/1';
        const ttl = '2m';
        
        try {
            // Test with different subdomains but same TTL
            const subdomains = ['ttl-subdomain-1', 'ttl-subdomain-2', 'ttl-subdomain-3'];
            const cacheKeys = [];
            
            for (let i = 0; i < subdomains.length; i++) {
                const subdomain = subdomains[i];
                console.log(`  Making request with subdomain ${subdomain} and TTL ${ttl}...`);
                
                const response = await this.makeRequest(subdomain, testUrl, ttl);
                
                if (response.statusCode !== 200) {
                    this.recordFail(`TTL subdomain test - Request ${i+1} failed with status ${response.statusCode}`);
                    return;
                }
                
                const cacheKey = response.headers['x-cache-key'];
                cacheKeys.push({ subdomain, cacheKey });
                console.log(`    Cache key for ${subdomain}: ${cacheKey}`);
            }
            
            // Verify all cache keys are different (different subdomains)
            const allDifferent = cacheKeys.every((item, i) => 
                cacheKeys.every((other, j) => i === j || item.cacheKey !== other.cacheKey)
            );
            
            if (allDifferent) {
                this.recordPass('TTL subdomain test - All cache keys are different (subdomain isolation working)');
            } else {
                this.recordFail('TTL subdomain test - Some cache keys are identical (subdomain isolation failed)');
            }
            
        } catch (error) {
            this.recordFail(`TTL subdomain test failed: ${error.message}`);
        }
        console.log('');
    }

    async testTTLUpdateWithDifferentHeaders() {
        console.log('📋 Test 4: TTL Update with Different Headers');
        
        const subdomain = 'ttl-headers-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/albums/1';
        const ttl = '3m';
        
        try {
            // Test with different headers but same TTL
            const headerSets = [
                { 'User-Agent': 'Agent1', 'X-Test': 'value1' },
                { 'User-Agent': 'Agent2', 'X-Test': 'value2' },
                { 'Authorization': 'Bearer token1' },
                { 'Authorization': 'Bearer token2' }
            ];
            
            const cacheKeys = [];
            
            for (let i = 0; i < headerSets.length; i++) {
                const headers = headerSets[i];
                console.log(`  Making request with headers ${JSON.stringify(headers)} and TTL ${ttl}...`);
                
                const response = await this.makeRequest(subdomain, testUrl, ttl, headers);
                
                if (response.statusCode !== 200) {
                    this.recordFail(`TTL headers test - Request ${i+1} failed with status ${response.statusCode}`);
                    return;
                }
                
                const cacheKey = response.headers['x-cache-key'];
                cacheKeys.push({ headers, cacheKey });
                console.log(`    Cache key: ${cacheKey}`);
            }
            
            // Verify all cache keys are different (different headers)
            const allDifferent = cacheKeys.every((item, i) => 
                cacheKeys.every((other, j) => i === j || item.cacheKey !== other.cacheKey)
            );
            
            if (allDifferent) {
                this.recordPass('TTL headers test - All cache keys are different (header-based caching working)');
            } else {
                this.recordFail('TTL headers test - Some cache keys are identical (header-based caching failed)');
            }
            
        } catch (error) {
            this.recordFail(`TTL headers test failed: ${error.message}`);
        }
        console.log('');
    }

    async testTTLUpdateWithDifferentMethods() {
        console.log('📋 Test 5: TTL Update with Different HTTP Methods');
        
        const subdomain = 'ttl-methods-test';
        const testUrl = 'https://httpbin.org/get';
        const ttl = '4m';
        
        try {
            // Test with different HTTP methods but same TTL
            const methods = ['GET', 'POST', 'PUT', 'DELETE'];
            const cacheKeys = [];
            
            for (let i = 0; i < methods.length; i++) {
                const method = methods[i];
                console.log(`  Making ${method} request with TTL ${ttl}...`);
                
                const response = await this.makeRequest(subdomain, testUrl, ttl, {}, method);
                
                if (response.statusCode !== 200) {
                    this.recordFail(`TTL methods test - ${method} request failed with status ${response.statusCode}`);
                    continue; // Continue with other methods
                }
                
                const cacheKey = response.headers['x-cache-key'];
                cacheKeys.push({ method, cacheKey });
                console.log(`    Cache key for ${method}: ${cacheKey}`);
            }
            
            // Verify all cache keys are different (different methods)
            const allDifferent = cacheKeys.every((item, i) => 
                cacheKeys.every((other, j) => i === j || item.cacheKey !== other.cacheKey)
            );
            
            if (allDifferent) {
                this.recordPass('TTL methods test - All cache keys are different (method-based caching working)');
            } else {
                this.recordFail('TTL methods test - Some cache keys are identical (method-based caching failed)');
            }
            
        } catch (error) {
            this.recordFail(`TTL methods test failed: ${error.message}`);
        }
        console.log('');
    }

    async testTTLUpdateWithDifferentPayloads() {
        console.log('📋 Test 6: TTL Update with Different Payloads');
        
        const subdomain = 'ttl-payloads-test';
        const testUrl = 'https://httpbin.org/post';
        const ttl = '5m';
        
        try {
            // Test with different payloads but same TTL
            const payloads = [
                JSON.stringify({ data: 'payload1' }),
                JSON.stringify({ data: 'payload2' }),
                JSON.stringify({ user: 'alice', id: 1 }),
                JSON.stringify({ user: 'bob', id: 2 })
            ];
            
            const cacheKeys = [];
            
            for (let i = 0; i < payloads.length; i++) {
                const payload = payloads[i];
                console.log(`  Making POST request with payload ${payload} and TTL ${ttl}...`);
                
                const response = await this.makeRequest(
                    subdomain, 
                    testUrl, 
                    ttl, 
                    { 'Content-Type': 'application/json' }, 
                    'POST', 
                    payload
                );
                
                if (response.statusCode !== 200) {
                    this.recordFail(`TTL payloads test - Request ${i+1} failed with status ${response.statusCode}`);
                    continue;
                }
                
                const cacheKey = response.headers['x-cache-key'];
                cacheKeys.push({ payload, cacheKey });
                console.log(`    Cache key: ${cacheKey}`);
            }
            
            // Verify all cache keys are different (different payloads)
            const allDifferent = cacheKeys.every((item, i) => 
                cacheKeys.every((other, j) => i === j || item.cacheKey !== other.cacheKey)
            );
            
            if (allDifferent) {
                this.recordPass('TTL payloads test - All cache keys are different (payload-based caching working)');
            } else {
                this.recordFail('TTL payloads test - Some cache keys are identical (payload-based caching failed)');
            }
            
        } catch (error) {
            this.recordFail(`TTL payloads test failed: ${error.message}`);
        }
        console.log('');
    }

    async testCacheKeyVerification() {
        console.log('📋 Test 7: Cache Key Verification');
        
        const subdomain = 'ttl-verification-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/users/1';
        
        try {
            // Test that cache keys are consistent for identical requests
            const ttl = '6m';
            const headers = { 'User-Agent': 'VerificationTest/1.0' };
            
            console.log('  Making multiple identical requests to verify cache key consistency...');
            
            const responses = [];
            for (let i = 0; i < 3; i++) {
                console.log(`    Request ${i+1}...`);
                const response = await this.makeRequest(subdomain, testUrl, ttl, headers);
                
                if (response.statusCode !== 200) {
                    this.recordFail(`Cache key verification - Request ${i+1} failed with status ${response.statusCode}`);
                    return;
                }
                
                responses.push({
                    cacheKey: response.headers['x-cache-key'],
                    subdomain: response.headers['x-subdomain'],
                    targetUrl: response.headers['x-target-url']
                });
            }
            
            // Verify all cache keys are identical
            const firstCacheKey = responses[0].cacheKey;
            const allSame = responses.every(r => r.cacheKey === firstCacheKey);
            
            if (allSame) {
                this.recordPass('Cache key verification - All identical requests have same cache key');
                console.log(`    Consistent cache key: ${firstCacheKey}`);
                console.log(`    Subdomain: ${responses[0].subdomain}`);
                console.log(`    Target URL: ${responses[0].targetUrl}`);
            } else {
                this.recordFail('Cache key verification - Identical requests have different cache keys');
                responses.forEach((r, i) => {
                    console.log(`    Request ${i+1} cache key: ${r.cacheKey}`);
                });
            }
            
        } catch (error) {
            this.recordFail(`Cache key verification test failed: ${error.message}`);
        }
        console.log('');
    }

    async makeRequest(subdomain, targetUrl, ttl, headers = {}, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(`https://${subdomain}.${BASE_DOMAIN}`);
            url.searchParams.set('url', targetUrl);
            url.searchParams.set('ttl', ttl);
            
            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'User-Agent': 'TTLUpdateTester/1.0',
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
        console.log('📊 TTL UPDATE TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${this.testCount}`);
        console.log(`✅ Passed: ${this.passCount}`);
        console.log(`❌ Failed: ${this.failCount}`);
        console.log(`Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
        
        if (this.failCount === 0) {
            console.log('🎉 ALL TTL UPDATE TESTS PASSED! TTL update functionality is working correctly!');
        } else {
            console.log('⚠️  Some TTL update tests failed. Check the issues above.');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new TTLUpdateTester();
    tester.runTTLUpdateTests().catch(console.error);
}

module.exports = TTLUpdateTester;
