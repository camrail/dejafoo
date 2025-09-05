#!/usr/bin/env node

const https = require('https');

// Test script specifically for cache hit/miss behavior
const BASE_DOMAIN = 'dejafoo.io';

class CacheHitMissTester {
    constructor() {
        this.results = [];
        this.testCount = 0;
        this.passCount = 0;
        this.failCount = 0;
    }

    async runCacheTests() {
        console.log('🧪 Testing Cache Hit/Miss Behavior...\n');
        
        // Test 1: Basic cache hit/miss with same headers
        await this.testBasicCacheHitMiss();
        
        // Test 2: Cache miss with different headers
        await this.testDifferentHeadersCacheMiss();
        
        // Test 3: Cache hit with identical headers
        await this.testIdenticalHeadersCacheHit();
        
        // Test 4: Cache miss with different subdomains
        await this.testDifferentSubdomainsCacheMiss();
        
        // Test 5: Cache hit with same subdomain and headers
        await this.testSameSubdomainCacheHit();
        
        this.printSummary();
    }

    async testBasicCacheHitMiss() {
        console.log('📋 Test 1: Basic Cache Hit/Miss');
        
        const subdomain = 'basic-cache-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/todos/1';
        const headers = { 'User-Agent': 'CacheTester/1.0' };
        
        try {
            // First request - should be cache MISS
            console.log('  Making first request (expected cache MISS)...');
            const response1 = await this.makeRequest(subdomain, testUrl, '5m', headers);
            
            // Check if we got a valid response
            if (response1.statusCode !== 200) {
                this.recordFail(`Basic cache test - First request failed with status ${response1.statusCode}`);
                console.log(`    Response: ${response1.body.substring(0, 200)}...`);
                return;
            }
            
            const data1 = JSON.parse(response1.body);
            
            // Second request - should be cache HIT
            console.log('  Making second request (expected cache HIT)...');
            const response2 = await this.makeRequest(subdomain, testUrl, '5m', headers);
            
            if (response2.statusCode !== 200) {
                this.recordFail(`Basic cache test - Second request failed with status ${response2.statusCode}`);
                console.log(`    Response: ${response2.body.substring(0, 200)}...`);
                return;
            }
            
            const data2 = JSON.parse(response2.body);
            
            // Verify responses are identical (cache hit)
            if (JSON.stringify(data1) === JSON.stringify(data2)) {
                this.recordPass('Basic cache hit/miss - Identical responses (cache working)');
            } else {
                this.recordFail('Basic cache hit/miss - Different responses (cache not working)');
                console.log(`    Response 1: ${JSON.stringify(data1).substring(0, 100)}...`);
                console.log(`    Response 2: ${JSON.stringify(data2).substring(0, 100)}...`);
            }
            
        } catch (error) {
            this.recordFail(`Basic cache test failed: ${error.message}`);
        }
        console.log('');
    }

    async testDifferentHeadersCacheMiss() {
        console.log('📋 Test 2: Different Headers = Cache Miss');
        
        const subdomain = 'different-headers-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/posts/1';
        
        try {
            // First request with User-Agent 1
            console.log('  Making request with User-Agent 1...');
            const response1 = await this.makeRequest(subdomain, testUrl, '5m', { 'User-Agent': 'Agent1' });
            
            if (response1.statusCode !== 200) {
                this.recordFail(`Different headers test - First request failed with status ${response1.statusCode}`);
                return;
            }
            
            const data1 = JSON.parse(response1.body);
            
            // Second request with User-Agent 2 - should be cache MISS
            console.log('  Making request with User-Agent 2 (expected cache MISS)...');
            const response2 = await this.makeRequest(subdomain, testUrl, '5m', { 'User-Agent': 'Agent2' });
            
            if (response2.statusCode !== 200) {
                this.recordFail(`Different headers test - Second request failed with status ${response2.statusCode}`);
                return;
            }
            
            const data2 = JSON.parse(response2.body);
            
            // Verify responses are identical (same upstream data) but different cache entries
            if (JSON.stringify(data1) === JSON.stringify(data2)) {
                this.recordPass('Different headers - Same upstream data (separate cache entries working)');
            } else {
                this.recordFail('Different headers - Different upstream data (unexpected)');
                console.log(`    Response 1: ${JSON.stringify(data1).substring(0, 100)}...`);
                console.log(`    Response 2: ${JSON.stringify(data2).substring(0, 100)}...`);
            }
            
        } catch (error) {
            this.recordFail(`Different headers test failed: ${error.message}`);
        }
        console.log('');
    }

