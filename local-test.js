const http = require('http');
const url = require('url');

// Mock AWS services for local testing
const mockS3 = {
    putObject: async (params) => {
        console.log('📦 S3 PUT:', params);
        return {};
    },
    getObject: async (params) => {
        console.log('📦 S3 GET:', params);
        throw new Error('NoSuchKey'); // Always cache miss for testing
    },
    deleteObject: async (params) => {
        console.log('🗑️ S3 DELETE:', params);
        return {};
    }
};

// Mock AWS SDK
const AWS = {
    S3: () => mockS3
};

// Set up environment
process.env.S3_BUCKET_NAME = 'dejafoo-cache-local';
process.env.CACHE_TTL_SECONDS = '3600';

// Load the handler
const { handler } = require('./index.js');

// Override AWS SDK
require.cache[require.resolve('aws-sdk')] = {
    exports: AWS
};

const PORT = 3001;

const server = http.createServer(async (req, res) => {
    try {
        console.log(`📨 ${req.method} ${req.url}`);
        
        // Parse URL
        const parsedUrl = url.parse(req.url, true);
        const queryParams = parsedUrl.query;
        
        // Build API Gateway event
        const event = {
            httpMethod: req.method,
            path: parsedUrl.pathname,
            queryStringParameters: queryParams,
            headers: req.headers,
            body: null
        };
        
        // Handle body for POST/PUT requests
        if (req.method === 'POST' || req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                event.body = body;
                processRequest(event, res);
            });
        } else {
            processRequest(event, res);
        }
        
    } catch (error) {
        console.error('❌ Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
});

async function processRequest(event, res) {
    try {
        const result = await handler(event);
        
        // Set headers
        Object.keys(result.headers || {}).forEach(key => {
            res.setHeader(key, result.headers[key]);
        });
        
        // Set status and body
        res.writeHead(result.statusCode || 200);
        res.end(result.body || '');
        
    } catch (error) {
        console.error('❌ Handler error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Handler error', message: error.message }));
    }
}

server.listen(PORT, () => {
    console.log('🚀 Dejafoo Proxy Service starting...');
    console.log('Environment:', {
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
        CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS
    });
    console.log(`✅ Local test server running at http://localhost:${PORT}`);
    console.log('🧪 Test commands:');
    console.log(`   curl "http://localhost:${PORT}?url=https://jsonplaceholder.typicode.com/todos/1&ttl=2d"`);
    console.log(`   curl "http://localhost:${PORT}?url=https://httpbin.org/json&ttl=1h"`);
    console.log(`   curl "http://localhost:${PORT}?url=https://api.github.com/users/octocat&ttl=30m"`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down local test server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});