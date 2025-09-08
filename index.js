const AWS = require('aws-sdk');
const http = require('http');
const https = require('https');
const url = require('url');

// Initialize AWS services
const s3 = new AWS.S3();

// Environment variables
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
    
    // Cache key includes only essential data - no headers to avoid CloudFront/proxy header variations
    const keyData = `${subdomain}:${method}:${targetUrl}:${JSON.stringify(queryParams)}:${payload || ''}:${ttl || ''}`;
    return crypto.createHash('sha256').update(keyData).digest('hex');
}

// Get cached response from S3
async function getCachedResponse(cacheKey) {
    try {
        const s3Key = `cache/${cacheKey}/response.json`;
        const params = {
            Bucket: S3_BUCKET_NAME,
            Key: s3Key
        };
        
        const result = await s3.getObject(params).promise();
        const cachedData = JSON.parse(result.Body.toString());
        
        // Check if cache entry is still valid
        if (cachedData.expiresAt > Date.now()) {
            console.log('✅ Cache hit');
            return {
                statusCode: cachedData.statusCode,
                headers: cachedData.headers,
                body: cachedData.body,
                expiresAt: cachedData.expiresAt,
                ttl: cachedData.ttl
            };
        } else {
            console.log('❌ Cache expired');
            // Clean up expired cache entry
            await s3.deleteObject(params).promise();
            return null;
        }
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.log('❌ Cache miss');
        } else {
            console.log('Error getting cached response:', error.message);
        }
        return null;
    }
}

// Cache response in S3
async function cacheResponse(cacheKey, response, ttlSeconds) {
    try {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        
        const cacheItem = {
            statusCode: response.statusCode,
            headers: response.headers,
            body: response.body,
            expiresAt,
            ttl: ttlSeconds,
            cachedAt: Date.now()
        };
        
        const s3Key = `cache/${cacheKey}/response.json`;
        const params = {
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
            Body: JSON.stringify(cacheItem),
            ContentType: 'application/json'
        };
        
        await s3.putObject(params).promise();
        console.log('💾 Response cached in S3');
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
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const responseBody = Buffer.concat(chunks).toString('utf8');
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
            // Calculate time until expiry
            const now = Date.now();
            const expiresAt = cachedResponse.expiresAt || (now + (cachedResponse.ttl * 1000));
            const timeUntilExpiry = Math.max(0, Math.floor((expiresAt - now) / 1000));
            
            return {
                statusCode: cachedResponse.statusCode,
                headers: {
                    ...cachedResponse.headers,
                    'X-Cache': 'HIT',
                    'X-Cache-Key': cacheKey,
                    'X-Cache-Expires-In': `${timeUntilExpiry}s`,
                    'X-Response-Time': new Date().toISOString(),
                    'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0, s-maxage=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Surrogate-Control': 'no-store',
                    'X-Cache-Control': 'no-cache, no-store, must-revalidate',
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
                'X-Cache-Expires-In': `${ttlSeconds}s`,
                'X-Target-URL': targetUrl,
                'X-Response-Time': new Date().toISOString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate, private, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store',
                'X-Cache-Control': 'no-cache, no-store, must-revalidate',
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