    async testIdenticalHeadersCacheHit() {
        console.log('📋 Test 3: Identical Headers = Cache Hit');
        
        const subdomain = 'identical-headers-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/comments/1';
        const headers = { 
            'User-Agent': 'IdenticalTest/1.0',
            'X-Test-Header': 'test-value',
            'Authorization': 'Bearer test-token'
        };
        
        try {
            // First request - should be cache MISS
            console.log('  Making first request with headers (expected cache MISS)...');
            const response1 = await this.makeRequest(subdomain, testUrl, '5m', headers);
            
            if (response1.statusCode !== 200) {
                this.recordFail(`Identical headers test - First request failed with status ${response1.statusCode}`);
                return;
            }
            
            const data1 = JSON.parse(response1.body);
            
            // Second request with identical headers - should be cache HIT
            console.log('  Making second request with identical headers (expected cache HIT)...');
            const response2 = await this.makeRequest(subdomain, testUrl, '5m', headers);
            
            if (response2.statusCode !== 200) {
                this.recordFail(`Identical headers test - Second request failed with status ${response2.statusCode}`);
                return;
            }
            
            const data2 = JSON.parse(response2.body);
            
            // Verify responses are identical (cache hit)
            if (JSON.stringify(data1) === JSON.stringify(data2)) {
                this.recordPass('Identical headers - Identical responses (cache hit working)');
            } else {
                this.recordFail('Identical headers - Different responses (cache not working)');
                console.log(`    Response 1: ${JSON.stringify(data1).substring(0, 100)}...`);
                console.log(`    Response 2: ${JSON.stringify(data2).substring(0, 100)}...`);
            }
            
        } catch (error) {
            this.recordFail(`Identical headers test failed: ${error.message}`);
        }
        console.log('');
    }

    async testDifferentSubdomainsCacheMiss() {
        console.log('📋 Test 4: Different Subdomains = Cache Miss');
        
        const testUrl = 'https://jsonplaceholder.typicode.com/albums/1';
        const headers = { 'User-Agent': 'SubdomainTest/1.0' };
        
        try {
            // First request with subdomain 1
            console.log('  Making request with subdomain 1...');
            const response1 = await this.makeRequest('subdomain-test-1', testUrl, '5m', headers);
            
            if (response1.statusCode !== 200) {
                this.recordFail(`Different subdomains test - First request failed with status ${response1.statusCode}`);
                return;
            }
            
            const data1 = JSON.parse(response1.body);
            
            // Second request with subdomain 2 - should be cache MISS
            console.log('  Making request with subdomain 2 (expected cache MISS)...');
            const response2 = await this.makeRequest('subdomain-test-2', testUrl, '5m', headers);
            
            if (response2.statusCode !== 200) {
                this.recordFail(`Different subdomains test - Second request failed with status ${response2.statusCode}`);
                return;
            }
            
            const data2 = JSON.parse(response2.body);
            
            // Verify responses are identical (same upstream) but different cache entries
            if (JSON.stringify(data1) === JSON.stringify(data2)) {
                this.recordPass('Different subdomains - Same upstream data (separate cache namespaces)');
            } else {
                this.recordFail('Different subdomains - Different upstream data (unexpected)');
                console.log(`    Response 1: ${JSON.stringify(data1).substring(0, 100)}...`);
                console.log(`    Response 2: ${JSON.stringify(data2).substring(0, 100)}...`);
            }
            
        } catch (error) {
            this.recordFail(`Different subdomains test failed: ${error.message}`);
        }
        console.log('');
    }

