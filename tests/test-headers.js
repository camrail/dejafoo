#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Test script specifically for header-based response differences
const BASE_DOMAIN = 'dejafoo.io';

class HeaderTester {
    constructor() {
        this.results = [];
        this.testCount = 0;
        this.passCount = 0;
        this.failCount = 0;
    }

    async runHeaderTests() {
        console.log('🧪 Testing Header-Based Response Differences...\n');
        
        // Test 1: User-Agent based responses
        await this.testUserAgentHeaders();
        
        // Test 2: Authorization headers
        await this.testAuthorizationHeaders();
        
        // Test 3: Custom headers
        await this.testCustomHeaders();
        
        // Test 4: Content-Type headers
        await this.testContentTypeHeaders();
        
        // Test 5: Accept headers
        await this.testAcceptHeaders();
        
        this.printSummary();
    }

    async testUserAgentHeaders() {
        console.log('📋 Test 1: User-Agent Header Differences');
        
        const subdomain = 'useragent-test';
        const testUrl = 'https://httpbin.org/user-agent';
        
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'curl/7.68.0',
            'PostmanRuntime/7.26.8',
            'CustomBot/1.0'
        ];
        
        const responses = [];
        
        for (const userAgent of userAgents) {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '1m', {
                    'User-Agent': userAgent
                });
                
                const data = JSON.parse(response.body);
                responses.push({ userAgent, response: data });
                
