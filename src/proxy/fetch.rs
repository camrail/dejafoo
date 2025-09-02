// Upstream request forwarding
// Handles HTTP requests to upstream services

use std::collections::HashMap;
use serde_json::Value;
use reqwest::{Client, Method};
use url::Url;

use crate::utils::{AppError, AppResult};

pub struct UpstreamFetcher {
    client: Client,
}

impl UpstreamFetcher {
    /// Create a new upstream fetcher
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            client,
        }
    }
    
    /// Create a new upstream fetcher with custom timeout
    pub fn with_timeout(timeout: std::time::Duration) -> Self {
        let client = Client::builder()
            .timeout(timeout)
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            client,
        }
    }
}

/// Forward a request to the upstream service
pub async fn fetch_upstream(request: &Value) -> AppResult<Value> {
    let fetcher = UpstreamFetcher::new();
    fetcher.fetch(request).await
}

impl UpstreamFetcher {
    /// Fetch response from upstream service
    pub async fn fetch(&self, request: &Value) -> AppResult<Value> {
        // Extract request details
        let method = request["httpMethod"].as_str()
            .ok_or_else(|| AppError::Proxy("Missing httpMethod".to_string()))?;
        let path = request["path"].as_str()
            .ok_or_else(|| AppError::Proxy("Missing path".to_string()))?;
        let headers = extract_headers(request)?;
        let body = request["body"].as_str().unwrap_or("");
        
        // Build upstream URL
        let upstream_url = build_upstream_url(path, &headers)?;
        
        // Create HTTP method
        let http_method = method.parse::<Method>()
            .map_err(|e| AppError::Proxy(format!("Invalid HTTP method: {}", e)))?;
        
        // Build request
        let mut req_builder = self.client
            .request(http_method, &upstream_url);
        
        // Add headers (excluding proxy-specific headers)
        let filtered_headers = filter_headers(&headers);
        for (key, value) in filtered_headers {
            req_builder = req_builder.header(&key, &value);
        }
        
        // Add body for non-GET requests
        if !body.is_empty() && method.to_uppercase() != "GET" {
            req_builder = req_builder.body(body.to_string());
        }
        
        // Send request
        let response = req_builder.send().await
            .map_err(|e| AppError::Proxy(format!("Request failed: {}", e)))?;
        
        // Extract response details
        let status_code = response.status().as_u16();
        let response_headers = response.headers().clone();
        let response_body = response.text().await
            .map_err(|e| AppError::Proxy(format!("Failed to read response body: {}", e)))?;
        
        // Build response JSON
        let mut response_json = serde_json::Map::new();
        response_json.insert("statusCode".to_string(), Value::Number(status_code.into()));
        response_json.insert("body".to_string(), Value::String(response_body));
        
        // Convert headers
        let mut headers_map = serde_json::Map::new();
        for (key, value) in response_headers.iter() {
            if let Ok(value_str) = value.to_str() {
                headers_map.insert(key.to_string(), Value::String(value_str.to_string()));
            }
        }
        response_json.insert("headers".to_string(), Value::Object(headers_map));
        
        Ok(Value::Object(response_json))
    }
}

/// Extract headers from request
fn extract_headers(request: &Value) -> AppResult<HashMap<String, String>> {
    let mut headers = HashMap::new();
    
    if let Some(headers_obj) = request["headers"].as_object() {
        for (key, value) in headers_obj {
            if let Some(value_str) = value.as_str() {
                headers.insert(key.clone(), value_str.to_string());
            }
        }
    }
    
    Ok(headers)
}

/// Build upstream URL from path and headers
fn build_upstream_url(path: &str, headers: &HashMap<String, String>) -> AppResult<String> {
    // Get upstream base URL from environment or headers
    let base_url = std::env::var("UPSTREAM_BASE_URL")
        .or_else(|_| headers.get("x-upstream-url").cloned().ok_or(()))
        .map_err(|_| AppError::Proxy("No upstream URL configured".to_string()))?;
    
    // Parse base URL
    let base_url = Url::parse(&base_url)
        .map_err(|e| AppError::Proxy(format!("Invalid upstream URL: {}", e)))?;
    
    // Join with path
    let full_url = base_url.join(path)
        .map_err(|e| AppError::Proxy(format!("Invalid path: {}", e)))?;
    
    Ok(full_url.to_string())
}

/// Filter headers to remove proxy-specific ones
fn filter_headers(headers: &HashMap<String, String>) -> HashMap<String, String> {
    let mut filtered = HashMap::new();
    
    // Headers to exclude from upstream requests
    let exclude_headers = [
        "x-forwarded-for",
        "x-real-ip",
        "x-forwarded-proto",
        "x-forwarded-host",
        "x-forwarded-port",
        "x-upstream-url",
        "host",
        "connection",
        "upgrade",
        "proxy-connection",
        "proxy-authorization",
    ];
    
    for (key, value) in headers {
        let key_lower = key.to_lowercase();
        if !exclude_headers.contains(&key_lower.as_str()) {
            filtered.insert(key.clone(), value.clone());
        }
    }
    
    filtered
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    
    #[test]
    fn test_extract_headers() {
        let request = serde_json::json!({
            "headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer token123"
            }
        });
        
        let headers = extract_headers(&request).unwrap();
        assert_eq!(headers.get("Content-Type"), Some(&"application/json".to_string()));
        assert_eq!(headers.get("Authorization"), Some(&"Bearer token123".to_string()));
    }
    
    #[test]
    fn test_filter_headers() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        headers.insert("X-Forwarded-For".to_string(), "192.168.1.1".to_string());
        headers.insert("Authorization".to_string(), "Bearer token123".to_string());
        
        let filtered = filter_headers(&headers);
        
        // X-Forwarded-For should be excluded
        assert!(!filtered.contains_key("X-Forwarded-For"));
        
        // Other headers should be included
        assert_eq!(filtered.get("Content-Type"), Some(&"application/json".to_string()));
        assert_eq!(filtered.get("Authorization"), Some(&"Bearer token123".to_string()));
    }
    
    #[test]
    fn test_build_upstream_url() {
        std::env::set_var("UPSTREAM_BASE_URL", "https://api.example.com");
        
        let headers = HashMap::new();
        let url = build_upstream_url("/users", &headers).unwrap();
        assert_eq!(url, "https://api.example.com/users");
        
        std::env::remove_var("UPSTREAM_BASE_URL");
    }
    
    #[tokio::test]
    async fn test_fetch_upstream() {
        // This test would require a mock server or actual upstream
        // For now, it's a placeholder
    }
}
