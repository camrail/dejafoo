const AWS = require('aws-sdk');
const https = require('https');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

// Initialize AWS clients
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Environment variables
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'dejafoo-cache-prod';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'dejafoo-cache-prod';
const UPSTREAM_BASE_URL = process.env.UPSTREAM_BASE_URL || 'https://httpbin.org';
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '3600'); // 1 hour default

console.log('🚀 Dejafoo Proxy Service starting...');
console.log('Environment:', {
    DYNAMODB_TABLE_NAME,
    S3_BUCKET_NAME,
    UPSTREAM_BASE_URL,
    CACHE_TTL_SECONDS
});

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
    console.log('📨 Processing request:', JSON.stringify(event, null, 2));
    
    try {
        const method = event.httpMethod || 'GET';
        const path = event.path || '/';
        const queryStringParameters = event.queryStringParameters || {};
        const headers = event.headers || {};
        const body = event.body;
        
        console.log(`🔍 Request: ${method} ${path}`);
        
        // Generate cache key
        const cacheKey = generateCacheKey(method, path, queryStringParameters, headers, body);
        console.log(`🔑 Cache key: ${cacheKey}`);
        
        // Try to get from cache first
        const cachedResponse = await getCachedResponse(cacheKey);
        if (cachedResponse) {
            console.log('✅ Cache hit!');
            return formatLambdaResponse(cachedResponse);
        }
        
        console.log('❌ Cache miss, fetching from upstream');
        
        // Fetch from upstream
        const upstreamResponse = await fetchFromUpstream(method, path, queryStringParameters, headers, body);
        
        // Cache the response if it's cacheable
        if (isCacheable(upstreamResponse)) {
            console.log('💾 Caching response');
            await cacheResponse(cacheKey, upstreamResponse);
        }
        
        return formatLambdaResponse(upstreamResponse);
        
    } catch (error) {
        console.error('❌ Error processing request:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

/**
 * Generate a cache key based on request parameters
 */
function generateCacheKey(method, path, queryParams, headers, body) {
    const keyData = {
        method,
        path,
        queryParams: sortObject(queryParams),
        // Only include certain headers that affect caching
        relevantHeaders: {
            'accept': headers.accept,
            'accept-encoding': headers['accept-encoding'],
            'user-agent': headers['user-agent']
        },
        body: body || null
    };
    
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('sha256').update(keyString).digest('hex');
}

/**
 * Sort object keys for consistent cache key generation
 */
function sortObject(obj) {
    if (!obj) return obj;
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
        sorted[key] = obj[key];
    });
    return sorted;
}

/**
 * Get cached response from DynamoDB and S3
 */
async function getCachedResponse(cacheKey) {
    try {
        // Check DynamoDB for cache metadata
        const params = {
            TableName: DYNAMODB_TABLE_NAME,
            Key: { cache_key: cacheKey }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (!result.Item) {
            console.log('No cache entry found in DynamoDB');
            return null;
        }
        
        const cacheEntry = result.Item;
        const now = Math.floor(Date.now() / 1000);
        
        // Check if cache entry is expired
        if (cacheEntry.expires_at && cacheEntry.expires_at < now) {
            console.log('Cache entry expired');
            return null;
        }
        
        // Get response body from S3 if it exists
        let responseBody = cacheEntry.response_body;
        if (cacheEntry.s3_key) {
            console.log('Fetching response body from S3');
            const s3Params = {
                Bucket: S3_BUCKET_NAME,
                Key: cacheEntry.s3_key
            };
            
            const s3Result = await s3.getObject(s3Params).promise();
            responseBody = s3Result.Body.toString();
        }
        
        return {
            statusCode: cacheEntry.status_code,
            headers: cacheEntry.headers || {},
            body: responseBody
        };
        
    } catch (error) {
        console.error('Error getting cached response:', error);
        return null;
    }
}

/**
 * Fetch response from upstream service
 */
function fetchFromUpstream(method, path, queryParams, headers, body) {
    return new Promise((resolve, reject) => {
        // Build upstream URL
        const upstreamUrl = new URL(path, UPSTREAM_BASE_URL);
        
        // Add query parameters
        if (queryParams) {
            Object.keys(queryParams).forEach(key => {
                upstreamUrl.searchParams.append(key, queryParams[key]);
            });
        }
        
        console.log(`🌐 Fetching from upstream: ${upstreamUrl.toString()}`);
        
        const options = {
            method,
            headers: {
                ...headers,
                // Remove hop-by-hop headers
                'host': upstreamUrl.host,
                'connection': undefined,
                'upgrade': undefined,
                'proxy-authenticate': undefined,
                'proxy-authorization': undefined,
                'te': undefined,
                'trailers': undefined,
                'transfer-encoding': undefined
            }
        };
        
        const client = upstreamUrl.protocol === 'https:' ? https : http;
        
        const req = client.request(upstreamUrl, options, (res) => {
            let responseBody = '';
            
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            
            res.on('end', () => {
                const response = {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: responseBody
                };
                
                console.log(`✅ Upstream response: ${res.statusCode}`);
                resolve(response);
            });
        });
        
        req.on('error', (error) => {
            console.error('Upstream request error:', error);
            reject(error);
        });
        
        // Send body if present
        if (body) {
            req.write(body);
        }
        
        req.end();
    });
}

/**
 * Check if response is cacheable
 */
function isCacheable(response) {
    // Only cache successful responses
    if (response.statusCode < 200 || response.statusCode >= 300) {
        return false;
    }
    
    // Don't cache if explicitly told not to
    const cacheControl = response.headers['cache-control'];
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
        return false;
    }
    
    return true;
}

/**
 * Cache response in DynamoDB and S3
 */
async function cacheResponse(cacheKey, response) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + CACHE_TTL_SECONDS;
        
        let cacheEntry = {
            cache_key: cacheKey,
            status_code: response.statusCode,
            headers: response.headers,
            created_at: now,
            expires_at: expiresAt
        };
        
        // Store large responses in S3, small ones in DynamoDB
        const responseBody = response.body || '';
        if (responseBody.length > 300 * 1024) { // 300KB threshold
            console.log('Storing large response in S3');
            const s3Key = `cache/${cacheKey}`;
            
            await s3.putObject({
                Bucket: S3_BUCKET_NAME,
                Key: s3Key,
                Body: responseBody,
                ContentType: 'application/octet-stream'
            }).promise();
            
            cacheEntry.s3_key = s3Key;
        } else {
            cacheEntry.response_body = responseBody;
        }
        
        // Store in DynamoDB
        await dynamodb.put({
            TableName: DYNAMODB_TABLE_NAME,
            Item: cacheEntry
        }).promise();
        
        console.log('✅ Response cached successfully');
        
    } catch (error) {
        console.error('Error caching response:', error);
        // Don't fail the request if caching fails
    }
}

/**
 * Format response for Lambda
 */
function formatLambdaResponse(response) {
    return {
        statusCode: response.statusCode,
        headers: {
            'Content-Type': response.headers['content-type'] || 'application/json',
            'X-Cache': response.headers['X-Cache'] || 'MISS',
            ...response.headers
        },
        body: response.body || ''
    };
}