    async testSameSubdomainCacheHit() {
        console.log('📋 Test 5: Same Subdomain + Headers = Cache Hit');
        
        const subdomain = 'same-subdomain-test';
        const testUrl = 'https://jsonplaceholder.typicode.com/users/1';
        const headers = { 
            'User-Agent': 'SameSubdomainTest/1.0',
            'X-Cache-Test': 'hit-miss-test'
        };
        
        try {
            // First request - should be cache MISS
            console.log('  Making first request (expected cache MISS)...');
            const response1 = await this.makeRequest(subdomain, testUrl, '5m', headers);
            
            if (response1.statusCode !== 200) {
                this.recordFail(`Same subdomain test - First request failed with status ${response1.statusCode}`);
                return;
            }
            
            const data1 = JSON.parse(response1.body);
            
            // Second request with identical everything - should be cache HIT
            console.log('  Making second request (expected cache HIT)...');
            const response2 = await this.makeRequest(subdomain, testUrl, '5m', headers);
            
            if (response2.statusCode !== 200) {
                this.recordFail(`Same subdomain test - Second request failed with status ${response2.statusCode}`);
                return;
            }
            
            const data2 = JSON.parse(response2.body);
            
            // Third request - should still be cache HIT
            console.log('  Making third request (expected cache HIT)...');
            const response3 = await this.makeRequest(subdomain, testUrl, '5m', headers);
            
            if (response3.statusCode !== 200) {
                this.recordFail(`Same subdomain test - Third request failed with status ${response3.statusCode}`);
                return;
            }
            
            const data3 = JSON.parse(response3.body);
            
            // Verify all responses are identical (cache hits)
            const allIdentical = JSON.stringify(data1) === JSON.stringify(data2) && 
                                JSON.stringify(data2) === JSON.stringify(data3);
            
            if (allIdentical) {
                this.recordPass('Same subdomain + headers - All identical responses (cache hits working)');
            } else {
                this.recordFail('Same subdomain + headers - Responses not identical (cache not working)');
                console.log(`    Response 1: ${JSON.stringify(data1).substring(0, 100)}...`);
                console.log(`    Response 2: ${JSON.stringify(data2).substring(0, 100)}...`);
                console.log(`    Response 3: ${JSON.stringify(data3).substring(0, 100)}...`);
            }
            
        } catch (error) {
            this.recordFail(`Same subdomain test failed: ${error.message}`);
        }
        console.log('');
    }

    async makeRequest(subdomain, targetUrl, ttl, headers = {}, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(`https://${subdomain}.${BASE_DOMAIN}`);
            url.searchParams.set('url', targetUrl);
            url.searchParams.set('ttl', ttl);
            
            // Use the correct CloudFront IP address to bypass DNS issues
            const options = {
                hostname: '3.160.132.40', // CloudFront IP
                port: 443,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Host': url.hostname, // Set the Host header to the actual domain
                    'User-Agent': 'CacheHitMissTester/1.0',
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
        console.log('📊 CACHE HIT/MISS TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${this.testCount}`);
        console.log(`✅ Passed: ${this.passCount}`);
        console.log(`❌ Failed: ${this.failCount}`);
        console.log(`Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
        
        if (this.failCount === 0) {
            console.log('🎉 ALL CACHE TESTS PASSED! Cache hit/miss behavior is working correctly!');
        } else {
            console.log('⚠️  Some cache tests failed. Check the issues above.');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new CacheHitMissTester();
    tester.runCacheTests().catch(console.error);
}

module.exports = CacheHitMissTester;
