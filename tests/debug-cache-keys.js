#!/usr/bin/env node

const https = require('https');
const { URL } = require('url');

// Debug script to see what headers are affecting cache keys
const BASE_DOMAIN = 'dejafoo.io';

async function debugCacheKeys() {
    console.log('🔍 Debugging Cache Keys...\n');
    
    const subdomain = 'debug-test';
    const testUrl = 'https://jsonplaceholder.typicode.com/todos/1';
    const ttl = '1m';
    
    try {
        // Make 3 identical requests
        for (let i = 1; i <= 3; i++) {
            console.log(`\n--- Request ${i} ---`);
            
            const response = await makeRequest(subdomain, testUrl, ttl);
            
            console.log(`Status: ${response.statusCode}`);
            console.log(`Cache Key: ${response.headers['x-cache-key']}`);
            console.log(`Cache Status: ${response.headers['x-cache']}`);
            console.log(`Subdomain: ${response.headers['x-subdomain']}`);
            console.log(`Target URL: ${response.headers['x-target-url']}`);
            
            // Show all headers that might affect caching
            console.log('\nRelevant Headers:');
            const relevantHeaders = [
                'user-agent', 'accept', 'accept-encoding', 'accept-language',
                'cache-control', 'connection', 'host', 'x-forwarded-for',
                'x-forwarded-proto', 'x-amz-cf-id', 'cloudfront-viewer-country',
                'cloudfront-is-mobile-viewer', 'cloudfront-is-desktop-viewer',
                'via', 'x-amzn-trace-id'
            ];
            
            relevantHeaders.forEach(header => {
                const value = response.headers[header];
                if (value) {
                    console.log(`  ${header}: ${value}`);
                }
            });
        }
        
    } catch (error) {
        console.error('Debug failed:', error.message);
    }
}

async function makeRequest(subdomain, targetUrl, ttl) {
    return new Promise((resolve, reject) => {
        const url = new URL(`https://${subdomain}.${BASE_DOMAIN}`);
        url.searchParams.set('url', targetUrl);
        url.searchParams.set('ttl', ttl);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'User-Agent': 'DebugTester/1.0'
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
        req.end();
    });
}

// Run the debug
debugCacheKeys().catch(console.error);