                console.log(`✅ User-Agent: ${userAgent.substring(0, 30)}... - Status: ${response.statusCode}`);
            } catch (error) {
                console.log(`❌ User-Agent: ${userAgent.substring(0, 30)}... - Error: ${error.message}`);
                this.recordFail(`User-Agent test failed for ${userAgent}`);
            }
        }
        
        // Verify all responses are different
        this.verifyDifferentResponses(responses, 'User-Agent');
        console.log('');
    }

    async testAuthorizationHeaders() {
        console.log('📋 Test 2: Authorization Header Differences');
        
        const subdomain = 'auth-test';
        const testUrl = 'https://httpbin.org/headers';
        
        const authHeaders = [
            { 'Authorization': 'Bearer token1' },
            { 'Authorization': 'Bearer token2' },
            { 'Authorization': 'Basic dXNlcjpwYXNz' },
            { 'X-API-Key': 'key123' },
            { 'X-API-Key': 'key456' }
        ];
        
        const responses = [];
        
        for (const headers of authHeaders) {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '1m', headers);
                const data = JSON.parse(response.body);
                responses.push({ headers, response: data });
                
                console.log(`✅ Headers: ${JSON.stringify(headers)} - Status: ${response.statusCode}`);
            } catch (error) {
                console.log(`❌ Headers: ${JSON.stringify(headers)} - Error: ${error.message}`);
                this.recordFail(`Authorization test failed for ${JSON.stringify(headers)}`);
            }
        }
        
        // Verify all responses are different
        this.verifyDifferentResponses(responses, 'Authorization');
        console.log('');
    }

    async testCustomHeaders() {
        console.log('📋 Test 3: Custom Header Differences');
        
        const subdomain = 'custom-test';
        const testUrl = 'https://httpbin.org/headers';
        
        const customHeaders = [
            { 'X-Client-ID': 'client1' },
            { 'X-Client-ID': 'client2' },
            { 'X-Request-ID': 'req123' },
            { 'X-Request-ID': 'req456' },
            { 'X-Tenant-ID': 'tenant1' },
            { 'X-Tenant-ID': 'tenant2' }
        ];
        
        const responses = [];
        
        for (const headers of customHeaders) {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '1m', headers);
                const data = JSON.parse(response.body);
                responses.push({ headers, response: data });
                
                console.log(`✅ Headers: ${JSON.stringify(headers)} - Status: ${response.statusCode}`);
            } catch (error) {
                console.log(`❌ Headers: ${JSON.stringify(headers)} - Error: ${error.message}`);
                this.recordFail(`Custom header test failed for ${JSON.stringify(headers)}`);
            }
        }
        
        // Verify all responses are different
        this.verifyDifferentResponses(responses, 'Custom Headers');
        console.log('');
    }

    async testContentTypeHeaders() {
        console.log('📋 Test 4: Content-Type Header Differences');
        
        const subdomain = 'content-type-test';
        const testUrl = 'https://httpbin.org/headers';
        
        const contentTypes = [
            { 'Content-Type': 'application/json' },
            { 'Content-Type': 'application/xml' },
            { 'Content-Type': 'text/plain' },
            { 'Content-Type': 'application/x-www-form-urlencoded' },
            { 'Accept': 'application/json' },
            { 'Accept': 'application/xml' }
        ];
        
        const responses = [];
        
        for (const headers of contentTypes) {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '1m', headers);
                const data = JSON.parse(response.body);
                responses.push({ headers, response: data });
                
                console.log(`✅ Headers: ${JSON.stringify(headers)} - Status: ${response.statusCode}`);
            } catch (error) {
                console.log(`❌ Headers: ${JSON.stringify(headers)} - Error: ${error.message}`);
                this.recordFail(`Content-Type test failed for ${JSON.stringify(headers)}`);
            }
        }
        
        // Verify all responses are different
        this.verifyDifferentResponses(responses, 'Content-Type');
        console.log('');
    }

    async testAcceptHeaders() {
        console.log('📋 Test 5: Accept Header Differences');
        
        const subdomain = 'accept-test';
        const testUrl = 'https://httpbin.org/headers';
        
        const acceptHeaders = [
            { 'Accept': 'application/json' },
            { 'Accept': 'application/xml' },
            { 'Accept': 'text/plain' },
            { 'Accept': 'application/json, text/plain, */*' },
            { 'Accept': 'application/xml, application/json' }
        ];
        
        const responses = [];
        
        for (const headers of acceptHeaders) {
            try {
                const response = await this.makeRequest(subdomain, testUrl, '1m', headers);
                const data = JSON.parse(response.body);
                responses.push({ headers, response: data });
                
                console.log(`✅ Headers: ${JSON.stringify(headers)} - Status: ${response.statusCode}`);
            } catch (error) {
                console.log(`❌ Headers: ${JSON.stringify(headers)} - Error: ${error.message}`);
                this.recordFail(`Accept header test failed for ${JSON.stringify(headers)}`);
            }
        }
        
        // Verify all responses are different
        this.verifyDifferentResponses(responses, 'Accept');
        console.log('');
    }

    verifyDifferentResponses(responses, testType) {
        if (responses.length < 2) {
            this.recordFail(`${testType} test - Not enough responses to compare`);
            return;
        }

        // Check that all responses are different
        let allDifferent = true;
        for (let i = 0; i < responses.length; i++) {
            for (let j = i + 1; j < responses.length; j++) {
                const response1 = responses[i].response;
                const response2 = responses[j].response;
                
                if (JSON.stringify(response1) === JSON.stringify(response2)) {
                    console.log(`⚠️  WARNING: Identical responses detected:`);
                    console.log(`   Headers 1: ${JSON.stringify(responses[i].headers)}`);
                    console.log(`   Headers 2: ${JSON.stringify(responses[j].headers)}`);
                    console.log(`   Response: ${JSON.stringify(response1).substring(0, 100)}...`);
                    allDifferent = false;
                }
            }
        }

        if (allDifferent) {
            this.recordPass(`${testType} test - All responses are different (${responses.length} responses)`);
        } else {
            this.recordFail(`${testType} test - Some responses are identical`);
        }
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
                    'User-Agent': 'HeaderTester/1.0',
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
        console.log('📊 HEADER-BASED RESPONSE TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${this.testCount}`);
        console.log(`✅ Passed: ${this.passCount}`);
        console.log(`❌ Failed: ${this.failCount}`);
        console.log(`Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));
        
        if (this.failCount === 0) {
            console.log('🎉 ALL HEADER TESTS PASSED! Different headers produce different responses!');
        } else {
            console.log('⚠️  Some header tests failed. Check the warnings above.');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new HeaderTester();
    tester.runHeaderTests().catch(console.error);
}

module.exports = HeaderTester;
