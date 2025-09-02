// Unit tests for cache key functionality

use dejafoo::cache::key::CacheKey;
use std::collections::HashMap;

#[test]
fn test_cache_key_generation() {
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert("Authorization".to_string(), "Bearer token123".to_string());
    
    let key = CacheKey::new("GET", "/api/users", &headers, r#"{"id": 1}"#).unwrap();
    
    // Authorization header should be excluded
    assert!(!key.normalized_headers.contains_key("authorization"));
    
    // Content-Type should be included and normalized
    assert_eq!(key.normalized_headers.get("content-type"), Some(&"application/json".to_string()));
    
    // Method should be uppercase
    assert_eq!(key.method, "GET");
    
    // Path should be normalized
    assert_eq!(key.path, "/api/users");
}

#[test]
fn test_path_normalization() {
    let headers = HashMap::new();
    
    // Test trailing slash removal
    let key1 = CacheKey::new("GET", "/api/users/", &headers, "").unwrap();
    assert_eq!(key1.path, "/api/users");
    
    // Test query parameter removal
    let key2 = CacheKey::new("GET", "/api/users?page=1&limit=10", &headers, "").unwrap();
    assert_eq!(key2.path, "/api/users");
    
    // Test root path preservation
    let key3 = CacheKey::new("GET", "/", &headers, "").unwrap();
    assert_eq!(key3.path, "/");
}

#[test]
fn test_consistent_hashing() {
    let headers = HashMap::new();
    
    let key1 = CacheKey::new("GET", "/api/users", &headers, "").unwrap();
    let key2 = CacheKey::new("GET", "/api/users", &headers, "").unwrap();
    
    // Same inputs should produce same hash
    assert_eq!(key1.key_hash, key2.key_hash);
    
    // Different inputs should produce different hashes
    let key3 = CacheKey::new("POST", "/api/users", &headers, "").unwrap();
    assert_ne!(key1.key_hash, key3.key_hash);
}

#[test]
fn test_header_normalization() {
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert("X-Custom-Header".to_string(), "custom-value".to_string());
    headers.insert("Authorization".to_string(), "Bearer token123".to_string());
    
    let key = CacheKey::new("GET", "/api/test", &headers, "").unwrap();
    
    // Authorization should be excluded
    assert!(!key.normalized_headers.contains_key("authorization"));
    
    // Other headers should be included and normalized
    assert_eq!(key.normalized_headers.get("content-type"), Some(&"application/json".to_string()));
    assert_eq!(key.normalized_headers.get("x-custom-header"), Some(&"custom-value".to_string()));
}

#[test]
fn test_body_hashing() {
    let headers = HashMap::new();
    
    // Test empty body
    let key1 = CacheKey::new("POST", "/api/users", &headers, "").unwrap();
    assert_eq!(key1.body_hash, "empty");
    
    // Test non-empty body
    let key2 = CacheKey::new("POST", "/api/users", &headers, r#"{"name": "test"}"#).unwrap();
    assert_ne!(key2.body_hash, "empty");
    assert!(!key2.body_hash.is_empty());
    
    // Same body should produce same hash
    let key3 = CacheKey::new("POST", "/api/users", &headers, r#"{"name": "test"}"#).unwrap();
    assert_eq!(key2.body_hash, key3.body_hash);
}

#[test]
fn test_key_string_conversion() {
    let headers = HashMap::new();
    let key = CacheKey::new("GET", "/api/test", &headers, "").unwrap();
    
    let key_string = key.to_string();
    assert!(!key_string.is_empty());
    
    // Key string should be the hash
    assert_eq!(key_string, key.key_hash);
}

#[test]
fn test_key_from_string() {
    let key_string = "test-hash-123";
    let key = CacheKey::from_string(key_string).unwrap();
    
    assert_eq!(key.key_hash, key_string);
    // Other fields should be set to UNKNOWN for now
    assert_eq!(key.method, "UNKNOWN");
    assert_eq!(key.path, "UNKNOWN");
}

#[test]
fn test_case_insensitive_headers() {
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert("content-type".to_string(), "application/xml".to_string());
    
    let key = CacheKey::new("GET", "/api/test", &headers, "").unwrap();
    
    // Headers should be normalized to lowercase
    assert!(key.normalized_headers.contains_key("content-type"));
    // The last value should be used (application/xml)
    assert_eq!(key.normalized_headers.get("content-type"), Some(&"application/xml".to_string()));
}

#[test]
fn test_excluded_headers() {
    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert("Authorization".to_string(), "Bearer token123".to_string());
    headers.insert("X-Forwarded-For".to_string(), "192.168.1.1".to_string());
    headers.insert("User-Agent".to_string(), "Mozilla/5.0".to_string());
    headers.insert("Accept-Encoding".to_string(), "gzip".to_string());
    headers.insert("Connection".to_string(), "keep-alive".to_string());
    headers.insert("Cache-Control".to_string(), "no-cache".to_string());
    headers.insert("Pragma".to_string(), "no-cache".to_string());
    
    let key = CacheKey::new("GET", "/api/test", &headers, "").unwrap();
    
    // Excluded headers should not be present
    assert!(!key.normalized_headers.contains_key("authorization"));
    assert!(!key.normalized_headers.contains_key("x-forwarded-for"));
    assert!(!key.normalized_headers.contains_key("user-agent"));
    assert!(!key.normalized_headers.contains_key("accept-encoding"));
    assert!(!key.normalized_headers.contains_key("connection"));
    assert!(!key.normalized_headers.contains_key("cache-control"));
    assert!(!key.normalized_headers.contains_key("pragma"));
    
    // Non-excluded headers should be present
    assert!(key.normalized_headers.contains_key("content-type"));
}
