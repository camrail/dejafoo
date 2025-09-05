// Local test server for the JavaScript Lambda function
const http = require('http');
const url = require('url');

// Import our Lambda handler
const { handler } = require('./index.js');

const PORT = 3001;

// Mock AWS SDK for local testing
const AWS = require('aws-sdk');

// Mock DynamoDB DocumentClient
AWS.DynamoDB.DocumentClient = class {
    get(params) {
        console.log('📋 Mock DynamoDB get:', params);
        return {
            promise: () => Promise.resolve({ Item: null }) // Always return cache miss for testing
        };
    }
    
    put(params) {
        console.log('💾 Mock DynamoDB put:', params);
        return {
            promise: () => Promise.resolve({})
        };
    }
};

// Mock S3
AWS.S3 = class {
    getObject(params) {
        console.log('📋 Mock S3 getObject:', params);
        return {
            promise: () => Promise.resolve({ Body: 'mock data' })
        };
    }
    
    putObject(params) {
        console.log('💾 Mock S3 putObject:', params);
        return {
            promise: () => Promise.resolve({})
        };
    }
};

// Set environment variables for local testing
process.env.DYNAMODB_TABLE_NAME = 'dejafoo-cache-local';
process.env.S3_BUCKET_NAME = 'dejafoo-cache-local';
process.env.UPSTREAM_BASE_URL = 'https://httpbin.org';
process.env.CACHE_TTL_SECONDS = '3600';
process.env.NODE_ENV = 'development';

console.log('🚀 Starting local test server...');
console.log('Environment:', {
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    UPSTREAM_BASE_URL: process.env.UPSTREAM_BASE_URL,
    CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS
});

const server = http.createServer(async (req, res) => {
    console.log(`\n📨 ${req.method} ${req.url}`);
    
    try {
        // Convert Node.js request to Lambda event format
        const parsedUrl = url.parse(req.url, true);
        const event = {
            httpMethod: req.method,
            path: parsedUrl.pathname,
            queryStringParameters: parsedUrl.query,
            headers: req.headers,
            body: null // For simplicity, not handling POST body in this test
        };
        
        // Call Lambda handler
        const response = await handler(event);
        
        // Convert Lambda response to Node.js response
        res.statusCode = response.statusCode;
        
        if (response.headers) {
            Object.keys(response.headers).forEach(key => {
                res.setHeader(key, response.headers[key]);
            });
        }
        
        res.end(response.body);
        
    } catch (error) {
        console.error('❌ Error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            error: 'Internal Server Error',
            message: error.message
        }));
    }
});

server.listen(PORT, () => {
    console.log(`✅ Local test server running at http://localhost:${PORT}`);
    console.log('\n🧪 Test commands:');
    console.log(`   curl "http://localhost:${PORT}/get?test=123"`);
    console.log(`   curl "http://localhost:${PORT}/json" -H "Accept: application/json"`);
    console.log(`   curl "http://localhost:${PORT}/status/200"`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down local test server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
