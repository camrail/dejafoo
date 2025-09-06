const AWS = require('aws-sdk');
const http = require('http');
const https = require('https');
const url = require('url');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Environment variables
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'dejafoo-cache-prod';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'dejafoo-cache-prod';
const DEFAULT_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '3600');

// TTL parsing function
function parseTTL(ttlString) {
    if (!ttlString) return DEFAULT_TTL_SECONDS;
    
    const match = ttlString.match(/^(\d+)([smhd])$/);
    if (!match) return DEFAULT_TTL_SECONDS;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return DEFAULT_TTL_SECONDS;
    }
}

// Generate cache key based on subdomain, URL, query parameters, headers, and method
function generateCacheKey(subdomain, targetUrl, queryParams, headers, method, payload, ttl) {
    const crypto = require('crypto');
    // Filter out hop-by-hop headers that shouldn't affect caching
    const cacheableHeaders = { ...headers };
    delete cacheableHeaders.connection;
    delete cacheableHeaders.upgrade;
    delete cacheableHeaders['transfer-encoding'];
    delete cacheableHeaders['proxy-connection'];
    delete cacheableHeaders['proxy-authenticate'];
    delete cacheableHeaders['proxy-authorization'];
    delete cacheableHeaders.te;
    delete cacheableHeaders.trailers;
    delete cacheableHeaders.host; // Host header changes based on proxy
    delete cacheableHeaders['x-forwarded-for'];
    delete cacheableHeaders['x-forwarded-proto'];
    delete cacheableHeaders['x-forwarded-port'];
    
    // Remove CloudFront-specific headers that change between requests (case-insensitive)
    const cloudfrontHeaders = [
        'cloudfront-forwarded-proto', 'CloudFront-Forwarded-Proto',
        'cloudfront-is-desktop-viewer', 'CloudFront-Is-Desktop-Viewer',
        'cloudfront-is-mobile-viewer', 'CloudFront-Is-Mobile-Viewer',
        'cloudfront-is-smarttv-viewer', 'CloudFront-Is-SmartTV-Viewer',
        'cloudfront-is-tablet-viewer', 'CloudFront-Is-Tablet-Viewer',
        'cloudfront-viewer-asn', 'CloudFront-Viewer-ASN',
        'cloudfront-viewer-country', 'CloudFront-Viewer-Country',
        'x-amz-cf-id', 'X-Amz-Cf-Id',
        'x-amzn-trace-id', 'X-Amzn-Trace-Id',
        'via', 'Via'
    ];
    
    cloudfrontHeaders.forEach(header => {
        delete cacheableHeaders[header];
    });
    
    // Cache key includes TTL to ensure different TTLs create different cache entries
    const keyData = `${subdomain}:${method}:${targetUrl}:${JSON.stringify(queryParams)}:${payload || ''}:${ttl || ''}`;
    return crypto.createHash('sha256').update(keyData).digest('hex');
}

