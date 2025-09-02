// Integration tests for cache flow
// Tests the complete flow from request to cached response

use dejafoo::cache::{CacheKey, CacheStore, CachePolicy};
use dejafoo::proxy::{fetch_upstream, normalize_request, normalize_response};
use dejafoo::utils::{AppError, AppResult};
use serde_json::json;
use std::collections::HashMap;

#[tokio::test]
async fn test_cache_flow_basic() {
    // This test would require actual AWS services or mocks
    // For now, it's a placeholder that demonstrates the expected flow
    
    // 1. Create a request
    let request = json!({
        "httpMethod": "GET",
        "path": "/api/users",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer token123"
        },
        "body": ""
    });
    
    // 2. Normalize the request
    let normalized_request = normalize_request(&request).unwrap();
    
    // 3. Generate cache key
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert("Authorization".to_string(), "Bearer token123".to_string());
    
    let cache_key = CacheKey::new("GET", "/api/users", &headers, "").unwrap();
    
    // 4. Check cache (would be empty in this test)
    // let cache_store = CacheStore::new().await.unwrap();
    // let cached_response = cache_store.get(&cache_key).await.unwrap();
    // assert!(cached_response.is_none());
    
    // 5. Fetch from upstream (would require mock server)
    // let upstream_response = fetch_upstream(&normalized_request).await.unwrap();
    
    // 6. Normalize response
    let mock_response = json!({
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": r#"{"users": [{"id": 1, "name": "test"}]}"#
    });
    
    let normalized_response = normalize_response(mock_response).unwrap();
    
    // 7. Store in cache (would require actual cache store)
    // cache_store.set(&cache_key, &normalized_response).await.unwrap();
    
    // 8. Verify cache key generation
    assert_eq!(cache_key.method, "GET");
    assert_eq!(cache_key.path, "/api/users");
    assert!(!cache_key.key_hash.is_empty());
}

#[tokio::test]
async fn test_cache_policy_application() {
    let policy = CachePolicy::default();
    
    // Test successful response should be cacheable
    let success_response = json!({
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": r#"{"data": "test"}"#
    });
    
    assert!(policy.should_cache(&success_response));
    
    // Test error response should not be cacheable
    let error_response = json!({
        "statusCode": 404,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": r#"{"error": "Not found"}"#
    });
    
    assert!(!policy.should_cache(&error_response));
    
    // Test no-cache header
    let no_cache_response = json!({
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
        },
        "body": r#"{"data": "test"}"#
    });
    
    assert!(!policy.should_cache(&no_cache_response));
}

#[tokio::test]
async fn test_endpoint_policy_matching() {
    let policy = CachePolicy::default();
    
    // Test exact match
    assert!(policy.is_endpoint_cacheable("GET", "/api/users"));
    assert!(!policy.is_endpoint_cacheable("POST", "/api/users"));
    
    // Test wildcard match
    assert!(!policy.is_endpoint_cacheable("POST", "/api/anything"));
    
    // Test default behavior for GET requests
    assert!(policy.is_endpoint_cacheable("GET", "/api/unknown"));
}

#[tokio::test]
async fn test_request_normalization() {
    let request = json!({
        "httpMethod": "GET",
        "path": "/api/users/",
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer token123"
        },
        "body": r#"{"id": 1, "name": "test"}"#
    });
    
    let normalized = normalize_request(&request).unwrap();
    
    // Path should be normalized
    assert_eq!(normalized["path"], "/api/users");
    
    // Headers should be lowercase
    assert!(normalized["headers"]["content-type"].is_string());
    assert!(normalized["headers"]["authorization"].is_string());
    
    // Body should be normalized JSON
    assert!(normalized["body"]["id"].is_number());
    assert_eq!(normalized["body"]["name"], "test");
}

#[tokio::test]
async fn test_response_normalization() {
    let response = json!({
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "X-Custom-Header": "custom-value"
        },
        "body": r#"{"data": "test", "null_field": null}"#
    });
    
    let normalized = normalize_response(response).unwrap();
    
    // Headers should be lowercase
    assert!(normalized["headers"]["content-type"].is_string());
    assert!(normalized["headers"]["x-custom-header"].is_string());
    
    // Body should be normalized JSON
    assert!(normalized["body"]["data"].is_string());
    // Null fields should be removed
    assert!(!normalized["body"].as_object().unwrap().contains_key("null_field"));
}

#[tokio::test]
async fn test_cache_key_consistency() {
    let mut headers1 = HashMap::new();
    headers1.insert("Content-Type".to_string(), "application/json".to_string());
    headers1.insert("Authorization".to_string(), "Bearer token123".to_string());
    
    let mut headers2 = HashMap::new();
    headers2.insert("Content-Type".to_string(), "application/json".to_string());
    headers2.insert("Authorization".to_string(), "Bearer token456".to_string());
    
    let key1 = CacheKey::new("GET", "/api/users", &headers1, "").unwrap();
    let key2 = CacheKey::new("GET", "/api/users", &headers2, "").unwrap();
    
    // Different authorization tokens should produce different keys
    assert_ne!(key1.key_hash, key2.key_hash);
    
    // But same content-type should be included in both
    assert_eq!(key1.normalized_headers.get("content-type"), key2.normalized_headers.get("content-type"));
}

#[tokio::test]
async fn test_large_response_handling() {
    // Test that large responses are handled appropriately
    let large_body = "x".repeat(1024 * 1024); // 1MB
    let large_response = json!({
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": large_body
    });
    
    let policy = CachePolicy::default();
    
    // Large response should not be cacheable by default
    assert!(!policy.should_cache(&large_response));
    
    // But normalization should still work
    let normalized = normalize_response(large_response).unwrap();
    assert_eq!(normalized["statusCode"], 200);
}

#[tokio::test]
async fn test_error_handling() {
    // Test error handling in various scenarios
    
    // Invalid JSON in request body
    let invalid_request = json!({
        "httpMethod": "POST",
        "path": "/api/users",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": "invalid json"
    });
    
    // Normalization should handle invalid JSON gracefully
    let normalized = normalize_request(&invalid_request).unwrap();
    assert_eq!(normalized["body"], "invalid json");
    
    // Invalid path
    let invalid_path_request = json!({
        "httpMethod": "GET",
        "path": "invalid-path",
        "headers": {},
        "body": ""
    });
    
    let normalized = normalize_request(&invalid_path_request).unwrap();
    assert_eq!(normalized["path"], "/invalid-path");
}

#[tokio::test]
async fn test_cache_key_exclusion() {
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert("Authorization".to_string(), "Bearer token123".to_string());
    headers.insert("X-Forwarded-For".to_string(), "192.168.1.1".to_string());
    headers.insert("User-Agent".to_string(), "Mozilla/5.0".to_string());
    headers.insert("Accept-Encoding".to_string(), "gzip".to_string());
    
    let key = CacheKey::new("GET", "/api/test", &headers, "").unwrap();
    
    // Excluded headers should not be in the cache key
    assert!(!key.normalized_headers.contains_key("authorization"));
    assert!(!key.normalized_headers.contains_key("x-forwarded-for"));
    assert!(!key.normalized_headers.contains_key("user-agent"));
    assert!(!key.normalized_headers.contains_key("accept-encoding"));
    
    // Non-excluded headers should be included
    assert!(key.normalized_headers.contains_key("content-type"));
}
