// Cache key generation and canonicalization
// Handles request normalization and consistent hashing

use std::collections::HashMap;
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};

use crate::utils::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheKey {
    pub method: String,
    pub path: String,
    pub normalized_headers: HashMap<String, String>,
    pub body_hash: String,
    pub key_hash: String,
}

impl CacheKey {
    /// Generate a cache key from request components
    pub fn new(
        method: &str,
        path: &str,
        headers: &HashMap<String, String>,
        body: &str,
    ) -> Result<Self, AppError> {
        Self::new_with_subdomain(method, path, headers, body, None)
    }
    
    /// Generate a cache key from request components with subdomain
    pub fn new_with_subdomain(
        method: &str,
        path: &str,
        headers: &HashMap<String, String>,
        body: &str,
        subdomain: Option<&str>,
    ) -> Result<Self, AppError> {
        let normalized_headers = Self::normalize_headers(headers);
        let body_hash = Self::hash_body(body);
        let key_hash = Self::generate_key_hash(method, path, &normalized_headers, &body_hash, subdomain);
        
        Ok(CacheKey {
            method: method.to_uppercase(),
            path: Self::normalize_path(path),
            normalized_headers,
            body_hash,
            key_hash,
        })
    }
    
    /// Normalize headers by removing cache-irrelevant headers and sorting
    fn normalize_headers(headers: &HashMap<String, String>) -> HashMap<String, String> {
        let mut normalized = HashMap::new();
        
        // Headers that should be excluded from cache key
        let exclude_headers = [
            "authorization",
            "x-forwarded-for",
            "x-real-ip",
            "x-forwarded-proto",
            "x-forwarded-host",
            "user-agent",
            "accept-encoding",
            "connection",
            "cache-control",
            "pragma",
        ];
        
        for (key, value) in headers {
            let key_lower = key.to_lowercase();
            
            // Skip excluded headers
            if exclude_headers.contains(&key_lower.as_str()) {
                continue;
            }
            
            // Normalize header values
            let normalized_value = Self::normalize_header_value(value);
            normalized.insert(key_lower, normalized_value);
        }
        
        normalized
    }
    
    /// Normalize header values (trim whitespace, lowercase where appropriate)
    fn normalize_header_value(value: &str) -> String {
        value.trim().to_lowercase()
    }
    
    /// Normalize URL path (remove query params, trailing slashes, etc.)
    fn normalize_path(path: &str) -> String {
        let path = path.trim();
        
        // Remove query parameters for cache key
        let path = if let Some(query_pos) = path.find('?') {
            &path[..query_pos]
        } else {
            path
        };
        
        // Remove trailing slash except for root
        if path.len() > 1 && path.ends_with('/') {
            path[..path.len() - 1].to_string()
        } else {
            path.to_string()
        }
    }
    
    /// Hash request body for cache key
    fn hash_body(body: &str) -> String {
        if body.is_empty() {
            "empty".to_string()
        } else {
            let mut hasher = Sha256::new();
            hasher.update(body.as_bytes());
            format!("{:x}", hasher.finalize())
        }
    }
    
    /// Generate the final cache key hash
    fn generate_key_hash(
        method: &str,
        path: &str,
        headers: &HashMap<String, String>,
        body_hash: &str,
        subdomain: Option<&str>,
    ) -> String {
        let mut hasher = Sha256::new();
        
        // Add subdomain first (if present) to separate org data
        if let Some(subdomain) = subdomain {
            hasher.update(subdomain.to_lowercase().as_bytes());
            hasher.update(b"\0");
        }
        
        // Add method
        hasher.update(method.to_uppercase().as_bytes());
        hasher.update(b"\0");
        
        // Add path
        hasher.update(path.as_bytes());
        hasher.update(b"\0");
        
        // Add headers (sorted for consistency)
        let mut header_pairs: Vec<_> = headers.iter().collect();
        header_pairs.sort_by_key(|(k, _)| *k);
        
        for (key, value) in header_pairs {
            hasher.update(key.as_bytes());
            hasher.update(b":");
            hasher.update(value.as_bytes());
            hasher.update(b"\0");
        }
        
        // Add body hash
        hasher.update(body_hash.as_bytes());
        
        format!("{:x}", hasher.finalize())
    }
    
    /// Get the string representation of the cache key
    pub fn to_string(&self) -> String {
        self.key_hash.clone()
    }
    
    /// Parse cache key from string
    pub fn from_string(key_str: &str) -> Result<Self, AppError> {
        // This would need to be implemented based on how keys are stored
        // For now, we'll assume the key string is the hash
        Ok(CacheKey {
            method: "UNKNOWN".to_string(),
            path: "UNKNOWN".to_string(),
            normalized_headers: HashMap::new(),
            body_hash: "UNKNOWN".to_string(),
            key_hash: key_str.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
}
