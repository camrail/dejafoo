#!/usr/bin/env node

const https = require('https');

// Quick test script for basic functionality
const BASE_DOMAIN = 'dejafoo.io';

async function quickTest() {
    console.log('🚀 Quick Production Test...\n');
    
    const tests = [
        {
            name: 'Basic JSON Placeholder',
            subdomain: 'quick-test-1',
            url: 'https://jsonplaceholder.typicode.com/todos/1',
            ttl: '30s'
        },
        {
            name: 'Different subdomain, same URL',
            subdomain: 'quick-test-2', 
            url: 'https://jsonplaceholder.typicode.com/todos/1',
            ttl: '30s'
        },
        {
            name: 'Different URL, same subdomain',
            subdomain: 'quick-test-1',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            ttl: '30s'
        },
        {
            name: 'POST request with headers',
            subdomain: 'quick-test-3',
            url: 'https://httpbin.org/post',
            ttl: '1m',
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token' },
            body: JSON.stringify({ test: 'data' })
        }
    ];
    
    let passCount = 0;
    let failCount = 0;
    
    for (const test of tests) {
        try {
            console.log(`Testing: ${test.name}...`);
            const response = await makeRequest(test);
            
            if (response.statusCode === 200) {
                console.log(`✅ ${test.name} - Status: ${response.statusCode}`);
                passCount++;
            } else {
                console.log(`❌ ${test.name} - Status: ${response.statusCode}`);
                failCount++;
            }
        } catch (error) {
            console.log(`❌ ${test.name} - Error: ${error.message}`);
            failCount++;
        }
    }
    
    console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`);
}

function makeRequest(test) {
    return new Promise((resolve, reject) => {
        const url = new URL(`https://${test.subdomain}.${BASE_DOMAIN}`);
        url.searchParams.set('url', test.url);
        url.searchParams.set('ttl', test.ttl);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: test.method || 'GET',
            headers: {
                'User-Agent': 'QuickTester/1.0',
                ...test.headers
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
        
        if (test.body) {
            req.write(test.body);
        }
        
        req.end();
    });
}

if (require.main === module) {
    quickTest().catch(console.error);
}

module.exports = { quickTest, makeRequest };