// Get cached response
async function getCachedResponse(cacheKey) {
    try {
        const params = {
            TableName: DYNAMODB_TABLE_NAME,
            Key: { cache_key: cacheKey }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (result.Item && result.Item.expiresAt > Date.now()) {
            console.log('✅ Cache hit');
            return result.Item.response;
        }
        
        console.log('❌ Cache miss or expired');
        return null;
    } catch (error) {
        console.log('Error getting cached response:', error.message);
        return null;
    }
}

// Cache response
async function cacheResponse(cacheKey, response, ttlSeconds) {
    try {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        
        const params = {
            TableName: DYNAMODB_TABLE_NAME,
            Item: {
                cache_key: cacheKey,
                response,
                expiresAt,
                ttl: ttlSeconds
            }
        };
        
        await dynamodb.put(params).promise();
        console.log('💾 Response cached');
    } catch (error) {
        console.log('Error caching response:', error.message);
    }
}

// Fetch from target URL
function fetchFromTarget(targetUrl, method, headers, body) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(targetUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        // Remove hop-by-hop headers
        const cleanHeaders = { ...headers };
        delete cleanHeaders.connection;
        delete cleanHeaders.upgrade;
        delete cleanHeaders['transfer-encoding'];
        delete cleanHeaders['proxy-connection'];
        delete cleanHeaders['proxy-authenticate'];
        delete cleanHeaders['proxy-authorization'];
        delete cleanHeaders.te;
        delete cleanHeaders.trailers;
        delete cleanHeaders.host; // Use the target host instead
        
        // Set the correct host header for the target
        cleanHeaders.host = parsedUrl.host;
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                ...cleanHeaders,
                'Accept-Encoding': 'identity' // Request uncompressed response
            },
            timeout: 30000, // 30 second timeout
            rejectUnauthorized: true // Ensure SSL certificate validation
        };
        
        const req = httpModule.request(options, (res) => {
            let responseBody = '';
            
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            
            res.on('end', () => {
                // Clean up headers - remove compression, hop-by-hop headers, and upstream cache control
                const cleanHeaders = { ...res.headers };
                delete cleanHeaders['content-encoding'];
                delete cleanHeaders['content-length'];
                delete cleanHeaders['transfer-encoding'];
                delete cleanHeaders['connection'];
                delete cleanHeaders['upgrade'];
                delete cleanHeaders['keep-alive'];
                delete cleanHeaders['proxy-authenticate'];
                delete cleanHeaders['proxy-authorization'];
                delete cleanHeaders['te'];
                delete cleanHeaders['trailers'];
                delete cleanHeaders['cache-control']; // Remove upstream cache-control to use our own
                
                resolve({
                    statusCode: res.statusCode,
                    headers: cleanHeaders,
                    body: responseBody
                });
            });
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });
        
        req.on('timeout', () => {
            console.error('Request timeout');
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (body) {
            req.write(body);
        }
        
        req.end();
    });
}

// Main handler
exports.handler = async (event) => {
    try {
        console.log('🔍 Request:', JSON.stringify(event, null, 2));
        
        // Extract subdomain from Host header
        const host = event.headers.Host || event.headers.host;
        const subdomain = host ? host.split('.')[0] : 'default';
        
        // Parse query parameters
        const queryParams = event.queryStringParameters || {};
        const targetUrl = queryParams.url;
        const ttlString = queryParams.ttl;
        
        if (!targetUrl) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
                },
                body: JSON.stringify({
                    error: 'Missing required parameter: url',
                    usage: 'https://{subdomain}.dejafoo.io?url={target_url}&ttl={duration}',
                    examples: [
                        'https://myapp.dejafoo.io?url=https://api.example.com/data&ttl=1h',
                        'https://test.dejafoo.io?url=https://jsonplaceholder.typicode.com/todos/1&ttl=2d'
                    ]
                })
            };
        }
        
        // Parse TTL
        const ttlSeconds = parseTTL(ttlString);
        console.log(`⏰ TTL: ${ttlString} = ${ttlSeconds} seconds`);
        
        // Generate cache key (include TTL to ensure different TTLs create different cache entries)
        const cacheKey = generateCacheKey(subdomain, targetUrl, {}, event.headers, event.httpMethod, event.body, ttlString);
        console.log(`🔑 Cache key: ${cacheKey}`);
        
        // Check cache
        const cachedResponse = await getCachedResponse(cacheKey);
        if (cachedResponse) {
            return {
                statusCode: cachedResponse.statusCode,
                headers: {
                    ...cachedResponse.headers,
                    'X-Cache': 'HIT',
                    'X-Cache-Key': cacheKey,
                    'X-Subdomain': subdomain,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
                },
                body: cachedResponse.body
            };
        }
        
        // Fetch from target
        console.log(`🌐 Fetching from target: ${targetUrl}`);
        const response = await fetchFromTarget(
            targetUrl,
            event.httpMethod,
            event.headers,
            event.body
        );
        
        console.log(`✅ Target response: ${response.statusCode}`);
        
        // Cache the response
        await cacheResponse(cacheKey, response, ttlSeconds);
        
        // Return response
        return {
            statusCode: response.statusCode,
            headers: {
                ...response.headers,
                'X-Cache': 'MISS',
                'X-Cache-Key': cacheKey,
                'X-Subdomain': subdomain,
                'X-Target-URL': targetUrl,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
            },
            body: response.body
        };
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};