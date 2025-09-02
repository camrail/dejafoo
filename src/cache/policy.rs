// Cache policy implementation
// Handles TTL, headers-to-vary, and body size cutoffs

use std::collections::HashMap;
use serde::{Deserialize, Serialize, Deserializer};
use serde_json::Value;
use std::time::Duration;

use crate::utils::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachePolicy {
    #[serde(deserialize_with = "deserialize_duration_from_seconds")]
    pub default_ttl: Duration,
    pub max_body_size: usize,
    pub headers_to_vary: Vec<String>,
    pub endpoint_policies: HashMap<String, EndpointPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointPolicy {
    #[serde(deserialize_with = "deserialize_optional_duration_from_seconds")]
    pub ttl: Option<Duration>,
    pub max_body_size: Option<usize>,
    pub headers_to_vary: Option<Vec<String>>,
    pub cacheable: bool,
    pub methods: Vec<String>,
}

impl CachePolicy {
    /// Load cache policy from configuration
    pub async fn load_from_config() -> AppResult<Self> {
        // Try to load from environment variable first
        if let Ok(config_path) = std::env::var("CACHE_POLICY_CONFIG") {
            return Self::load_from_file(&config_path).await;
        }
        
        // Try default config file
        let default_paths = [
            "config/policies.yaml",
            "/opt/config/policies.yaml",
            "./config/policies.yaml",
        ];
        
        for path in &default_paths {
            if std::path::Path::new(path).exists() {
                return Self::load_from_file(path).await;
            }
        }
        
        // Return default policy if no config found
        Ok(Self::default())
    }
    
    /// Load policy from YAML file
    async fn load_from_file(path: &str) -> AppResult<Self> {
        let content = tokio::fs::read_to_string(path).await
            .map_err(|e| AppError::Configuration(format!("Failed to read config file {}: {}", path, e)))?;
        
        let policy: CachePolicy = serde_yaml::from_str(&content)
            .map_err(|e| AppError::Configuration(format!("Failed to parse config file {}: {}", path, e)))?;
        
        Ok(policy)
    }
    
    /// Get TTL for a specific endpoint
    pub fn get_ttl(&self, method: &str, path: &str) -> Duration {
        if let Some(endpoint_policy) = self.get_endpoint_policy(method, path) {
            endpoint_policy.ttl.unwrap_or(self.default_ttl)
        } else {
            self.default_ttl
        }
    }
    
    /// Get max body size for a specific endpoint
    pub fn get_max_body_size(&self, method: &str, path: &str) -> usize {
        if let Some(endpoint_policy) = self.get_endpoint_policy(method, path) {
            endpoint_policy.max_body_size.unwrap_or(self.max_body_size)
        } else {
            self.max_body_size
        }
    }
    
    /// Get headers to vary for a specific endpoint
    pub fn get_headers_to_vary(&self, method: &str, path: &str) -> &[String] {
        if let Some(endpoint_policy) = self.get_endpoint_policy(method, path) {
            endpoint_policy.headers_to_vary.as_deref().unwrap_or(&self.headers_to_vary)
        } else {
            &self.headers_to_vary
        }
    }
    
    /// Check if a response should be cached
    pub fn should_cache(&self, response: &Value) -> bool {
        // Check status code
        if let Some(status_code) = response["statusCode"].as_u64() {
            // Only cache successful responses
            if status_code < 200 || status_code >= 300 {
                return false;
            }
        }
        
        // Check for cache-control headers
        if let Some(headers) = response["headers"].as_object() {
            for (key, value) in headers {
                let key_lower = key.to_lowercase();
                if key_lower == "cache-control" {
                    if let Some(value_str) = value.as_str() {
                        if value_str.contains("no-cache") || value_str.contains("no-store") {
                            return false;
                        }
                    }
                }
            }
        }
        
        // Check body size
        if let Some(body) = response["body"].as_str() {
            if body.len() > self.max_body_size {
                return false;
            }
        }
        
        true
    }
    
    /// Check if an endpoint is cacheable
    pub fn is_endpoint_cacheable(&self, method: &str, path: &str) -> bool {
        if let Some(endpoint_policy) = self.get_endpoint_policy(method, path) {
            endpoint_policy.cacheable
        } else {
            // Default: cacheable for GET requests
            method.to_uppercase() == "GET"
        }
    }
    
    /// Get endpoint policy for a specific method and path
    fn get_endpoint_policy(&self, method: &str, path: &str) -> Option<&EndpointPolicy> {
        // Try exact match first
        let exact_key = format!("{} {}", method.to_uppercase(), path);
        if let Some(policy) = self.endpoint_policies.get(&exact_key) {
            return Some(policy);
        }
        
        // Try pattern matching
        for (pattern, policy) in &self.endpoint_policies {
            if self.matches_pattern(pattern, method, path) {
                return Some(policy);
            }
        }
        
        None
    }
    
    /// Check if a method and path matches a pattern
    fn matches_pattern(&self, pattern: &str, method: &str, path: &str) -> bool {
        let parts: Vec<&str> = pattern.splitn(2, ' ').collect();
        if parts.len() != 2 {
            return false;
        }
        
        let pattern_method = parts[0];
        let pattern_path = parts[1];
        
        // Check method match
        if pattern_method != "*" && pattern_method.to_uppercase() != method.to_uppercase() {
            return false;
        }
        
        // Check path match (simple wildcard support)
        if pattern_path == "*" {
            return true;
        }
        
        if pattern_path.ends_with("*") {
            let prefix = &pattern_path[..pattern_path.len() - 1];
            return path.starts_with(prefix);
        }
        
        pattern_path == path
    }
}

impl Default for CachePolicy {
    fn default() -> Self {
        let mut endpoint_policies = HashMap::new();
        
        // Default policies for common endpoints
        endpoint_policies.insert(
            "GET /api/users".to_string(),
            EndpointPolicy {
                ttl: Some(Duration::from_secs(300)), // 5 minutes
                max_body_size: Some(1024 * 1024), // 1MB
                headers_to_vary: Some(vec!["authorization".to_string()]),
                cacheable: true,
                methods: vec!["GET".to_string()],
            },
        );
        
        endpoint_policies.insert(
            "POST *".to_string(),
            EndpointPolicy {
                ttl: None,
                max_body_size: None,
                headers_to_vary: None,
                cacheable: false,
                methods: vec!["POST".to_string()],
            },
        );
        
        CachePolicy {
            default_ttl: Duration::from_secs(3600), // 1 hour
            max_body_size: 10 * 1024 * 1024, // 10MB
            headers_to_vary: vec![
                "authorization".to_string(),
                "x-api-key".to_string(),
                "x-user-id".to_string(),
            ],
            endpoint_policies,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    
    #[test]
    fn test_default_policy() {
        let policy = CachePolicy::default();
        
        assert_eq!(policy.default_ttl, Duration::from_secs(3600));
        assert_eq!(policy.max_body_size, 10 * 1024 * 1024);
        assert!(policy.headers_to_vary.contains(&"authorization".to_string()));
    }
    
    #[test]
    fn test_endpoint_policy_matching() {
        let policy = CachePolicy::default();
        
        // Test exact match
        assert!(policy.is_endpoint_cacheable("GET", "/api/users"));
        assert!(!policy.is_endpoint_cacheable("POST", "/api/users"));
        
        // Test wildcard match
        assert!(!policy.is_endpoint_cacheable("POST", "/api/anything"));
    }
    
    #[test]
    fn test_should_cache_response() {
        let policy = CachePolicy::default();
        
        // Test successful response
        let success_response = serde_json::json!({
            "statusCode": 200,
            "body": "{\"data\": \"test\"}",
            "headers": {}
        });
        assert!(policy.should_cache(&success_response));
        
        // Test error response
        let error_response = serde_json::json!({
            "statusCode": 404,
            "body": "Not found",
            "headers": {}
        });
        assert!(!policy.should_cache(&error_response));
        
        // Test no-cache header
        let no_cache_response = serde_json::json!({
            "statusCode": 200,
            "body": "{\"data\": \"test\"}",
            "headers": {
                "Cache-Control": "no-cache"
            }
        });
        assert!(!policy.should_cache(&no_cache_response));
    }
    
    #[test]
    fn test_pattern_matching() {
        let policy = CachePolicy::default();
        
        // Test exact match
        assert!(policy.matches_pattern("GET /api/users", "GET", "/api/users"));
        assert!(!policy.matches_pattern("GET /api/users", "POST", "/api/users"));
        
        // Test wildcard match
        assert!(policy.matches_pattern("POST *", "POST", "/api/anything"));
        assert!(!policy.matches_pattern("POST *", "GET", "/api/anything"));
        
        // Test prefix match
        assert!(policy.matches_pattern("GET /api/*", "GET", "/api/users"));
        assert!(!policy.matches_pattern("GET /api/*", "GET", "/other/path"));
    }
}

/// Custom deserializer for Duration from seconds (integer)
fn deserialize_duration_from_seconds<'de, D>(deserializer: D) -> Result<Duration, D::Error>
where
    D: Deserializer<'de>,
{
    let seconds: u64 = Deserialize::deserialize(deserializer)?;
    Ok(Duration::from_secs(seconds))
}

/// Custom deserializer for Optional Duration from seconds (integer)
fn deserialize_optional_duration_from_seconds<'de, D>(deserializer: D) -> Result<Option<Duration>, D::Error>
where
    D: Deserializer<'de>,
{
    let seconds: Option<u64> = Deserialize::deserialize(deserializer)?;
    Ok(seconds.map(Duration::from_secs))
}
